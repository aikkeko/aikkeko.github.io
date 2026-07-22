'use strict';

/**
 * Gentle mobile background drift.
 * The visual layer stays GPU-composited while this script only updates one
 * CSS custom property inside requestAnimationFrame.
 */
(function() {
  const root = document.documentElement;
  const mobile = window.matchMedia('(max-width: 767px)');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let scheduled = false;

  function render() {
    scheduled = false;

    if (!mobile.matches || reducedMotion.matches) {
      root.style.removeProperty('--mobile-bg-shift');
      return;
    }

    const limit = window.innerHeight * 0.13;
    const shift = -Math.min(limit, window.scrollY * 0.12);
    root.style.setProperty('--mobile-bg-shift', `${shift.toFixed(1)}px`);
  }

  function requestRender() {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(render);
  }

  window.addEventListener('scroll', requestRender, { passive: true });
  window.addEventListener('resize', requestRender, { passive: true });
  mobile.addEventListener?.('change', requestRender);
  reducedMotion.addEventListener?.('change', requestRender);
  requestRender();
})();
