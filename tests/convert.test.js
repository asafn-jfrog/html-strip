import { test } from 'node:test';
import assert from 'node:assert/strict';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
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

test('converts tables to Markdown pipe tables with the gfm plugin', () => {
  const md = htmlToMarkdown(
    TurndownService,
    '<table><thead><tr><th>CVE</th><th>Package</th></tr></thead>' +
      '<tbody><tr><td>CVE-1</td><td>aiohttp</td></tr></tbody></table>',
    gfm
  );
  assert.equal(
    md,
    '| CVE | Package |\n| --- | --- |\n| CVE-1 | aiohttp |'
  );
});

test('drops non-content elements (scripts, forms, svg) instead of leaking markup', () => {
  const md = htmlToMarkdown(
    TurndownService,
    '<p>Keep this.</p>' +
      '<script>evil()</script>' +
      '<svg xmlns="http://www.w3.org/2000/svg"><path d="M13"/></svg>' +
      '<form><label>Name</label><input type="text"><button>Go</button></form>'
  );
  assert.equal(md, 'Keep this.');
});
