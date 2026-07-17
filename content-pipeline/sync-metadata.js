#!/usr/bin/env node

/**
 * Fill missing article-metadata.yml fields from the currently generated posts.
 * Existing hand-maintained values always win. Descriptions intentionally start
 * empty so the homepage can derive them from the beginning of each article.
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const projectRoot = path.resolve(__dirname, '..');
const exampleDir = path.join(projectRoot, 'example');
const postsDir = path.join(projectRoot, 'source', '_posts');
const metadataPath = path.join(__dirname, 'article-metadata.yml');

function readFrontmatter(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const match = source.match(/^---\s*\r?\n([\s\S]*?)\r?\n---/);
  return match ? yaml.load(match[1]) || {} : {};
}

function normalizeList(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return [];
}

const registry = fs.existsSync(metadataPath)
  ? yaml.load(fs.readFileSync(metadataPath, 'utf8')) || {}
  : {};

registry.defaults = registry.defaults && typeof registry.defaults === 'object'
  ? registry.defaults
  : { author: 'AikeKo' };
registry.articles = registry.articles && typeof registry.articles === 'object'
  ? registry.articles
  : {};

const postFiles = fs.readdirSync(postsDir).filter(file => file.endsWith('.md'));
const sourceFiles = fs.readdirSync(exampleDir)
  .filter(file => /^\d{8}_.+\.(docx|md)$/i.test(file))
  .sort((a, b) => a.localeCompare(b, 'zh-CN'));

for (const sourceFile of sourceFiles) {
  const key = path.basename(sourceFile, path.extname(sourceFile));
  const dateMatch = key.match(/^(\d{4})(\d{2})(\d{2})_/);
  if (!dateMatch) continue;

  const datePrefix = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}-`;
  const postFile = postFiles.find(file => file.startsWith(datePrefix));
  if (!postFile) continue;

  const generated = readFrontmatter(path.join(postsDir, postFile));
  const current = registry.articles[key] && typeof registry.articles[key] === 'object'
    ? registry.articles[key]
    : {};

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

const header = `# Article metadata registry
#
# The article key must equal the DOCX/MD filename without its extension.
# Existing values are never overwritten by \`npm run pipeline:metadata\`.
# Saving this file while \`npm run pipeline\` is active regenerates all posts.
#
# Set homepage.featured_article to an article key, or leave it empty to use the newest post.
# Leave description empty to show the beginning of the article automatically.
# Add a description only when you want to override that automatic excerpt.
# Optional article fields: date, header_image, frontmatter

`;

const output = yaml.dump(registry, {
  noRefs: true,
  lineWidth: -1,
  sortKeys: false,
  quotingType: '"',
  forceQuotes: false
});

fs.writeFileSync(metadataPath, header + output, 'utf8');
console.log(`Updated ${path.relative(projectRoot, metadataPath)} (${sourceFiles.length} articles).`);
