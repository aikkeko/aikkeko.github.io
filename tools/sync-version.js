'use strict';
// All version mirrors are generated from site-version.json.
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const { version, cache } = require('../site-version.json');
if (!/^\d{4}\.\d{2}\.\d{2}-\d{2}$/.test(version) || !Number.isInteger(cache)) throw new Error('Invalid site version');
const mirrors = [
  ['source/_data/styles.styl', [
    [/Version: \S+/, `Version: ${version}`],
    [/Last Updated: \S+/, `Last Updated: ${version.slice(0, 10).replace(/\./g, '-')}`],
    [/--theme-version: "[^"]+"/, `--theme-version: "${version}"`]
  ]],
  ['source/_data/styles/00-foundation.styl', [[/content: "v\d{4}\.\d{2}\.\d{2}-\d{2}"/, `content: "v${version}"`]]],
  ['themes/next/_config.yml', [[/^asset_version:.*$/m, `asset_version: ${version.replace(/[.-]/g, '')}`]]],
  ['source/sw.js', [[/const CACHE_VERSION = '[^']+';/, `const CACHE_VERSION = 'blog-v${cache}';`]]]
];
for (const [name, replacements] of mirrors) {
  const file = path.join(root, name);
  let text = fs.readFileSync(file, 'utf8');
  for (const [pattern, value] of replacements) {
    if (!pattern.test(text)) throw new Error(`Version mirror missing: ${name}`);
    text = text.replace(pattern, value);
  }
  if (text !== fs.readFileSync(file, 'utf8')) fs.writeFileSync(file, text);
}
console.log(`Version ${version}, cache blog-v${cache}`);
