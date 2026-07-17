(function () {
  'use strict';

  function initMediaArchive() {
    const archive = document.querySelector('[data-media-archive]');
    if (!archive || archive.dataset.ready === 'true') return;

    archive.dataset.ready = 'true';

    const cards = Array.from(archive.querySelectorAll('[data-media-card]'));
    const filters = Array.from(archive.querySelectorAll('[data-media-filter]'));
    const search = archive.querySelector('[data-media-search]');
    const resultCount = archive.querySelector('[data-media-result-count]');
    const noResults = archive.querySelector('[data-media-no-results]');
    const reset = archive.querySelector('[data-media-reset]');
    const params = new URLSearchParams(window.location.search);
    const validTypes = new Set(['all', 'radio', 'video']);
    let activeType = validTypes.has(params.get('type')) ? params.get('type') : 'all';

    if (search && params.get('q')) search.value = params.get('q');

    function applyFilters() {
      const query = search ? search.value.trim().toLocaleLowerCase() : '';
      let visible = 0;

      cards.forEach(card => {
        const matchesType = activeType === 'all' || card.dataset.mediaType === activeType;
        const matchesQuery = !query || card.textContent.toLocaleLowerCase().includes(query);
        const matches = matchesType && matchesQuery;
        card.hidden = !matches;
        if (matches) visible += 1;
      });

      filters.forEach(button => {
        const selected = button.dataset.mediaFilter === activeType;
        button.classList.toggle('is-active', selected);
        button.setAttribute('aria-pressed', String(selected));
      });

      if (resultCount) resultCount.textContent = String(visible).padStart(2, '0');
      if (noResults) noResults.hidden = visible !== 0;

      const nextParams = new URLSearchParams(window.location.search);
      activeType === 'all' ? nextParams.delete('type') : nextParams.set('type', activeType);
      query ? nextParams.set('q', search.value.trim()) : nextParams.delete('q');
      const nextQuery = nextParams.toString();
      window.history.replaceState(null, '', `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}${window.location.hash}`);
    }

    filters.forEach(button => {
      button.addEventListener('click', () => {
        activeType = button.dataset.mediaFilter;
        applyFilters();
      });
    });

    if (search) search.addEventListener('input', applyFilters);

    if (reset) {
      reset.addEventListener('click', () => {
        activeType = 'all';
        if (search) search.value = '';
        applyFilters();
        if (search) search.focus();
      });
    }

    applyFilters();
  }

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', initMediaArchive, { once: true })
    : initMediaArchive();
})();
