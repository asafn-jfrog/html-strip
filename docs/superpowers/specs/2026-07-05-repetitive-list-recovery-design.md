# Repetitive-list recovery — design

Date: 2026-07-05

## Problem

html-strip runs Mozilla Readability to extract a page's "article" content, then
converts it to Markdown with Turndown. Readability is built for prose articles:
it discards regions it scores as clutter/navigation — including **repeated card
grids**, which on listing pages are the actual valuable content.

Concrete case: a Vivid Seats event page is a grid of ~25 ticket-listing cards
(section / row / ticket count / deal score / price), each a sibling `<a>` with
identical structure. Readability deletes that whole column in favor of the
lower-value FAQ prose. The few fragments that leak through arrive as
structureless loose text (`$232`, `$186`, `Lower Level 109`, `8`, `$260`, …)
because they are nested `<div>`/`<span>` with no list or table semantics.

Goal: **detect repeated sibling structures on the full page DOM (before
Readability removes them), recover each as a clean Markdown bullet list, and
re-insert it in its original lexical position where possible.**

## Non-goals

- Column-aligned tables. Each card renders as a single bullet line (text
  fragments joined). No per-field column schema — the tool is generic and cannot
  know a card's fields.
- Site-specific extraction (no hardcoded "section/row/price" logic).
- Preserving position for clusters whose entire surrounding region Readability
  discards — that position no longer exists after extraction (see fallback).

## Pipeline context

The extension splits work across two execution contexts:

- **Page context** (`src/extractor.js`, `console-snippet.js`): clones the
  document and runs `Readability.parse()`. Has the live DOM + Readability.
- **Popup context** (`popup.js` + `src/convert.js`): runs Turndown on the HTML
  string Readability returned.

Therefore detection must run **in the page context, on the clone, before
`Readability.parse()`** — that is the only place the repeated cards still exist.

Turndown ships `@mixmark-io/domino` as a dependency, already present in
`node_modules`, giving tests a DOM to parse HTML with — no new dependency.

## Architecture

### 1. `src/repetitive-lists.js` (new, pure, DOM-agnostic)

Single export: `detectRepetitiveLists(root)`, operating on any DOM
element/document (real `document` in the page; a domino-parsed doc in tests).

**Cluster detection**

- Walk elements top-down. For any element with **≥3 direct child elements
  sharing a structure signature**, that group of matching children is a cluster.
- **Signature** = `tagName + '|' + sortedClassList.join(' ')`. CSS-module hashes
  are stable within a single page render, so identical cards match exactly.
  Interspersed non-matching siblings (e.g. `scroll-here-ref`,
  `intersection-observer-ref`) simply do not join the group.
- **Precision guard**: an item qualifies only if it is **structurally
  non-trivial** — it contains nested element structure (has descendant
  elements). This keeps ordinary prose `<ul><li>text</li></ul>` and flat
  nav-link rows in Readability's normal flow; only complex repeated cards are
  re-homed.
- **Outermost-only**: once a cluster is claimed, skip its descendants so nested
  repeats are not double-counted.

**Rendering**

- For each item, collect visible **leaf-text fragments** in document order:
  text nodes, trimmed and whitespace-collapsed, skipping non-content subtrees
  (`script`, `style`, `noscript`, `svg`, `iframe`, `form`, `button`, `input`,
  `textarea`, `select`), dropping empty strings.
- Join fragments with `' • '`. Each item → one bullet line `- <joined>`.
- The cluster → a Markdown bulleted list (items separated by newlines).

Example item output:
`- Balcony Level 317 • Row 12X • 2 tickets • Lowest Price in Section • 7.8 • Very Good • $181`

**Return shape**

```
{ clusters: [ { markdown: string, nodes: Element[] } ] }
```

`markdown` is the finished bullet list; `nodes` are the item elements to remove
from the DOM.

### 2. Re-insertion: placeholder + append fallback

Detection alone loses position because Readability rebuilds the article DOM. To
keep lists in their original lexical area:

In `src/extractor.js` and `console-snippet.js`, on the clone, **before**
`Readability.parse()`:

1. `detectRepetitiveLists(clone)` → clusters.
2. For each cluster, insert a sentinel `<p>⟦LIST_n⟧</p>` at the position of the
   cluster's first node, then remove the cluster's nodes. (`n` is the cluster
   index; the token uses U+27E6 / U+27E7 math brackets to avoid colliding with
   page text.)
3. `Readability.parse()` on the clone, then Turndown (existing flow).
4. In the final Markdown, replace each **surviving** `⟦LIST_n⟧` token with that
   cluster's `markdown` — **in place**.
5. Any token Readability discarded (it nuked the whole region) → its list is
   **appended at the end**, so no cluster is ever lost.

Outcome:
- Cluster inside content Readability keeps → rendered **in place**.
- Cluster in a region Readability fully discards (the Vivid Seats case) → the
  isolated sentinel `<p>` is stripped with the region → list **appended at end**.

### 3. Wiring

- `src/extractor.js`: performs detect → sentinel-swap → Readability. Returns
  `{ ..., lists: [ { token: string, markdown: string } ] }` alongside `content`.
- `src/markdown.js`: gains the token-replace + append-fallback logic (pure,
  operates on the converted body string + the `lists` array), so it is unit
  testable without a browser.
- `popup.js`: passes `result.lists` through to the markdown assembly.
- `console-snippet.js`: mirrors the same detect → swap → replace/append inline
  (self-contained; the readable source plus the minified one-liner and
  bookmarklet copies at the bottom of the file all updated to match).

**Default rendering:** no synthetic heading — lists render as plain bullets
where the token sat, or at the end for the fallback. A `## Lists` heading can be
added later if desired.

## Testing

`tests/repetitive-lists.test.js`, parsing HTML via `@mixmark-io/domino`:

- Vivid Seats card sample → one bullet per card; each bullet contains section,
  row, and price text.
- A group of only 2 similar siblings → **not** detected (below the ≥3 threshold).
- A plain prose `<ul><li>text</li></ul>` → **not** detected (precision guard).
- Nested repeated structures → **outermost** cluster only.
- `script`/`svg` inside a card → excluded from the bullet text.

`tests/markdown.test.js` (extend): token-replace behavior —
- A body containing a surviving `⟦LIST_0⟧` token → replaced in place.
- A `lists` entry whose token is absent from the body → appended at the end.

## Known tradeoffs

- With the ≥3 rule, genuinely repeated *card-like* grids anywhere on the page
  (including footer/related-item rows that are structurally rich) may be
  re-homed as bullets. The precision guard prevents this from touching normal
  prose/nav lists.
- Position preservation is best-effort: it succeeds only when Readability keeps
  the cluster's surrounding region. For fully discarded regions there is no
  anchor, so those lists append at the end — still strictly better than the
  current behavior of losing them entirely.
