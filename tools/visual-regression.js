/* eslint-disable no-console */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'artifacts', 'visual-regression');
const PROFILE = path.join(os.tmpdir(), `aike-echo-visual-${process.pid}`);
const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
].filter(Boolean);

const chrome = CHROME_CANDIDATES.find(fs.existsSync);
if (!chrome) {
  console.error('Chrome/Edge not found. Set CHROME_PATH and retry.');
  process.exit(1);
}

const generatedPost = fs.existsSync(path.join(ROOT, 'public'))
  ? fs.readdirSync(path.join(ROOT, 'public')).find(name => /^\d{4}-\d{2}-\d{2}-.+\.html$/i.test(name))
  : null;

const pages = [
  ['home', '/'],
  ['about', '/about/'],
  ['tags', '/tags/'],
  ['archives', '/archives/'],
  ['media', '/media/']
];

if (generatedPost) pages.push(['post', `/${generatedPost}`]);

const viewports = [
  ['mobile', 390, 844],
  ['tablet', 768, 1024],
  ['desktop', 1440, 1000]
];

function capture(url, file, width, height) {
  return new Promise((resolve, reject) => {
    const args = [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--run-all-compositor-stages-before-draw',
      '--hide-scrollbars',
      '--no-first-run',
      '--virtual-time-budget=4000',
      `--user-data-dir=${PROFILE}`,
      `--window-size=${width},${height}`,
      `--screenshot=${file}`,
      url
    ];
    const child = spawn(chrome, args, { stdio: 'ignore', windowsHide: true });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(`Chrome exited with ${code}`)));
  });
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  for (const [viewport, width, height] of viewports) {
    for (const [name, route] of pages) {
      const file = path.join(OUT, `${viewport}-${name}.png`);
      await capture(`http://127.0.0.1:4002${encodeURI(route)}`, file, width, height);
      console.log(path.relative(ROOT, file));
    }
  }
})().catch(error => {
  console.error(error.message);
  process.exit(1);
});
