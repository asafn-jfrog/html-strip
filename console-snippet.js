/*
 * html-strip — DevTools console snippet
 *
 * Does the same thing as the extension, without installing it: extracts the
 * page's main content, converts it to Markdown with a metadata header, and
 * copies it to the clipboard. Loads Readability + Turndown (+ the GFM plugin
 * for tables) from a CDN on the fly.
 *
 * USE: open DevTools -> Console, paste the ONE-LINER at the bottom, press Enter.
 *
 * Caveats:
 *  - Strict-CSP sites (e.g. GitHub, some banks) block the CDN import() and it
 *    will fail there. Works on most article/blog/docs pages.
 *  - Uses document.execCommand('copy') via a temp textarea instead of the async
 *    Clipboard API, because from the console the page often isn't "focused"
 *    and navigator.clipboard.writeText would throw.
 *
 * The readable version below is the source of truth; the one-liner and
 * bookmarklet at the end are minified copies of it.
 */

(async () => {
  const [{ Readability }, { default: TurndownService }, { gfm }] =
    await Promise.all([
      import('https://esm.sh/@mozilla/readability'),
      import('https://esm.sh/turndown'),
      import('https://esm.sh/turndown-plugin-gfm'),
    ]);

  // --- repetitive-list recovery (mirrors src/repetitive-lists.js) ---
  const NON_CONTENT = new Set([
    'SCRIPT', 'STYLE', 'NOSCRIPT', 'SVG', 'IFRAME',
    'FORM', 'BUTTON', 'INPUT', 'TEXTAREA', 'SELECT',
  ]);
  const leafText = (el) => {
    const parts = [];
    (function walk(node) {
      for (const child of node.childNodes) {
        if (child.nodeType === 3) {
          const t = (child.textContent || '').replace(/\s+/g, ' ').trim();
          if (t) parts.push(t);
        } else if (child.nodeType === 1 && !NON_CONTENT.has(child.tagName)) {
          walk(child);
        }
      }
    })(el);
    return parts.join(' • ');
  };
  const detectLists = (root) => {
    const clusters = [];
    const claimed = new Set();
    for (const parent of root.querySelectorAll('*')) {
      if (claimed.has(parent)) continue;
      const children = Array.from(parent.children);
      if (children.length < 3) continue;
      const groups = new Map();
      for (const ch of children) {
        const sig = ch.tagName + '|' + Array.from(ch.classList).sort().join(' ');
        if (groups.has(sig)) groups.get(sig).push(ch);
        else groups.set(sig, [ch]);
      }
      for (const items of groups.values()) {
        if (items.length < 3) continue;
        if (!items.every((it) => it.querySelector('*'))) continue;
        const bullets = items.map(leafText).filter((b) => b);
        if (bullets.length < 3) continue;
        clusters.push({
          markdown: bullets.map((b) => '- ' + b).join('\n'),
          nodes: items,
        });
        for (const it of items) {
          claimed.add(it);
          for (const d of it.querySelectorAll('*')) claimed.add(d);
        }
      }
    }
    return clusters;
  };
  const swapLists = (root) => {
    const doc = root.ownerDocument || root;
    return detectLists(root).map((cl, i) => {
      const token = '⟦LIST' + i + '⟧';
      const first = cl.nodes[0];
      const p = doc.createElement('p');
      p.textContent = token;
      first.parentNode.insertBefore(p, first);
      cl.nodes.forEach((n) => n.remove());
      return { token, markdown: cl.markdown };
    });
  };
  const applyLists = (body, lists) => {
    let out = body;
    const extra = [];
    for (const { token, markdown } of lists) {
      if (out.includes(token)) out = out.split(token).join(markdown);
      else extra.push(markdown);
    }
    return extra.length ? out.trimEnd() + '\n\n' + extra.join('\n\n') : out;
  };

  const clone = document.cloneNode(true);
  const lists = swapLists(clone);
  const article = new Readability(clone).parse();
  if ((!article || !article.content) && lists.length === 0) {
    alert('html-strip: no main content found on this page');
    return;
  }

  const turndown = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
  });
  // Drop interactive / embedded elements so app pages don't leak widget markup.
  turndown.remove([
    'script',
    'style',
    'noscript',
    'svg',
    'iframe',
    'form',
    'button',
    'input',
    'textarea',
    'select',
  ]);
  turndown.use(gfm); // GitHub-flavored Markdown: tables, strikethrough, task lists.
  // gfm keeps headerless (no <th>) tables as raw HTML; convert those too.
  turndown.addRule('headerlessTable', {
    filter: (node) => node.nodeName === 'TABLE' && !node.querySelector('th'),
    replacement: (_content, node) => {
      const rows = Array.from(node.rows || []);
      if (rows.length === 0) return '';
      const rowCells = rows.map((row) =>
        Array.from(row.cells || []).map((cell) =>
          (cell.textContent || '').trim().replace(/\s+/g, ' ').replace(/\|/g, '\\|')
        )
      );
      const width = Math.max(...rowCells.map((cells) => cells.length));
      const line = (cells) => {
        const padded = cells.slice();
        while (padded.length < width) padded.push('');
        return '| ' + padded.join(' | ') + ' |';
      };
      const separator = '| ' + Array(width).fill('---').join(' | ') + ' |';
      const [header, ...body] = rowCells;
      return '\n\n' + [line(header), separator, ...body.map(line)].join('\n') + '\n\n';
    },
  });

  const header = [];
  const title = (article && article.title) || document.title;
  if (title) header.push('# ' + title);
  header.push('Source: ' + location.href);
  if (article && article.byline) header.push('Author: ' + article.byline);
  if (article && article.publishedTime) header.push('Date: ' + article.publishedTime);
  if (article && article.siteName) header.push('Site: ' + article.siteName);

  const bodyMd =
    article && article.content ? turndown.turndown(article.content).trim() : '';
  const markdown = header.join('\n') + '\n\n' + applyLists(bodyMd, lists) + '\n';

  const ta = document.createElement('textarea');
  ta.value = markdown;
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  ta.remove();

  console.log(
    '%chtml-strip: copied ' + markdown.length + ' chars to clipboard ✓',
    'color:#0a0;font-weight:bold'
  );
})();

