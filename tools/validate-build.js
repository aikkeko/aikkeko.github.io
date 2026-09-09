'use strict';
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const yaml = require('js-yaml');
const vm = require('vm');
function validate(root = path.resolve(__dirname, '..')) {
  const publicRoot = path.join(root, 'public');
  const required = ['index.html', 'about/index.html', 'media/index.html', 'tags/index.html', 'archives/index.html',
    'css/main.css', 'sw.js', 'offline.html', 'manifest.json', 'search.json', 'sitemap.xml', 'atom.xml'];
  for (const file of required) if (!fs.existsSync(path.join(publicRoot, file))) throw new Error(`Build missing ${file}`);
  for (const name of fs.readdirSync(path.join(publicRoot, 'js')).filter(name => name.endsWith('.js'))) {
    new vm.Script(fs.readFileSync(path.join(publicRoot, 'js', name), 'utf8'), { filename: name });
  }
  new vm.Script(fs.readFileSync(path.join(publicRoot, 'sw.js'), 'utf8'), { filename: 'sw.js' });
  const registry = yaml.load(fs.readFileSync(path.join(root, 'source/_data/archive.yml'), 'utf8'));
  for (const article of Object.values(registry.articles)) {
    const route = article.post_file.replace(/\.md$/, '.html');
    if (!fs.existsSync(path.join(publicRoot, route))) throw new Error(`Article URL missing: ${route}`);
    const post = cheerio.load(fs.readFileSync(path.join(publicRoot, route), 'utf8'));
    const anchors = post('.post-body h2[id], .post-body h3[id]').map((_, el) => post(el).attr('id')).get();
    if (new Set(anchors).size !== anchors.length) throw new Error(`Duplicate heading anchors: ${route}`);
    if (post('.post-body img:not([loading])').length) throw new Error(`Article images missing loading hint: ${route}`);
    if (post('.post-body').text().trim().length > 3000 && !post('.long-text-chunk').length) throw new Error(`Long article not segmented: ${route}`);
  }
  const media = cheerio.load(fs.readFileSync(path.join(publicRoot, 'media/index.html'), 'utf8'));
  if (media('[data-media-card]').length !== registry.media.items.length) throw new Error('Generated media count does not match registry');
  const search = JSON.parse(fs.readFileSync(path.join(publicRoot, 'search.json'), 'utf8'));
  const missing = Object.values(registry.articles).filter(article => !search.some(entry => entry.title === article.title));
  if (missing.length) throw new Error(`Search missing articles: ${missing.map(item => item.title).join(', ')}`);
  const css = fs.readFileSync(path.join(publicRoot, 'css/main.css'), 'utf8');
  if (!css.includes(require('../site-version.json').version)) throw new Error('Generated CSS version is stale');
  console.log(`Build validation passed: ${Object.keys(registry.articles).length} articles, ${registry.media.items.length} media records.`);
}
module.exports = { validate };
if (require.main === module) validate();
