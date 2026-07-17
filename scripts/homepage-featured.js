'use strict';

/**
 * Promote the article selected in content-pipeline/article-metadata.yml to the
 * first index position. The existing index generator already understands the
 * `sticky` property, so pagination remains correct and the article is not
 * duplicated on later pages.
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const metadataPath = path.join(hexo.base_dir, 'content-pipeline', 'article-metadata.yml');
let promotedPost = null;
let originalSticky;

function restorePreviousPost() {
  if (!promotedPost) return;
  promotedPost.sticky = originalSticky;
  promotedPost = null;
  originalSticky = undefined;
}

hexo.extend.filter.register('before_generate', function() {
  restorePreviousPost();

  if (!fs.existsSync(metadataPath)) return;

  let registry;
  try {
    registry = yaml.load(fs.readFileSync(metadataPath, 'utf8')) || {};
  } catch (error) {
    hexo.log.warn(`Unable to read homepage featured article config: ${error.message}`);
    return;
  }

  const featuredKey = String(registry.homepage?.featured_article || '').trim();
  if (!featuredKey) return;

  const article = registry.articles && registry.articles[featuredKey];
  if (!article || !article.title) {
    hexo.log.warn(`Featured article key not found: ${featuredKey}; using the newest article.`);
    return;
  }

  const posts = hexo.locals.get('posts');
  const selected = posts && posts.toArray().find(post => post.title === article.title);
  if (!selected) {
    hexo.log.warn(`Featured article has no generated post: ${featuredKey}; using the newest article.`);
    return;
  }

  promotedPost = selected;
  originalSticky = selected.sticky;
  selected.sticky = 1000000;
  hexo.log.info(`Homepage featured article: ${selected.title}`);
});
