'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function worker(host = 'aikkeko.github.io', network = async () => new Response('network')) {
  const handlers = {}, storage = new Map();
  const caches = {
    keys: async () => [...storage.keys()], delete: async key => storage.delete(key),
    open: async name => {
      if (!storage.has(name)) storage.set(name, new Map());
      const cache = storage.get(name);
      return { put: async (request, response) => cache.set(request.url || request, response),
        match: async request => cache.get(request.url || request),
        keys: async () => [...cache.keys()].map(url => ({ url })),
        delete: async request => cache.delete(request.url || request), addAll: async () => {} };
    },
    match: async key => { for (const cache of storage.values()) if (cache.has(key)) return cache.get(key); }
  };
  const context = vm.createContext({ self: { location: { hostname: host, origin: `https://${host}` },
    addEventListener: (name, fn) => { handlers[name] = fn; }, skipWaiting: async () => {},
    registration: { unregister: async () => {} }, clients: { claim: async () => {} } },
  caches, fetch: network, URL, Response, AbortController, setTimeout, clearTimeout, console });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../../source/sw.js'), 'utf8'), context);
  return { handlers, caches, context };
}

test('third-party embeds, APIs and local preview bypass the worker', () => {
  for (const url of ['https://giscus.app/client.js', 'https://player.bilibili.com/player.html', 'https://aikkeko.github.io/api/test']) {
    let intercepted = false;
    worker().handlers.fetch({ request: { url, method: 'GET', mode: 'cors', headers: new Headers() }, respondWith: () => { intercepted = true; } });
    assert.equal(intercepted, false, url);
  }
  let intercepted = false;
  worker('127.0.0.1').handlers.fetch({ request: { url: 'https://127.0.0.1/main.css', method: 'GET', headers: new Headers() }, respondWith: () => { intercepted = true; } });
  assert.equal(intercepted, false);
});

test('image cache is capped and failed images never receive offline HTML', async () => {
  const w = worker();
  for (let i = 0; i < 65; i++) {
    await vm.runInContext(`saveResponse(IMAGES_CACHE, { url: 'https://aikkeko.github.io/${i}.png' }, new Response('image'))`, w.context);
  }
  const cache = await w.caches.open('blog-v' + require('../../site-version.json').cache + '-images');
  assert.equal((await cache.keys()).length, 60);
  const offline = worker('aikkeko.github.io', async () => { throw new Error('offline'); });
  let response;
  offline.handlers.fetch({ request: { url: 'https://aikkeko.github.io/new.png', method: 'GET', headers: new Headers() },
    respondWith: promise => { response = promise; }, waitUntil: () => {} });
  await assert.rejects(response, /offline/);
});
