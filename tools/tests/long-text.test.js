'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const cheerio = require('cheerio');
const { chunkContent } = require('../lib/long-text');
test('build-time chunks preserve all text, anchors, tables and images', () => {
  const html = `<h2 id="chapter-one">第一章</h2><p>${'长文内容'.repeat(800)}</p><h2 id="chapter-two">第二章</h2><table><tbody><tr><td>表格</td></tr></tbody></table><img src="/test.png" loading="lazy"><p>${'后半篇'.repeat(800)}</p>`;
  const output = chunkContent(html);
  const $ = cheerio.load(output, null, false);
  assert.equal($.root().text(), cheerio.load(html, null, false).root().text());
  assert.ok($('.long-text-chunk').length >= 2);
  assert.equal($('#chapter-one').length, 1); assert.equal($('#chapter-two').length, 1);
  assert.equal($('table td').text(), '表格'); assert.equal($('img').attr('src'), '/test.png');
  assert.equal(chunkContent(output), output);
});
test('short documents are not transformed', () => assert.equal(chunkContent('<p>短文</p>'), '<p>短文</p>'));
