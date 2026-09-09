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
    const coverImages = Array.from(archive.querySelectorAll('.media-cover-image'));
    const descriptions = Array.from(archive.querySelectorAll('.media-card-description'));
    const params = new URLSearchParams(window.location.search);
    const playerTimers = new WeakMap();
    const descriptionToggles = new WeakMap();
    const searchableText = new Map(cards.map(card => [card, card.textContent.toLocaleLowerCase()]));

    if (search && params.get('q')) search.value = params.get('q');

    coverImages.forEach(image => {
      const reveal = () => {
        image.classList.remove('is-loading');
        image.classList.add('is-loaded');
      };
      const conceal = () => {
        image.classList.remove('is-loading');
        image.classList.add('is-error');
      };

      if (image.complete) {
        image.naturalWidth > 0 ? reveal() : conceal();
        return;
      }

      image.addEventListener('load', reveal, { once: true });
      image.addEventListener('error', conceal, { once: true });
    });

    function applyFilters() {
      const query = search ? search.value.trim().toLocaleLowerCase() : '';
      let visible = 0;

      cards.forEach(card => {
        const matchesQuery = !query || searchableText.get(card).includes(query);
        card.hidden = !matchesQuery;
        if (!matchesQuery) stopPlayer(card.querySelector('[data-media-player]'));
        if (matchesQuery) visible += 1;
      });

      if (resultCount) {
        resultCount.textContent = String(visible);
        resultCount.closest('.media-result-counter').hidden = !query;
      }
      archive.querySelector('.media-toolbar')?.classList.toggle('is-filtering', Boolean(query));
      if (noResults) noResults.hidden = visible !== 0;

      const nextParams = new URLSearchParams(window.location.search);
      nextParams.delete('type');
      query ? nextParams.set('q', search.value.trim()) : nextParams.delete('q');
      const nextQuery = nextParams.toString();
      window.history.replaceState(null, '', `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}${window.location.hash}`);
    }

    let searchTimer;
    if (search) search.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(applyFilters, 140);
    });

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
      clearTimeout(playerTimers.get(player));
      player.querySelector('.media-player-status')?.remove();

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
      stopPlayer(player);

      players.forEach(candidate => {
        if (candidate !== player) stopPlayer(candidate);
      });

      const playerUrl = new URL(source, window.location.href);
      playerUrl.searchParams.set('autoplay', '1');

      const iframe = document.createElement('iframe');
      iframe.src = playerUrl.toString();
      iframe.title = launch.getAttribute('aria-label') || '嵌入式媒体播放器';
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
      const status = document.createElement('div');
      status.className = 'media-player-status';
      status.setAttribute('role', 'status');
      status.textContent = '播放器加载中…';
      player.appendChild(status);
      const showRecovery = () => {
        status.replaceChildren(document.createTextNode('加载较慢？'));
        const retry = document.createElement('button');
        retry.type = 'button';
        retry.textContent = '重新加载';
        retry.addEventListener('click', () => startPlayer(player));
        status.appendChild(retry);
        const sourceButton = player.closest('[data-media-card]')?.querySelector('[data-media-open]');
        if (sourceButton) {
          const open = document.createElement('button');
          open.type = 'button'; open.textContent = '打开原页面';
          open.addEventListener('click', () => sourceButton.click());
          status.appendChild(open);
        }
      };
      iframe.addEventListener('load', () => {
        clearTimeout(playerTimers.get(player));
        // Cross-origin load cannot prove playback succeeded. Keep a quiet retry entry.
        status.textContent = '播放有问题？';
        const retry = document.createElement('button');
        retry.type = 'button'; retry.textContent = '重试';
        retry.addEventListener('click', () => startPlayer(player));
        status.appendChild(retry);
        status.classList.add('is-ready');
      }, { once: true });
      iframe.addEventListener('error', showRecovery, { once: true });
      playerTimers.set(player, setTimeout(showRecovery, 12000));
    }

    players.forEach(player => {
      const launch = player.querySelector('[data-media-play]');
      if (launch) launch.addEventListener('click', () => startPlayer(player));
    });

    function prepareDescription(description) {
      if (!description || !description.getBoundingClientRect().width) return;

      const style = window.getComputedStyle(description);
      const lineHeight = Number.parseFloat(style.lineHeight) || 28;
      const previewLines = Number.parseInt(style.getPropertyValue('--media-description-lines'), 10) || 5;
      const hasOverflow = description.scrollHeight > lineHeight * previewLines + 2;
      description.classList.toggle('is-collapsible', hasOverflow);
      let toggle = descriptionToggles.get(description);
      if (toggle) { toggle.hidden = !hasOverflow; return; }
      if (!hasOverflow) return;

      toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'media-description-toggle';
      toggle.setAttribute('aria-expanded', 'false');
      description.id = description.id || `media-description-${descriptions.indexOf(description) + 1}`;
      toggle.setAttribute('aria-controls', description.id);
      toggle.textContent = '展开介绍';
      toggle.addEventListener('click', () => {
        const expanded = description.classList.toggle('is-expanded');
        toggle.setAttribute('aria-expanded', String(expanded));
        toggle.textContent = expanded ? '收起介绍' : '展开介绍';
      });
      description.insertAdjacentElement('afterend', toggle);
      descriptionToggles.set(description, toggle);
    }

    descriptions.forEach(prepareDescription);
    if ('ResizeObserver' in window) {
      const widths = new WeakMap();
      const observer = new ResizeObserver(entries => {
        entries.forEach(({ target, contentRect }) => {
          if (widths.get(target) === contentRect.width) return;
          widths.set(target, contentRect.width);
          prepareDescription(target);
        });
      });
      descriptions.forEach(description => observer.observe(description));
    } else {
      window.addEventListener('resize', () => descriptions.forEach(prepareDescription), { passive: true });
    }
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => descriptions.forEach(prepareDescription));
    }

    applyFilters();
  }

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', initMediaArchive, { once: true })
    : initMediaArchive();
})();
