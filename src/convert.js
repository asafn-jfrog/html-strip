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

/**
 * Convert article HTML to Markdown.
 *
 * @param {new (options?: object) => { use: Function, remove: Function, turndown: (html: string) => string }} TurndownService
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
  return service.turndown(html);
}
