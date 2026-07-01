# html-strip Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Manifest V3 Chrome extension that, on one click, extracts the current page's main content as LLM-ready Markdown, shows it in a popup, and copies it to the clipboard.

**Architecture:** The popup uses `chrome.scripting.executeScript` to inject Mozilla Readability into the active tab and run an extraction function that returns the article HTML plus metadata. The popup converts that HTML to Markdown with Turndown, prepends a metadata header, renders it in a textarea, and offers a Copy button. Pure logic lives in small `src/` ES modules that are unit-tested with Node's built-in test runner; vendored libraries load as browser globals.

**Tech Stack:** Chrome MV3, vanilla JS (ES modules), `@mozilla/readability` (vendored), `turndown` (vendored), `node --test` for tests.

## Global Constraints

- Manifest V3. Permissions: `activeTab`, `scripting` only. No `host_permissions`.
- Output format: **Markdown**, main-content only (Readability).
- Metadata header prepended: title, source URL, author (byline), date (publishedTime), site name — each only when present.
- No build/bundler step. Popup loads `popup.js` as `<script type="module">`; vendor libs load as classic `<script>` globals.
- Vendored libraries are MIT-licensed, copied verbatim into `vendor/`.
- `package.json` has `"type": "module"`. Tests run with `node --test`.
- No custom icons (Chrome uses its default icon for unpacked extensions).
- All commits use conventional-commit prefixes.

---

### Task 1: Project scaffold and vendored dependencies

**Files:**
- Create: `package.json`
- Create: `vendor/readability.js` (copied)
- Create: `vendor/turndown.js` (copied)
- Modify: `.gitignore` (already contains `.DS_Store` and `node_modules/` — verify)

**Interfaces:**
- Produces: browser global `Readability` (function) from `vendor/readability.js`; browser global `TurndownService` (class) from `vendor/turndown.js`. Node dev dependency `turndown` (default export = `TurndownService` class) available for tests.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "html-strip",
  "version": "1.0.0",
  "type": "module",
  "private": true,
  "description": "Extract clean, LLM-ready Markdown from the current page.",
  "scripts": {
    "test": "node --test",
    "vendor": "node scripts/vendor.js"
  },
  "devDependencies": {
    "@mozilla/readability": "^0.5.0",
    "turndown": "^7.2.0"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run: `cd /Users/asafn/Desktop/dev_projects/html-strip && npm install`
Expected: `node_modules/` created with `@mozilla/readability` and `turndown`.

- [ ] **Step 3: Identify the exact vendor source paths**

Run: `ls node_modules/@mozilla/readability/Readability.js node_modules/turndown/lib/`
Expected: `Readability.js` exists; the `lib/` listing includes a browser UMD build named `turndown.browser.umd.js`. If the UMD filename differs in the installed version, use whichever file in that listing ends in `.browser.umd.js`.

- [ ] **Step 4: Create the vendor copy script**

Create `scripts/vendor.js`:

```js
import { copyFileSync, mkdirSync } from 'node:fs';

mkdirSync('vendor', { recursive: true });
copyFileSync(
  'node_modules/@mozilla/readability/Readability.js',
  'vendor/readability.js'
);
copyFileSync(
  'node_modules/turndown/lib/turndown.browser.umd.js',
  'vendor/turndown.js'
);
console.log('Vendored readability.js and turndown.js into vendor/');
```

- [ ] **Step 5: Run the vendor script**

Run: `npm run vendor`
Expected: prints the success line; `vendor/readability.js` and `vendor/turndown.js` now exist.

- [ ] **Step 6: Verify the vendored globals are well-formed**

Run: `grep -c "function Readability" vendor/readability.js && grep -c "TurndownService" vendor/turndown.js`
Expected: both counts are `>= 1` (non-zero), confirming the expected global symbols are present.

- [ ] **Step 7: Verify `.gitignore`**

Run: `cat .gitignore`
Expected: contains `.DS_Store` and `node_modules/`. If `node_modules/` is missing, append it. `vendor/` must NOT be ignored — it is committed.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json scripts/vendor.js vendor/ .gitignore
git commit -m "chore: scaffold project and vendor readability + turndown"
```

---

### Task 2: Metadata header module (pure logic, TDD)

**Files:**
- Create: `src/markdown.js`
- Test: `tests/markdown.test.js`

**Interfaces:**
- Produces:
  - `buildMetadataHeader(article, url) -> string` where `article` is `{ title?, byline?, publishedTime?, siteName? }`. Returns newline-joined header lines.
  - `assembleOutput(header, body) -> string`. Returns `` `${header}\n\n${body.trim()}\n` ``.

- [ ] **Step 1: Write the failing tests**

Create `tests/markdown.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMetadataHeader, assembleOutput } from '../src/markdown.js';

test('buildMetadataHeader includes all present fields in order', () => {
  const header = buildMetadataHeader(
    {
      title: 'My Article',
      byline: 'Jane Doe',
      publishedTime: '2026-06-30',
      siteName: 'Example',
    },
    'https://example.com/a'
  );
  assert.equal(
    header,
    '# My Article\nSource: https://example.com/a\nAuthor: Jane Doe\nDate: 2026-06-30\nSite: Example'
  );
});

