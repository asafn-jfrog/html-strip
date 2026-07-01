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
