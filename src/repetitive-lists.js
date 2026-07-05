// Detect repeated sibling-card structures (listing grids) that Readability
// discards as clutter, and render each as a Markdown bullet list. Pure and
// DOM-agnostic: `root` is any DOM element/document (real `document` in the
// page, a domino-parsed doc in tests).

const NON_CONTENT_TAGS = new Set([
  'SCRIPT',
  'STYLE',
  'NOSCRIPT',
  'SVG',
  'IFRAME',
  'FORM',
  'BUTTON',
  'INPUT',
  'TEXTAREA',
  'SELECT',
]);

function structureSignature(el) {
  const classes = Array.from(el.classList).sort().join(' ');
  return `${el.tagName}|${classes}`;
}

function hasNestedStructure(el) {
  return el.children.length > 0;
}

function collectLeafText(node, parts) {
  for (const child of node.childNodes) {
    if (child.nodeType === 3) {
      const text = (child.textContent || '').replace(/\s+/g, ' ').trim();
      if (text) parts.push(text);
    } else if (child.nodeType === 1 && !NON_CONTENT_TAGS.has(child.tagName)) {
      collectLeafText(child, parts);
    }
  }
}

function itemBullet(el) {
  const parts = [];
  collectLeafText(el, parts);
  return parts.join(' • ');
}

export function detectRepetitiveLists(root) {
  const clusters = [];
  const claimed = new Set();
  for (const parent of root.querySelectorAll('*')) {
    if (claimed.has(parent)) continue;
    const children = Array.from(parent.children);
    if (children.length < 3) continue;
    const groups = new Map();
    for (const child of children) {
      const sig = structureSignature(child);
      const group = groups.get(sig);
      if (group) group.push(child);
      else groups.set(sig, [child]);
    }
    for (const items of groups.values()) {
      if (items.length < 3) continue;
      if (!items.every(hasNestedStructure)) continue;
      const bullets = items.map(itemBullet).filter((b) => b.length > 0);
      if (bullets.length < 3) continue;
      clusters.push({
        markdown: bullets.map((b) => `- ${b}`).join('\n'),
        nodes: items,
      });
      for (const item of items) {
        claimed.add(item);
        for (const descendant of item.querySelectorAll('*')) {
          claimed.add(descendant);
        }
      }
    }
  }
  return { clusters };
}

export function replaceClustersWithPlaceholders(root) {
  const { clusters } = detectRepetitiveLists(root);
  const doc = root.ownerDocument || root;
  return clusters.map((cluster, index) => {
    const token = `⟦LIST${index}⟧`;
    const [first] = cluster.nodes;
    const placeholder = doc.createElement('p');
    placeholder.textContent = token;
    first.parentNode.insertBefore(placeholder, first);
    for (const node of cluster.nodes) node.remove();
    return { token, markdown: cluster.markdown };
  });
}

// Expose as page globals so the extension's injected extractor (which runs in
// the page, not this module) can call them. Skipped under Node (no `window`);
// the generated classic-script copy in page/ relies on this block.
if (typeof window !== 'undefined') {
  window.detectRepetitiveLists = detectRepetitiveLists;
  window.replaceClustersWithPlaceholders = replaceClustersWithPlaceholders;
}
