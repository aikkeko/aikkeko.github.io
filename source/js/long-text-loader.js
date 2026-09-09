/* Long articles are segmented at build time. Never move article DOM on load. */
(function () {
  'use strict';
  function init() {
    const body = document.querySelector('.post-body');
    if (!body) return;
    if (body.querySelector('.long-text-chunk')) body.classList.add('long-text-optimized');
    if (window.CONFIG && window.CONFIG.bookmark && window.CONFIG.bookmark.enable) return;
    const key = `hexo-bookmark-data:${window.location.pathname}`;
    const headings = Array.from(body.querySelectorAll('h2[id]'));
    let timer;
    function save() {
      const height = document.documentElement.scrollHeight - window.innerHeight;
      let section = '';
      for (const heading of headings) if (heading.getBoundingClientRect().top < 121) section = heading.id;
      try {
        localStorage.setItem(key, JSON.stringify({ scrollTop: window.scrollY,
          scrollPercent: height > 0 ? window.scrollY / height : 0, section, timestamp: Date.now() }));
      } catch (_) { /* Storage failure must not interrupt reading. */ }
    }
    window.addEventListener('scroll', () => { clearTimeout(timer); timer = setTimeout(save, 500); }, { passive: true });
    window.addEventListener('pagehide', save);
    // Resuming stays user initiated, never jump automatically.
  }
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', init, { once: true }) : init();
})();
