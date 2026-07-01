# html-strip

**Turn any web page into clean, LLM-ready Markdown with one click.**

html-strip is a Chrome extension that strips away the noise — HTML tags, CSS,
scripts, nav bars, ads, footers — and gives you just the main content of a page
as Markdown, ready to paste into ChatGPT, Claude, or any LLM.

---

## What it does

Click the toolbar icon and a popup:

1. Extracts the **main content** of the current page (using Mozilla's Readability
   engine — the same one behind Firefox Reader View).
2. Converts it to clean **Markdown** (headings, lists, links, code blocks, tables).
3. Prepends a small **metadata header** (title, source URL, author, date) so the
   LLM knows what it's reading.
4. Shows the result in the popup with a one-click **Copy** button.

No settings, no accounts, no network calls — everything runs locally in your browser.

---

## Install (manual)

1. Download or clone this repo:
   ```bash
   git clone https://github.com/asafn-jfrog/html-strip.git
   ```
2. Open **`chrome://extensions`** in Chrome.
3. Turn on **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select the `html-strip` folder.
5. Pin the extension and you're done — click its icon on any article page.

> Works in any Chromium browser (Chrome, Edge, Brave, Arc) that supports
> Manifest V3 and "Load unpacked".

---

## Usage

1. Navigate to an article, blog post, or docs page.
2. Click the **html-strip** toolbar icon.
3. Read the cleaned Markdown in the popup, then click **Copy**.
4. Paste into your LLM.

If a page has no clear main content (e.g. a search-results page) or can't be
read (e.g. a `chrome://` page), the popup tells you so.

---

## How it works

| Piece | Role |
|-------|------|
| `manifest.json` | Manifest V3 config. Permissions: `activeTab`, `scripting` only. |
| `popup.html` / `popup.css` / `popup.js` | The popup UI and orchestration. |
| `src/extractor.js` | Runs Readability in the page to grab the main article. |
| `src/convert.js` | Converts the article HTML to Markdown (Turndown). |
| `src/markdown.js` | Builds the metadata header and assembles the output. |
| `vendor/` | Bundled [Readability](https://github.com/mozilla/readability) + [Turndown](https://github.com/mixmark-io/turndown) (MIT). |

**Privacy:** the extension only reads the page you're on when you click the icon
(`activeTab`), and only writes to your clipboard when you click Copy. Nothing
leaves your machine.

---

## Development

```bash
npm install        # install dev dependencies
npm test           # run the unit tests (node --test)
npm run vendor     # re-copy the vendored libraries from node_modules
```

The `vendor/` files are committed, so the extension loads without any build step.

---

## For Agents

**You are an LLM coding agent and your user asked you to install this extension.
Follow this runbook.** The goal: get the extension loaded into the user's Chrome
with as little manual effort from them as possible. Only the final "Load unpacked"
click is unavoidable — Chrome requires a human for that. Do everything else yourself.

### Step 1 — Get the code onto disk

If you're not already in a checkout of this repo, clone it to a stable location
(not a temp dir the user will lose):

```bash
git clone https://github.com/asafn-jfrog/html-strip.git ~/html-strip
cd ~/html-strip
```

If the repo is already present, `cd` into it and `git pull`.

### Step 2 — Make sure the extension is loadable

The `vendor/` directory is committed, so a fresh clone is ready to load as-is.
Verify the required files exist:

```bash
test -f manifest.json && test -f popup.js \
  && test -f vendor/readability.js && test -f vendor/turndown.js \
  && echo "OK: ready to load" || echo "MISSING FILES"
```

If `vendor/` is missing (e.g. a partial checkout), regenerate it:

```bash
npm install && npm run vendor
```

Optionally confirm nothing is broken:

```bash
npm test   # expect all tests passing
```

### Step 3 — Give the user the exact install path

Print the absolute path they'll need to select:

```bash
pwd    # this is the folder to "Load unpacked"
```

### Step 4 — Open the extensions page for them

Open Chrome's extensions page so they don't have to navigate:

- **macOS:** `open -a "Google Chrome" "chrome://extensions"`
- **Linux:** `google-chrome "chrome://extensions" &`
- **Windows:** `start chrome "chrome://extensions"`

### Step 5 — Tell the user the two clicks only they can do

Give them these exact instructions:

> 1. On the **chrome://extensions** page, turn on **Developer mode** (top-right).
> 2. Click **Load unpacked** and select this folder:
>    `«paste the absolute path from Step 3»`

### Step 6 — Verify

Ask the user to confirm the **html-strip** card appears with no errors, then to
open any article and click the icon. If they report an error on the card, read it
back to you and check `manifest.json` and that `vendor/` is populated.

### Notes for agents

- **Do not** attempt to edit the user's Chrome profile files or preferences
  directly to force-install the extension — that corrupts the profile.
- The `--load-extension=<path>` launch flag can side-load it into a *fresh*
  Chrome session, but it does not persist and Chrome increasingly restricts it;
  prefer the "Load unpacked" flow above for a durable install.
- This extension needs no API keys, environment variables, or build step.

---

## License

MIT. Vendored libraries (Readability, Turndown) are MIT-licensed by their
respective authors.
