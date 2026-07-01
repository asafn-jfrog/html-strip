// Interactive / embedded elements that carry no readable content. Removed
// before conversion so dynamic app pages (dashboards, SPAs) don't leak
// widget markup or hidden-panel text into the Markdown.
const NON_CONTENT_TAGS = [
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
];

function cellText(cell) {
  return (cell.textContent || '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\|/g, '\\|');
}

// turndown-plugin-gfm only converts tables that have a heading row (<th>/
// <thead>); it keeps headerless tables (e.g. key/value layout tables) as raw
// HTML. This rule converts those too — using the first row as the header — so
// no raw <table> markup ever leaks into the output.
function headerlessTableRule() {
  return {
    filter: (node) =>
      node.nodeName === 'TABLE' && !node.querySelector('th'),
    replacement: (_content, node) => {
      const rows = Array.from(node.rows || []);
      if (rows.length === 0) return '';
      const rowCells = rows.map((row) =>
        Array.from(row.cells || []).map(cellText)
      );
      const width = Math.max(...rowCells.map((cells) => cells.length));
      const line = (cells) => {
        const padded = cells.slice();
        while (padded.length < width) padded.push('');
        return `| ${padded.join(' | ')} |`;
      };
      const separator = `| ${Array(width).fill('---').join(' | ')} |`;
      const [header, ...body] = rowCells;
      return `\n\n${[line(header), separator, ...body.map(line)].join('\n')}\n\n`;
    },
  };
}

/**
 * Convert article HTML to Markdown.
 *
 * @param {new (options?: object) => { use: Function, remove: Function, addRule: Function, turndown: (html: string) => string }} TurndownService
 *   The Turndown constructor (browser global in the popup, npm import in tests).
 * @param {string} html - The article HTML to convert.
 * @param {Function} [gfmPlugin] - Optional turndown-plugin-gfm `gfm` plugin,
 *   enabling GitHub-flavored Markdown tables, strikethrough, and task lists.
 * @returns {string} The Markdown output.
 */
export function htmlToMarkdown(TurndownService, html, gfmPlugin) {
  const service = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
  });
  service.remove(NON_CONTENT_TAGS);
  if (gfmPlugin) {
    service.use(gfmPlugin);
  }
  // Added after the gfm plugin so headerless tables are converted here rather
  // than falling through to the plugin's keep-as-raw-HTML behavior.
  service.addRule('headerlessTable', headerlessTableRule());
  return service.turndown(html);
}
