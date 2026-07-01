# html-strip — Chrome Extension Design

**Date:** 2026-07-01

## Overview

A Manifest V3 Chrome extension. The user clicks the toolbar icon; a popup opens,
extracts the main content of the current page, converts it to Markdown with a
metadata header, displays it, and offers a Copy button. The goal is one-click,
LLM-ready page content — no HTML tags, CSS, scripts, nav, ads, or footers.

## Requirements

- One-click extraction from the active tab via the toolbar icon.
- Output format: **Markdown** (preserves headings, lists, links, bold, code, tables).
- Extraction: **main-content only** via a proven readability algorithm — drop
  nav, ads, footers, sidebars, cookie banners.
- Prepend a **metadata header**: page title, source URL, and author/date when available.
- Display the result **in the popup** with a **Copy** button (one click → clipboard).

## Architecture & Data Flow

1. User clicks the toolbar icon → `popup.html` opens.
2. Popup runs `chrome.scripting.executeScript` against the active tab.
3. In the page context: inject vendored **Readability.js** (Mozilla reader-mode
   engine), run it on a clone of the document. Returns
   `{ title, byline, siteName, content (HTML) }`, dropping non-content regions.
4. Back in the popup: convert the returned article HTML → Markdown using vendored
   **Turndown**. Prepend a metadata header (`# Title`, `Source: URL`, author if present).
5. Display the Markdown in the popup, with a **Copy** button
   (`navigator.clipboard.writeText`).

## Components

| File | Purpose |
|------|---------|
| `manifest.json` | MV3 manifest. Permissions: `activeTab`, `scripting`. |
| `popup.html` / `popup.css` | UI: scrollable content area + Copy button + status line. |
| `popup.js` | Orchestrates: trigger extraction, run Turndown, build header, render, Copy. |
| `extractor.js` | Function injected into the page; runs Readability, returns the article object. |
| `vendor/readability.js` | Mozilla Readability (vendored, MIT). |
| `vendor/turndown.js` | Turndown HTML→Markdown (vendored, MIT). |
| `icons/` | Extension icons (16 / 48 / 128). |

## Libraries

- **@mozilla/readability** — main-content extraction (Firefox Reader View engine). MIT.
- **turndown** — HTML → Markdown conversion. MIT.

## Error Handling

- **No article found** (e.g. search results page): show *"Couldn't find main
  content on this page."* — no crash.
- **Page can't be scripted** (`chrome://`, Web Store, etc.): show *"This page
  can't be read by the extension."*
- **Copy failure**: fall back to *"select and copy manually."*

## Out of Scope (YAGNI)

- No "full page vs main content" toggle.
- No settings, history, or file download.
- Just the one-click show-in-popup + copy flow.
