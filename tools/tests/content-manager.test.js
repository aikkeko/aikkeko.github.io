'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const yaml = require('js-yaml');

test('manager saves with backup, rejects stale revisions, and refuses partial saves', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aike-manager-test-'));
  const posts = path.join(root, 'source/_posts');
  const archive = path.join(root, 'source/_data/archive.yml');
  fs.mkdirSync(posts, { recursive: true }); fs.mkdirSync(path.dirname(archive), { recursive: true });
  const post = path.join(posts, '2026-09-08-测试.md');
  fs.writeFileSync(post, '---\ntitle: 测试\ndate: 2026-09-08\n---\n正文不变');
  fs.writeFileSync(archive, yaml.dump({ defaults: { author: 'AikeKo' }, homepage: {}, articles: {
    '20260908_测试': { title: '测试', description: '原简介', tags: ['游戏'] }
  }, media: { page: {}, items: [] } }));
  const probe = http.createServer();
  await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  const child = spawn(process.execPath, [path.join(__dirname, '../../content-manager/server.js'), '--no-open'], {
    env: { ...process.env, CONTENT_MANAGER_PORT: String(port), CONTENT_MANAGER_ARCHIVE: archive, CONTENT_MANAGER_POSTS: posts },
    windowsHide: true, stdio: 'pipe'
  });
  let output = '';
  child.stderr.on('data', data => { output += data; });
  t.after(async () => {
    child.kill(); await new Promise(resolve => child.exitCode !== null ? resolve() : child.once('exit', resolve));
    fs.rmSync(root, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${port}`;
  let snapshot;
  for (let i = 0; i < 50; i++) {
    try { snapshot = await (await fetch(base + '/api/data')).json(); break; } catch { await new Promise(resolve => setTimeout(resolve, 100)); }
  }
  assert.ok(snapshot?.revision, output);
  snapshot.registry.articles['20260908_测试'].title = '改名';
  snapshot.registry.articles['20260908_测试'].description = '新的第一行\n新的第二行';
  const save = data => fetch(base + '/api/save', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base }, body: JSON.stringify(data) });
  const response = await save(snapshot); assert.equal(response.status, 200);
  const saved = await response.json();
  assert.ok(fs.existsSync(path.join(saved.backup, 'manifest.json')));
  assert.ok(fs.readFileSync(post, 'utf8').includes('新的第一行'));
  assert.ok(fs.readFileSync(post, 'utf8').endsWith('正文不变'));
  assert.equal((await save(snapshot)).status, 409);
  const before = fs.readFileSync(archive, 'utf8');
  saved.registry.articles['20260908_缺失'] = { title: '缺失' };
  assert.equal((await save(saved)).status, 400);
  assert.equal(fs.readFileSync(archive, 'utf8'), before);
});