/* ─────────────────────────────────────────────────────────────────────────
 * ONE-LINER — paste this into the console:
 *
(async()=>{const[{Readability},{default:TurndownService},{gfm}]=await Promise.all([import('https://esm.sh/@mozilla/readability'),import('https://esm.sh/turndown'),import('https://esm.sh/turndown-plugin-gfm')]);const NC=new Set(['SCRIPT','STYLE','NOSCRIPT','SVG','IFRAME','FORM','BUTTON','INPUT','TEXTAREA','SELECT']);const lt=e=>{const ps=[];(function w(n){for(const c of n.childNodes){if(c.nodeType===3){const t=(c.textContent||'').replace(/\s+/g,' ').trim();if(t)ps.push(t)}else if(c.nodeType===1&&!NC.has(c.tagName)){w(c)}}})(e);return ps.join(' • ')};const dl=r=>{const cs=[];const cm=new Set();for(const p of r.querySelectorAll('*')){if(cm.has(p))continue;const ch=Array.from(p.children);if(ch.length<3)continue;const g=new Map();for(const c of ch){const sg=c.tagName+'|'+Array.from(c.classList).sort().join(' ');if(g.has(sg))g.get(sg).push(c);else g.set(sg,[c])}for(const it of g.values()){if(it.length<3)continue;if(!it.every(x=>x.querySelector('*')))continue;const bs=it.map(lt).filter(b=>b);if(bs.length<3)continue;cs.push({markdown:bs.map(b=>'- '+b).join('\n'),nodes:it});for(const x of it){cm.add(x);for(const d of x.querySelectorAll('*'))cm.add(d)}}}return cs};const sl=r=>{const doc=r.ownerDocument||r;return dl(r).map((c,i)=>{const tk='⟦LIST'+i+'⟧';const f=c.nodes[0];const p=doc.createElement('p');p.textContent=tk;f.parentNode.insertBefore(p,f);c.nodes.forEach(n=>n.remove());return{token:tk,markdown:c.markdown}})};const al=(b,ls)=>{let o=b;const ex=[];for(const{token:tk,markdown:m}of ls){if(o.includes(tk))o=o.split(tk).join(m);else ex.push(m)}return ex.length?o.trimEnd()+'\n\n'+ex.join('\n\n'):o};const dc=document.cloneNode(true);const ls=sl(dc);const a=new Readability(dc).parse();if((!a||!a.content)&&ls.length===0)return alert('html-strip: no main content found on this page');const td=new TurndownService({headingStyle:'atx',codeBlockStyle:'fenced'});td.remove(['script','style','noscript','svg','iframe','form','button','input','textarea','select']);td.use(gfm);td.addRule('ht',{filter:n=>n.nodeName==='TABLE'&&!n.querySelector('th'),replacement:(c,n)=>{const rs=Array.from(n.rows||[]);if(!rs.length)return '';const rc=rs.map(r=>Array.from(r.cells||[]).map(x=>(x.textContent||'').trim().replace(/\s+/g,' ').replace(/\|/g,'\\|')));const w=Math.max(...rc.map(c=>c.length));const ln=c=>{const p=c.slice();while(p.length<w)p.push('');return '| '+p.join(' | ')+' |'};const sp='| '+Array(w).fill('---').join(' | ')+' |';const[h,...b]=rc;return '\n\n'+[ln(h),sp,...b.map(ln)].join('\n')+'\n\n'}});const h=[];const ti=(a&&a.title)||document.title;if(ti)h.push('# '+ti);h.push('Source: '+location.href);if(a&&a.byline)h.push('Author: '+a.byline);if(a&&a.publishedTime)h.push('Date: '+a.publishedTime);if(a&&a.siteName)h.push('Site: '+a.siteName);const bm=a&&a.content?td.turndown(a.content).trim():'';const md=h.join('\n')+'\n\n'+al(bm,ls)+'\n';const ta=document.createElement('textarea');ta.value=md;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();console.log('%chtml-strip: copied '+md.length+' chars to clipboard ✓','color:#0a0;font-weight:bold');})();
 *
 * ─────────────────────────────────────────────────────────────────────────
 * BOOKMARKLET — save as a bookmark whose URL is the line below, then click it
 * on any page:
 *
javascript:(async()=>{const[{Readability},{default:TurndownService},{gfm}]=await Promise.all([import('https://esm.sh/@mozilla/readability'),import('https://esm.sh/turndown'),import('https://esm.sh/turndown-plugin-gfm')]);const NC=new Set(['SCRIPT','STYLE','NOSCRIPT','SVG','IFRAME','FORM','BUTTON','INPUT','TEXTAREA','SELECT']);const lt=e=>{const ps=[];(function w(n){for(const c of n.childNodes){if(c.nodeType===3){const t=(c.textContent||'').replace(/\s+/g,' ').trim();if(t)ps.push(t)}else if(c.nodeType===1&&!NC.has(c.tagName)){w(c)}}})(e);return ps.join(' • ')};const dl=r=>{const cs=[];const cm=new Set();for(const p of r.querySelectorAll('*')){if(cm.has(p))continue;const ch=Array.from(p.children);if(ch.length<3)continue;const g=new Map();for(const c of ch){const sg=c.tagName+'|'+Array.from(c.classList).sort().join(' ');if(g.has(sg))g.get(sg).push(c);else g.set(sg,[c])}for(const it of g.values()){if(it.length<3)continue;if(!it.every(x=>x.querySelector('*')))continue;const bs=it.map(lt).filter(b=>b);if(bs.length<3)continue;cs.push({markdown:bs.map(b=>'- '+b).join('\n'),nodes:it});for(const x of it){cm.add(x);for(const d of x.querySelectorAll('*'))cm.add(d)}}}return cs};const sl=r=>{const doc=r.ownerDocument||r;return dl(r).map((c,i)=>{const tk='⟦LIST'+i+'⟧';const f=c.nodes[0];const p=doc.createElement('p');p.textContent=tk;f.parentNode.insertBefore(p,f);c.nodes.forEach(n=>n.remove());return{token:tk,markdown:c.markdown}})};const al=(b,ls)=>{let o=b;const ex=[];for(const{token:tk,markdown:m}of ls){if(o.includes(tk))o=o.split(tk).join(m);else ex.push(m)}return ex.length?o.trimEnd()+'\n\n'+ex.join('\n\n'):o};const dc=document.cloneNode(true);const ls=sl(dc);const a=new Readability(dc).parse();if((!a||!a.content)&&ls.length===0)return alert('html-strip: no main content found on this page');const td=new TurndownService({headingStyle:'atx',codeBlockStyle:'fenced'});td.remove(['script','style','noscript','svg','iframe','form','button','input','textarea','select']);td.use(gfm);td.addRule('ht',{filter:n=>n.nodeName==='TABLE'&&!n.querySelector('th'),replacement:(c,n)=>{const rs=Array.from(n.rows||[]);if(!rs.length)return '';const rc=rs.map(r=>Array.from(r.cells||[]).map(x=>(x.textContent||'').trim().replace(/\s+/g,' ').replace(/\|/g,'\\|')));const w=Math.max(...rc.map(c=>c.length));const ln=c=>{const p=c.slice();while(p.length<w)p.push('');return '| '+p.join(' | ')+' |'};const sp='| '+Array(w).fill('---').join(' | ')+' |';const[h,...b]=rc;return '\n\n'+[ln(h),sp,...b.map(ln)].join('\n')+'\n\n'}});const h=[];const ti=(a&&a.title)||document.title;if(ti)h.push('# '+ti);h.push('Source: '+location.href);if(a&&a.byline)h.push('Author: '+a.byline);if(a&&a.publishedTime)h.push('Date: '+a.publishedTime);if(a&&a.siteName)h.push('Site: '+a.siteName);const bm=a&&a.content?td.turndown(a.content).trim():'';const md=h.join('\n')+'\n\n'+al(bm,ls)+'\n';const ta=document.createElement('textarea');ta.value=md;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();alert('html-strip: copied '+md.length+' chars ✓');})();
 * ───────────────────────────────────────────────────────────────────────── */
