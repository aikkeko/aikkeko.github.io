'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

test('offline directory lists newest existing page cache without creating old caches', async () => {
  const html = fs.readFileSync(path.join(__dirname, '../../source/offline.html'), 'utf8');
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  for (const names of [['blog-v99-pages', 'blog-v166-pages', 'blog-v166-images'], []]) {
    const list = { innerHTML: '' }, opened = [];
    vm.runInNewContext(script, {
      window: { caches: true }, navigator: {}, location: { hostname: 'aikkeko.github.io' }, URL,
      document: { getElementById: () => list },
      caches: { keys: async () => names, open: async name => {
        opened.push(name); return { keys: async () => [{ url: 'https://aikkeko.github.io/2026-09-10-test.html' }] };
      } }
    });
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(opened, names.length ? ['blog-v166-pages'] : []);
    assert.ok(list.innerHTML.includes(names.length ? '2026-09-10-test' : '暂无已缓存文章'));
  }
});

test('featured post uses stable identity when titles collide and restores prior sticky', () => {
  const source = fs.readFileSync(path.join(__dirname, '../../scripts/homepage-featured.js'), 'utf8');
  const posts = [{ title: '同名', article_id: 'first' }, { title: '同名', article_id: 'selected', sticky: 3 }];
  let callback, config = 'homepage:\n  featured_article: chosen\narticles:\n  chosen:\n    title: 同名\n    id: selected\n';
  vm.runInNewContext(source, {
    require: name => name === 'fs' ? { existsSync: () => true, readFileSync: () => config } : require(name),
    hexo: { base_dir: '.', extend: { filter: { register: (_, fn) => { callback = fn; } } },
      locals: { get: () => ({ toArray: () => posts }) }, log: { info() {}, warn() {} } }
  });
  callback(); assert.equal(posts[0].sticky, undefined); assert.equal(posts[1].sticky, 1000000);
  config = 'homepage: {}'; callback(); assert.equal(posts[1].sticky, 3);
});
