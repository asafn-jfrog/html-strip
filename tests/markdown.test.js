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
