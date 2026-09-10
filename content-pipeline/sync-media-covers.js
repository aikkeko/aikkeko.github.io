/* eslint-disable no-console */
'use strict';

const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');
const store = require('../tools/lib/content-store');

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

function commitCoverUpdates(registryPath, updates, backupRoot) {
  return store.commitWrites(() => {
    const source = store.readSnapshot(registryPath).toString('utf8');
    const registry = yaml.load(source, { schema: yaml.JSON_SCHEMA });
    let changed = false;
    for (const update of updates) {
      const matches = (registry.media?.items || []).filter(item => item.id === update.id);
      if (matches.length !== 1 || ![update.oldUrl, update.newUrl].includes(matches[0].cover)) {
        throw new Error(`节目 ${update.id} 的封面已修改或记录已删除，请重新同步`);
      }
      if (matches[0].cover !== update.newUrl) {
        matches[0].cover = update.newUrl;
        changed = true;
      }
    }
    const header = source.match(/^(?:#[^\n]*\n|\s*\n)*/)[0];
    return changed ? [{ file: registryPath, content: header + yaml.dump(registry, store.yamlOptions) }] : [];
  }, backupRoot);
}

async function downloadCover(item) {
  const response = await fetch(item.cover, {
    headers: {
      'user-agent': 'Mozilla/5.0 (compatible; AikeEchoArchive/1.0)',
      referer: item.url || 'https://www.bilibili.com/'
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(20000)
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
  const source = await fs.readFile(REGISTRY_PATH, 'utf8');
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

  const R2Uploader = require('./lib/r2-uploader');
  const uploader = new R2Uploader();
  const updates = [];
  const failures = [];

  for (const item of pending) {
    try {
      const { buffer, extension } = await downloadCover(item);
      const result = await uploader.upload(buffer, `media-${item.id}${extension}`);
      updates.push({ id: item.id, oldUrl: item.cover, newUrl: result.url });
      console.log(`Prepared ${item.id}`);
    } catch (error) {
      failures.push(`${item.id}: ${error.message}`);
      console.error(`Failed ${item.id}: ${error.message}`);
    }
  }

  if (updates.length) commitCoverUpdates(REGISTRY_PATH, updates, path.join(ROOT, '.content-backups'));
  console.log(`Media cover sync complete: ${updates.length}/${pending.length} processed.`);

  if (failures.length) {
    console.error(failures.join('\n'));
    process.exitCode = 1;
  }
}

module.exports = { commitCoverUpdates, extensionFor };
if (require.main === module) main().catch(error => {
  console.error(error.stack || error.message);
  process.exit(1);
});
