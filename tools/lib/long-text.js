'use strict';
const cheerio = require('cheerio');
function chunkContent(html) {
  const $ = cheerio.load(html, null, false);
  if ($('.long-text-chunk').length || $.root().text().trim().length < 3000) return html;
  const groups = [];
  let group = [], size = 0;
  for (const child of $.root().contents().toArray()) {
    if (group.length && ((child.name === 'h2' && size > 0) || size >= 2200)) {
      groups.push(group); group = []; size = 0;
    }
    group.push(child); size += $(child).text().length;
  }
  if (group.length) groups.push(group);
  // Keep full markup and heading IDs available to search and anchor links.
  return groups.map((nodes, index) => `<section class="long-text-chunk" data-chunk-index="${index}" aria-label="阅读分段 ${index + 1}">${nodes.map(node => $.html(node)).join('')}</section>`).join('');
}
module.exports = { chunkContent };
