(function () {
  'use strict';

  function initMediaArchive() {
    const archive = document.querySelector('[data-media-archive]');
    if (!archive || archive.dataset.ready === 'true') return;

    archive.dataset.ready = 'true';

    const cards = Array.from(archive.querySelectorAll('[data-media-card]'));
    const search = archive.querySelector('[data-media-search]');
    const resultCount = archive.querySelector('[data-media-result-count]');
    const noResults = archive.querySelector('[data-media-no-results]');
    const reset = archive.querySelector('[data-media-reset]');
    const recordLinks = Array.from(archive.querySelectorAll('[data-media-open]'));
    const players = Array.from(archive.querySelectorAll('[data-media-player]'));
    const params = new URLSearchParams(window.location.search);

    if (search && params.get('q')) search.value = params.get('q');

    function applyFilters() {
      const query = search ? search.value.trim().toLocaleLowerCase() : '';
      let visible = 0;

      cards.forEach(card => {
        const matchesQuery = !query || card.textContent.toLocaleLowerCase().includes(query);
        card.hidden = !matchesQuery;
        if (!matchesQuery) stopPlayer(card.querySelector('[data-media-player]'));
        if (matchesQuery) visible += 1;
      });

      if (resultCount) resultCount.textContent = String(visible).padStart(2, '0');
      if (noResults) noResults.hidden = visible !== 0;

      const nextParams = new URLSearchParams(window.location.search);
      nextParams.delete('type');
      query ? nextParams.set('q', search.value.trim()) : nextParams.delete('q');
      const nextQuery = nextParams.toString();
      window.history.replaceState(null, '', `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}${window.location.hash}`);
    }

    if (search) search.addEventListener('input', applyFilters);

    if (reset) {
      reset.addEventListener('click', () => {
        if (search) search.value = '';
        applyFilters();
        if (search) search.focus();
      });
    }

    recordLinks.forEach(button => {
      button.addEventListener('click', () => {
        const url = button.dataset.mediaOpen;
        if (url) window.location.assign(url);
      });
    });

    function stopPlayer(player) {
      if (!player) return;

      const launch = player.querySelector('[data-media-play]');
      const frame = player.querySelector('[data-media-frame]');
      if (frame) {
        frame.replaceChildren();
        frame.hidden = true;
      }
      if (launch) launch.hidden = false;
      player.classList.remove('is-active');
    }

    function startPlayer(player) {
      const source = player && player.dataset.mediaEmbed;
      const launch = player && player.querySelector('[data-media-play]');
      const frame = player && player.querySelector('[data-media-frame]');
      if (!source || !launch || !frame) return;

      players.forEach(candidate => {
        if (candidate !== player) stopPlayer(candidate);
      });

      const playerUrl = new URL(source, window.location.href);
      playerUrl.searchParams.set('autoplay', '1');

      const iframe = document.createElement('iframe');
      iframe.src = playerUrl.toString();
      iframe.title = launch.getAttribute('aria-label') || 'Embedded media player';
      iframe.loading = 'eager';
      iframe.referrerPolicy = 'strict-origin-when-cross-origin';
      iframe.allow = 'autoplay; fullscreen; picture-in-picture';
      iframe.allowFullscreen = true;
      iframe.setAttribute('scrolling', 'no');
      iframe.setAttribute('frameborder', '0');

      frame.replaceChildren(iframe);
      frame.hidden = false;
      launch.hidden = true;
      player.classList.add('is-active');
    }

    players.forEach(player => {
      const launch = player.querySelector('[data-media-play]');
      if (launch) launch.addEventListener('click', () => startPlayer(player));
    });

    applyFilters();
  }

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', initMediaArchive, { once: true })
    : initMediaArchive();
})();
