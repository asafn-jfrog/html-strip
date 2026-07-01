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
copyFileSync(
  'node_modules/turndown-plugin-gfm/dist/turndown-plugin-gfm.js',
  'vendor/turndown-plugin-gfm.js'
);
console.log(
  'Vendored readability.js, turndown.js, and turndown-plugin-gfm.js into vendor/'
);
