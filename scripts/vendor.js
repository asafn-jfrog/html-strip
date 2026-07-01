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