test('buildMetadataHeader omits absent optional fields', () => {
  const header = buildMetadataHeader({ title: 'Only Title' }, 'https://x.com');
  assert.equal(header, '# Only Title\nSource: https://x.com');
});

test('buildMetadataHeader always includes Source even with empty article', () => {
  const header = buildMetadataHeader({}, 'https://x.com');
  assert.equal(header, 'Source: https://x.com');
});

test('assembleOutput trims body and adds spacing + trailing newline', () => {
  const out = assembleOutput('# H\nSource: u', '  body text  ');
  assert.equal(out, '# H\nSource: u\n\nbody text\n');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Cannot find module '../src/markdown.js'`.

- [ ] **Step 3: Write the minimal implementation**

Create `src/markdown.js`:

```js
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all 4 tests in `markdown.test.js` pass.

- [ ] **Step 5: Commit**

```bash
git add src/markdown.js tests/markdown.test.js
git commit -m "feat: add markdown metadata header and output assembly"
```

---

### Task 3: HTML-to-Markdown conversion module (TDD)

**Files:**
- Create: `src/convert.js`
- Test: `tests/convert.test.js`

**Interfaces:**
- Consumes: `TurndownService` class (injected as a parameter — browser global in the popup, npm default export in tests).
- Produces: `htmlToMarkdown(TurndownService, html) -> string`. Configures Turndown with `headingStyle: 'atx'` and `codeBlockStyle: 'fenced'`, then converts.

- [ ] **Step 1: Write the failing tests**

Create `tests/convert.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import TurndownService from 'turndown';
import { htmlToMarkdown } from '../src/convert.js';

test('converts headings using atx style', () => {
  const md = htmlToMarkdown(TurndownService, '<h2>Hello</h2>');
  assert.equal(md, '## Hello');
});

test('preserves links', () => {
  const md = htmlToMarkdown(
    TurndownService,
    '<p>See <a href="https://x.com">this</a>.</p>'
  );
  assert.equal(md, 'See [this](https://x.com).');
});

test('uses fenced code blocks', () => {
  const md = htmlToMarkdown(
    TurndownService,
    '<pre><code>const x = 1;</code></pre>'
  );
  assert.ok(md.includes('```'), `expected fenced code block, got: ${md}`);
  assert.ok(md.includes('const x = 1;'));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Cannot find module '../src/convert.js'`.

- [ ] **Step 3: Write the minimal implementation**

Create `src/convert.js`:

```js
export function htmlToMarkdown(TurndownService, html) {
  const service = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
  });
  return service.turndown(html);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all tests in `convert.test.js` and `markdown.test.js` pass.

- [ ] **Step 5: Commit**

```bash
git add src/convert.js tests/convert.test.js
git commit -m "feat: add html-to-markdown conversion"
```

---

### Task 4: Page extraction function

**Files:**
- Create: `src/extractor.js`

**Interfaces:**
- Consumes: page globals `document` and `Readability` (the latter injected into the tab in Task 6 before this function runs).
- Produces: `extractArticle() -> { ok: true, title, byline, publishedTime, siteName, content } | { ok: false, reason }`. This function is serialized by `chrome.scripting.executeScript` and executed in the page context, so its body may reference ONLY page globals — never module-scope imports.

- [ ] **Step 1: Create the extractor module**

Create `src/extractor.js`:

```js
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
```

- [ ] **Step 2: Verify it parses as a module**

Run: `node --check src/extractor.js`
Expected: no output, exit code 0 (syntax valid).

- [ ] **Step 3: Commit**

```bash
git add src/extractor.js
git commit -m "feat: add page article extractor"
```

---

### Task 5: Manifest and popup UI

**Files:**
- Create: `manifest.json`
- Create: `popup.html`
- Create: `popup.css`

**Interfaces:**
- Produces: DOM elements with ids `status`, `output` (a `<textarea>`), and `copy` (a `<button>`), consumed by `popup.js` in Task 6. Loads `vendor/turndown.js` (classic) then `popup.js` (module).

- [ ] **Step 1: Create `manifest.json`**

```json
{
  "manifest_version": 3,
  "name": "html-strip",
  "version": "1.0.0",
  "description": "Extract clean, LLM-ready Markdown from the current page.",
  "permissions": ["activeTab", "scripting"],
  "action": {
    "default_popup": "popup.html",
    "default_title": "Strip page to Markdown"
  }
}
```

- [ ] **Step 2: Create `popup.html`**

```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <link rel="stylesheet" href="popup.css" />
  </head>
  <body>
    <div id="status">Extracting…</div>
    <textarea id="output" readonly placeholder="Cleaned Markdown will appear here."></textarea>
    <button id="copy" disabled>Copy</button>
    <script src="vendor/turndown.js"></script>
    <script type="module" src="popup.js"></script>
  </body>
</html>
```

- [ ] **Step 3: Create `popup.css`**

```css
body {
  width: 420px;
  margin: 0;
  padding: 10px;
  font-family: system-ui, sans-serif;
  box-sizing: border-box;
}

#status {
  font-size: 12px;
  color: #555;
  margin-bottom: 6px;
}

#output {
  width: 100%;
  height: 360px;
  box-sizing: border-box;
  font-family: ui-monospace, monospace;
  font-size: 12px;
  resize: vertical;
  white-space: pre;
}

#copy {
  margin-top: 8px;
  width: 100%;
  padding: 8px;
  font-size: 13px;
  cursor: pointer;
}

#copy:disabled {
  cursor: default;
  opacity: 0.5;
}
```

- [ ] **Step 4: Validate the manifest is valid JSON**

Run: `node -e "JSON.parse(require('node:fs').readFileSync('manifest.json','utf8')); console.log('valid')"`
Expected: prints `valid`.

- [ ] **Step 5: Commit**

```bash
git add manifest.json popup.html popup.css
git commit -m "feat: add manifest and popup UI"
```

---

### Task 6: Popup orchestration and end-to-end verification

**Files:**
- Create: `popup.js`

**Interfaces:**
- Consumes: `extractArticle` (Task 4), `htmlToMarkdown` (Task 3), `buildMetadataHeader` + `assembleOutput` (Task 2); DOM ids `status`/`output`/`copy` (Task 5); browser global `window.TurndownService` (Task 1 vendor); Chrome APIs `chrome.tabs`, `chrome.scripting`.

- [ ] **Step 1: Create `popup.js`**

```js
import { extractArticle } from './src/extractor.js';
import { htmlToMarkdown } from './src/convert.js';
import { buildMetadataHeader, assembleOutput } from './src/markdown.js';

const statusEl = document.getElementById('status');
const outputEl = document.getElementById('output');
const copyEl = document.getElementById('copy');

function fail(message) {
  statusEl.textContent = message;
  copyEl.disabled = true;
}

function render(text) {
  outputEl.value = text;
  statusEl.textContent = 'Ready';
  copyEl.disabled = false;
}

async function main() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id || !/^https?:/.test(tab.url ?? '')) {
    fail("This page can't be read by the extension.");
    return;
  }
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['vendor/readability.js'],
    });
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractArticle,
    });
    if (!result || !result.ok) {
      fail("Couldn't find main content on this page.");
      return;
    }
    const body = htmlToMarkdown(window.TurndownService, result.content);
    const header = buildMetadataHeader(result, tab.url);
    render(assembleOutput(header, body));
  } catch (e) {
    fail("This page can't be read by the extension.");
  }
}

copyEl.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(outputEl.value);
    statusEl.textContent = 'Copied!';
  } catch {
    statusEl.textContent = 'Copy failed — select the text and copy manually.';
    outputEl.select();
  }
});

main();
```

- [ ] **Step 2: Verify the module parses**

Run: `node --check popup.js`
Expected: no output, exit code 0.

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: PASS — all tests from Tasks 2 and 3 pass.

- [ ] **Step 4: Manual load in Chrome**

1. Open `chrome://extensions`.
2. Enable "Developer mode" (top-right toggle).
3. Click "Load unpacked" and select `/Users/asafn/Desktop/dev_projects/html-strip`.
Expected: the extension loads with no manifest errors.

- [ ] **Step 5: Manual end-to-end test on an article**

1. Navigate to a real article page (e.g. a news article or blog post).
2. Click the html-strip toolbar icon.
Expected: the popup shows Markdown starting with `# <article title>` and `Source: <url>`, followed by the article body as Markdown. Status reads "Ready".

- [ ] **Step 6: Manual test the Copy button**

Click "Copy".
Expected: status changes to "Copied!"; pasting into a text field yields the full Markdown.

- [ ] **Step 7: Manual test error paths**

1. Open a `chrome://` page (e.g. `chrome://settings`), click the icon.
   Expected: status reads "This page can't be read by the extension."
2. Open a page with no article content (e.g. a search-engine results page), click the icon.
   Expected: status reads "Couldn't find main content on this page."

- [ ] **Step 8: Commit**

```bash
git add popup.js
git commit -m "feat: wire up popup orchestration and copy"
```

---

## Self-Review Notes

- **Spec coverage:** one-click toolbar → Task 5/6; Markdown output → Task 3; main-content only → Task 4 (Readability); metadata header → Task 2; show in popup + Copy → Tasks 5/6; error handling (no article / unscriptable page / copy failure) → Task 6 steps 1, 7. All spec sections covered.
- **Deviations from spec (approved):** pure logic split into `src/` modules for testability; `extractor.js` lives under `src/` rather than repo root; custom icons omitted (Chrome default icon used).
- **Type consistency:** `extractArticle` returns `{ ok, title, byline, publishedTime, siteName, content }`; `buildMetadataHeader` reads exactly those optional fields; `htmlToMarkdown(TurndownService, html)` signature matches both the test call and the popup call. Consistent across tasks.
