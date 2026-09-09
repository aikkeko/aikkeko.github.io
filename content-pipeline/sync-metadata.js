#!/usr/bin/env node

/**
 * Fill missing source/_data/archive.yml article fields from generated posts.
 * Existing hand-maintained values always win. Descriptions intentionally start
 * empty so the homepage can derive them from the beginning of each article.
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const store = require('../tools/lib/content-store');

const projectRoot = path.resolve(__dirname, '..');
const exampleDir = path.join(projectRoot, 'example');
const postsDir = path.join(projectRoot, 'source', '_posts');
const metadataPath = path.join(projectRoot, 'source', '_data', 'archive.yml');

function normalizeList(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return [];
}

const registry = fs.existsSync(metadataPath)
  ? yaml.load(fs.readFileSync(metadataPath, 'utf8'), { schema: yaml.JSON_SCHEMA }) || {}
  : {};

registry.defaults = registry.defaults && typeof registry.defaults === 'object'
  ? registry.defaults
  : { author: 'AikeKo' };
registry.articles = registry.articles && typeof registry.articles === 'object'
  ? registry.articles
  : {};

const posts = store.listPosts(postsDir);
const sourceFiles = fs.readdirSync(exampleDir)
  .filter(file => /^\d{8}_.+\.(docx|md)$/i.test(file))
  .sort((a, b) => a.localeCompare(b, 'zh-CN'));

for (const sourceFile of sourceFiles) {
  const key = path.basename(sourceFile, path.extname(sourceFile));
  const dateMatch = key.match(/^(\d{4})(\d{2})(\d{2})_/);
  if (!dateMatch) continue;

  const current = registry.articles[key] && typeof registry.articles[key] === 'object'
    ? registry.articles[key]
    : {};
  const post = store.resolvePost(key, current, posts);
  const generated = post.front;

  registry.articles[key] = {
    ...current,
    title: current.title || generated.title || key.replace(/^\d{8}_/, ''),
    author: current.author || generated.author || registry.defaults.author || 'AikeKo',
    description: Object.prototype.hasOwnProperty.call(current, 'description')
      ? current.description
      : '',
    categories: current.categories || (current.category ? [current.category] : normalizeList(generated.categories)),
    tags: current.tags || normalizeList(generated.tags),
  };
}

const header = `# Archive content configuration
#
# This is the only file you normally need to edit.
# It controls articles, the homepage feature, and the signal archive.
#
# The article key must equal the DOCX/MD filename without its extension.
# Existing values are never overwritten by \`npm run pipeline:metadata\`.
# Saving this file while \`npm run pipeline\` is active regenerates all posts.
#
# Set homepage.featured_article to an article key, or leave it empty to use the newest post.
# Leave description empty to show the beginning of the article automatically.
# Add a description only when you want to override that automatic excerpt.
# Add radio/video records under media.items; media.featured accepts an item id.
# R2 credentials remain in the private root .env file and are never written here.
# Optional article fields: date, header_image, frontmatter

`;

const writes = store.planSync(registry, postsDir);
const finalOutput = header + yaml.dump(registry, store.yamlOptions);
if (finalOutput !== fs.readFileSync(metadataPath, 'utf8')) writes.push({ file: metadataPath, content: finalOutput });
store.commitWrites(writes, path.join(projectRoot, '.content-backups'));
console.log(`Updated ${path.relative(projectRoot, metadataPath)} (${sourceFiles.length} articles).`);
