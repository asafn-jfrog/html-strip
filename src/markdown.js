export function buildMetadataHeader(article, url) {
  const lines = [];
  if (article.title) lines.push(`# ${article.title}`);
  lines.push(`Source: ${url}`);
  if (article.byline) lines.push(`Author: ${article.byline}`);
  if (article.publishedTime) lines.push(`Date: ${article.publishedTime}`);
  if (article.siteName) lines.push(`Site: ${article.siteName}`);
  return lines.join('\n');
}

export function assembleOutput(header, body) {
  return `${header}\n\n${body.trim()}\n`;
}

// Re-insert recovered repetitive lists into the converted Markdown. Tokens that
// survived Readability + Turndown are replaced in place; tokens Readability
// discarded (their region was dropped) have their lists appended at the end so
// nothing is ever lost.
export function applyLists(body, lists) {
  if (!lists || lists.length === 0) return body;
  let result = body;
  const leftover = [];
  for (const { token, markdown } of lists) {
    if (result.includes(token)) {
      result = result.split(token).join(markdown);
    } else {
      leftover.push(markdown);
    }
  }
  if (leftover.length > 0) {
    result = `${result.trimEnd()}\n\n${leftover.join('\n\n')}`;
  }
  return result;
}
