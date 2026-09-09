/* global hexo */
'use strict';
const { chunkContent } = require('../tools/lib/long-text');
hexo.extend.filter.register('after_post_render', data => {
  if (data.layout === 'post' && /(?:^|[\\/])_posts[\\/]/.test(data.source || data.full_source || '')) {
    data.content = chunkContent(data.content);
  }
  return data;
}, 20);
