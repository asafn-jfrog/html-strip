// NOTE: This function is stringified by chrome.scripting.executeScript and
// runs in the page context. It may only use page globals (document,
// Readability), never imports from this module's scope.
export function extractArticle() {
  try {
    const docClone = document.cloneNode(true);
    const article = new Readability(docClone).parse();
    if (!article || !article.content) {
      return { ok: false, reason: 'no-content' };
    }
    return {
      ok: true,
      title: article.title,
      byline: article.byline,
      publishedTime: article.publishedTime,
      siteName: article.siteName,
      content: article.content,
    };
  } catch (e) {
    return { ok: false, reason: 'error' };
  }
}
