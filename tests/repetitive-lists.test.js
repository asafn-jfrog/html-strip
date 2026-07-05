import { test } from 'node:test';
import assert from 'node:assert/strict';
import domino from '@mixmark-io/domino';
import { detectRepetitiveLists } from '../src/repetitive-lists.js';

function docFrom(html) {
  return domino.createDocument(html);
}

test('detects a group of 3+ structurally-rich similar siblings', () => {
  const doc = docFrom(
    '<div>' +
      '<a class="card"><span>Sec 1</span><b>$10</b></a>' +
      '<a class="card"><span>Sec 2</span><b>$20</b></a>' +
      '<a class="card"><span>Sec 3</span><b>$30</b></a>' +
      '</div>'
  );
  const { clusters } = detectRepetitiveLists(doc);
  assert.equal(clusters.length, 1);
  assert.equal(
    clusters[0].markdown,
    '- Sec 1 • $10\n- Sec 2 • $20\n- Sec 3 • $30'
  );
  assert.equal(clusters[0].nodes.length, 3);
});

test('ignores a group of only 2 similar siblings', () => {
  const doc = docFrom(
    '<div>' +
      '<a class="card"><span>A</span><b>1</b></a>' +
      '<a class="card"><span>B</span><b>2</b></a>' +
      '</div>'
  );
  assert.equal(detectRepetitiveLists(doc).clusters.length, 0);
});

test('ignores plain prose lists whose items lack nested structure', () => {
  const doc = docFrom('<ul><li>one</li><li>two</li><li>three</li></ul>');
  assert.equal(detectRepetitiveLists(doc).clusters.length, 0);
});

test('ignores a mixed list where only some items have nested structure', () => {
  const doc = docFrom(
    '<ul>' +
      '<li>one</li>' +
      '<li><span>two</span></li>' +
      '<li>three</li>' +
      '</ul>'
  );
  assert.equal(detectRepetitiveLists(doc).clusters.length, 0);
});

test('reports only the outermost cluster when clusters nest', () => {
  const inner =
    '<div class="row"><span>x</span><span>y</span><span>z</span></div>';
  const doc = docFrom(
    '<div>' +
      '<section class="card"><b>1</b>' + inner + '</section>' +
      '<section class="card"><b>2</b>' + inner + '</section>' +
      '<section class="card"><b>3</b>' + inner + '</section>' +
      '</div>'
  );
  const { clusters } = detectRepetitiveLists(doc);
  assert.equal(clusters.length, 1);
  assert.equal(clusters[0].nodes[0].tagName, 'SECTION');
});

test('excludes script/svg text from bullets', () => {
  const doc = docFrom(
    '<div>' +
      '<a class="card"><span>Keep</span><script>evil()</script><b>$1</b></a>' +
      '<a class="card"><span>Keep</span><svg><path/></svg><b>$2</b></a>' +
      '<a class="card"><span>Keep</span><b>$3</b></a>' +
      '</div>'
  );
  const { clusters } = detectRepetitiveLists(doc);
  assert.equal(clusters[0].markdown.includes('evil'), false);
  assert.equal(clusters[0].markdown, '- Keep • $1\n- Keep • $2\n- Keep • $3');
});
