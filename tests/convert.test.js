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
