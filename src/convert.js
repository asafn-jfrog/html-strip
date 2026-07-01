export function htmlToMarkdown(TurndownService, html) {
  const service = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
  });
  return service.turndown(html);
}
