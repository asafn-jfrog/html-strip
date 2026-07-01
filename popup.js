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
    const gfmPlugin = window.turndownPluginGfm && window.turndownPluginGfm.gfm;
    const body = htmlToMarkdown(window.TurndownService, result.content, gfmPlugin);
    const header = buildMetadataHeader(result, tab.url);
    render(assembleOutput(header, body));
  } catch {
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
