/* global hexo */

'use strict';

hexo.extend.filter.register('after_post_render', data => {
  const { config } = hexo;
  const theme = hexo.theme.config;
  if (!theme.exturl && !theme.lazyload) return;
  if (theme.lazyload && /<img\b/i.test(data.content)) {
    const cheerio = require('cheerio');
    const $ = cheerio.load(data.content, null, false);
    $('img').each((_, image) => {
      const img = $(image);
      if (!img.attr('loading')) img.attr('loading', 'lazy');
      img.attr('decoding', 'async');
    });
    data.content = $.html();
  }
  if (theme.exturl) {
    const url = require('url');
    const siteHost = url.parse(config.url).hostname || config.url;
    data.content = data.content.replace(/<a[^>]* href="([^"]+)"[^>]*>([^<]+)<\/a>/img, (match, href, html) => {
      // Exit if the href attribute doesn't exists.
      if (!href) return match;

      // Exit if the url has same host with `config.url`, which means it's an internal link.
      let link = url.parse(href);
      if (!link.protocol || link.hostname === siteHost) return match;

      return `<span class="exturl" data-url="${Buffer.from(href).toString('base64')}">${html}<i class="fa fa-external-link-alt"></i></span>`;
    });
  }

}, 0);
