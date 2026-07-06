// NOTE: This function is stringified by chrome.scripting.executeScript and
// runs in the page context. It may only use page globals (document,
// Readability, window.replaceClustersWithPlaceholders), never imports from
// this module's scope.
export function extractArticle() {
  try {
    const docClone = document.cloneNode(true);
    // Recover repeated card/list structures before Readability discards them,
    // swapping each for a sentinel <p> token so it can be re-inserted in place.
    const lists = window.replaceClustersWithPlaceholders(docClone);
    const article = new Readability(docClone).parse();
    if (!article || !article.content) {
      // A pure-listing page: no article prose, but recovered lists are the
      // content the user wants. Return them with an empty body.
      if (lists.length > 0) {
        return { ok: true, title: document.title, content: '', lists };
      }
      return { ok: false, reason: 'no-content' };
    }
    return {
      ok: true,
      title: article.title,
      byline: article.byline,
      publishedTime: article.publishedTime,
      siteName: article.siteName,
      content: article.content,
      lists,
    };
  } catch {
    return { ok: false, reason: 'error' };
  }
}
