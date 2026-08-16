/* global CONFIG */

// Navigation should be predictable: every page opens at the top. Reading
// progress is still stored for posts, but restoration is always user initiated.
if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}

document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  const isPost = Boolean(CONFIG.page && CONFIG.page.isPost);
  const storageKey = 'bookmark' + location.pathname;
  const bookmarkLink = document.querySelector('.book-mark-link');

  const startAtEntry = () => {
    if (location.hash !== '') return;
    requestAnimationFrame(() => {
      const isPaginatedHome = document.body.classList.contains('home-page')
        && /\/page\/\d+\/?$/.test(location.pathname);
      const postsSection = isPaginatedHome && document.getElementById('posts-section');
      const targetTop = postsSection
        ? postsSection.getBoundingClientRect().top + window.scrollY
        : 0;
      window.scrollTo(0, targetTop);
    });
  };

  const savePosition = () => {
    if (!isPost) return;
    localStorage.setItem(storageKey, String(Math.round(window.scrollY)));
  };

  const getSavedPosition = () => {
    const value = parseInt(localStorage.getItem(storageKey), 10);
    return Number.isFinite(value) ? value : 0;
  };

  const showResumePrompt = () => {
    if (!isPost || location.hash !== '' || document.querySelector('.reading-resume-prompt')) return;

    const savedPosition = getSavedPosition();
    const maxScroll = Math.max(document.documentElement.scrollHeight - window.innerHeight, 0);
    if (savedPosition < 240 || maxScroll < 480) return;

    const targetPosition = Math.min(savedPosition, maxScroll);
    const progress = Math.max(1, Math.min(99, Math.round(targetPosition / maxScroll * 100)));
    const prompt = document.createElement('aside');
    prompt.className = 'reading-resume-prompt';
    prompt.setAttribute('aria-label', '续读提示');
    prompt.innerHTML = `
      <button class="reading-resume-action" type="button">
        <span class="reading-resume-kicker">ARCHIVE POSITION / ${progress}%</span>
        <strong>继续上次阅读</strong>
      </button>
      <button class="reading-resume-dismiss" type="button" aria-label="关闭续读提示">×</button>
    `;

    prompt.querySelector('.reading-resume-action').addEventListener('click', () => {
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({
        top: targetPosition,
        behavior: reduceMotion ? 'auto' : 'smooth'
      });
      prompt.remove();
    });
    prompt.querySelector('.reading-resume-dismiss').addEventListener('click', () => prompt.remove());
    document.body.appendChild(prompt);
  };

  // Override native reload/back-forward restoration, including bfcache pages.
  startAtEntry();
  window.addEventListener('pageshow', startAtEntry);

  if (!isPost) {
    if (bookmarkLink) bookmarkLink.hidden = true;
    return;
  }

  if (CONFIG.bookmark.save === 'auto') {
    window.addEventListener('pagehide', savePosition);
    window.addEventListener('beforeunload', savePosition);
    window.addEventListener('pjax:send', savePosition);
  }

  if (bookmarkLink) {
    window.addEventListener('scroll', () => {
      bookmarkLink.classList.toggle('book-mark-link-fixed', window.scrollY === 0);
    }, { passive: true });

    bookmarkLink.addEventListener('click', () => {
      savePosition();
      window.anime({
        targets : bookmarkLink,
        duration: 200,
        easing  : 'linear',
        top     : -30,
        complete: () => {
          setTimeout(() => {
            bookmarkLink.style.top = '';
          }, 400);
        }
      });
    });
  }

  window.addEventListener('load', () => {
    startAtEntry();
    window.setTimeout(showResumePrompt, 260);
  }, { once: true });
});
