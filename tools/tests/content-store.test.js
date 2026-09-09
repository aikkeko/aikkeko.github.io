'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const store = require('../lib/content-store');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aike-store-test-'));
  const posts = path.join(root, 'posts'); fs.mkdirSync(posts);
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const name of ['甲', '乙']) fs.writeFileSync(path.join(posts, `2026-09-08-${name}.md`), `---\ntitle: ${name}\ndate: 2026-09-08 00:00:00\n---\n\n正文 ${name}\n`);
  return { root, posts, registry: { defaults: { author: 'AikeKo' }, articles: {
    '20260908_甲': { title: '甲', description: '第一行\n第二行', tags: ['书籍'] },
    '20260908_乙': { title: '乙', description: '另一篇', tags: ['游戏'] }
  } } };
}

test('same-day articles get unique stable IDs; title edits keep filenames, dates and body', t => {
  const { root, posts, registry } = fixture(t);
  const before = store.listPosts(posts).map(post => post.body);
  store.commitWrites(store.planSync(registry, posts), path.join(root, 'backups'));
  assert.notEqual(registry.articles['20260908_甲'].id, registry.articles['20260908_乙'].id);
  registry.articles['20260908_甲'].title = '新的标题';
  store.commitWrites(store.planSync(registry, posts), path.join(root, 'backups'));
  const after = store.listPosts(posts);
  assert.deepEqual(after.map(post => post.body), before);
  const edited = after.find(post => post.name.endsWith('甲.md'));
  assert.equal(edited.front.title, '新的标题');
  assert.equal(edited.front.description, '第一行\n第二行');
  assert.equal(edited.front.date, '2026-09-08 00:00:00');
  assert.equal(store.planSync(registry, posts).length, 0);
});

test('ambiguous/missing associations and duplicate IDs fail before writes', t => {
  const { posts, registry } = fixture(t);
  registry.articles['20260908_不存在'] = { title: '未知' };
  assert.throws(() => store.planSync(registry, posts), /无法唯一关联/);
  delete registry.articles['20260908_不存在'];
  registry.articles['20260908_甲'].id = registry.articles['20260908_乙'].id = 'duplicate';
  assert.throws(() => store.planSync(registry, posts), /重复/);
});

test('transaction rolls back already committed files if a later rename fails', t => {
  const { root, posts } = fixture(t);
  const files = store.listPosts(posts);
  const originalRename = fs.renameSync;
  let calls = 0;
  fs.renameSync = (...args) => { if (++calls === 2) throw new Error('simulated disk failure'); return originalRename(...args); };
  try {
    assert.throws(() => store.commitWrites(files.map(post => ({ file: post.file, content: 'replacement' })), path.join(root, 'backups')), /simulated/);
  } finally { fs.renameSync = originalRename; }
  for (const post of files) assert.equal(fs.readFileSync(post.file, 'utf8'), post.raw);
  assert.equal(fs.existsSync(path.join(root, 'backups/.lock')), false);
});

test('revision includes direct article edits, not only registry edits', t => {
  const { root, posts } = fixture(t);
  const registryFile = path.join(root, 'archive.yml'); fs.writeFileSync(registryFile, 'articles: {}');
  const before = store.revision(registryFile, posts);
  fs.appendFileSync(store.listPosts(posts)[0].file, '外部修改');
  assert.notEqual(store.revision(registryFile, posts), before);
});
