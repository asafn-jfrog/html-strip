import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

mkdirSync('vendor', { recursive: true });
copyFileSync(
  'node_modules/@mozilla/readability/Readability.js',
  'vendor/readability.js'
);
copyFileSync(
  'node_modules/turndown/lib/turndown.browser.umd.js',
  'vendor/turndown.js'
);
copyFileSync(
  'node_modules/turndown-plugin-gfm/dist/turndown-plugin-gfm.js',
  'vendor/turndown-plugin-gfm.js'
);

// Generate a classic-script copy of the detector for injection into the page.
// The source is an ES module; the page needs a plain script, so strip the
// `export` keywords. The module's `if (typeof window !== 'undefined')` block
// then attaches the functions to the page's window.
mkdirSync('page', { recursive: true });
const detectorSource = readFileSync('src/repetitive-lists.js', 'utf8');
writeFileSync(
  'page/detect-clusters.js',
  detectorSource.replace(/^export /gm, '')
);

console.log(
  'Vendored readability.js, turndown.js, turndown-plugin-gfm.js, and ' +
    'generated page/detect-clusters.js'
);
