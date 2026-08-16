/* global hexo */

'use strict';

// NexT copies every bundled vendor directory even when the related feature is
// disabled. Remove those routes after generation, before Hexo writes `public/`.
hexo.extend.filter.register('after_generate', () => {
  const theme = hexo.theme.config;
  const routes = hexo.route.list();
  const remove = route => hexo.route.remove(route);

  if (!theme.motion.enable) {
    routes
      .filter(route => route === 'js/motion.js' || route.startsWith('lib/velocity/'))
      .forEach(remove);
  }

  if (!theme.three.enable) {
    routes
      .filter(route => route.startsWith('lib/three/'))
      .forEach(remove);
  }

  if (!theme.algolia_search.enable) {
    remove('js/algolia-search.js');
  }

  if (!theme.local_search.enable) {
    remove('js/local-search.js');
  }

  if (theme.scheme === 'Gemini' || theme.scheme === 'Pisces') {
    remove('js/schemes/muse.js');
  }
});
