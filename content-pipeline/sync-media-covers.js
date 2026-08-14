/* eslint-disable no-console */
'use strict';

const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');
const R2Uploader = require('./lib/r2-uploader');

const ROOT = path.resolve(__dirname, '..');
const REGISTRY_PATH = path.join(ROOT, 'source', '_data', 'archive.yml');
const DRY_RUN = process.argv.includes('--dry-run');

function extensionFor(url, contentType) {
  const pathname = new URL(url).pathname;
  const ext = path.extname(pathname).toLowerCase();
  if (/^\.(?:jpe?g|png|gif|webp)$/.test(ext)) return ext === '.jpeg' ? '.jpg' : ext;

  const extensions = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp'
  };
  return extensions[String(contentType || '').split(';')[0].trim()] || '.jpg';
}

function replaceCover(source, oldUrl, newUrl) {
  const escaped = oldUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`(^\\s*cover:\\s*)${escaped}(\\s*$)`, 'm');
  if (!pattern.test(source)) throw new Error(`Cover entry not found in archive.yml: ${oldUrl}`);
  return source.replace(pattern, `$1${newUrl}$2`);
}

async function downloadCover(item) {
  const response = await fetch(item.cover, {
    headers: {
      'user-agent': 'Mozilla/5.0 (compatible; AikeEchoArchive/1.0)',
      referer: item.url || 'https://www.bilibili.com/'
    },
    redirect: 'follow'
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.toLowerCase().startsWith('image/')) {
    throw new Error(`Unexpected content type: ${contentType || 'unknown'}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length < 1024) throw new Error(`Downloaded image is unexpectedly small (${buffer.length} bytes)`);
  return { buffer, extension: extensionFor(item.cover, contentType) };
}

async function main() {
  let source = await fs.readFile(REGISTRY_PATH, 'utf8');
  const registry = yaml.load(source) || {};
  const items = Array.isArray(registry.media?.items) ? registry.media.items : [];
  const pending = items.filter(item => /^https?:\/\//i.test(String(item.cover || '')));

  if (!pending.length) {
    console.log('All media covers already use managed archive URLs.');
    return;
  }

  console.log(`${DRY_RUN ? 'Would sync' : 'Syncing'} ${pending.length} media covers.`);
  if (DRY_RUN) {
    pending.forEach(item => console.log(`- ${item.id}: ${item.cover}`));
    return;
  }

  const uploader = new R2Uploader();
  let updated = 0;
  const failures = [];

  for (const item of pending) {
    try {
      const { buffer, extension } = await downloadCover(item);
      const result = await uploader.upload(buffer, `media-${item.id}${extension}`);
      source = replaceCover(source, item.cover, result.url);
      updated++;
      console.log(`Updated ${item.id}`);
    } catch (error) {
      failures.push(`${item.id}: ${error.message}`);
      console.error(`Failed ${item.id}: ${error.message}`);
    }
  }

  if (updated) await fs.writeFile(REGISTRY_PATH, source, 'utf8');
  console.log(`Media cover sync complete: ${updated}/${pending.length} updated.`);

  if (failures.length) {
    console.error(failures.join('\n'));
    process.exitCode = 1;
  }
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exit(1);
});
