# Style layers

`source/_data/styles.styl` is the stable entry point consumed by NexT. Its
imports are ordered from broad foundations to narrow final overrides:

1. `00-foundation.styl` — tokens, page shell, sidebar, baseline utilities.
2. `10-home-editorial.styl` — homepage cover and article-list composition.
3. `20-archive-pages.styl` — shared directory heroes, tags and chronology.
4. `30-reading-shell.styl` — article banner, prose and reading navigation.
5. `40-cards-media.styl` — cards, image loading states and signal archive.
6. `50-comments-final.styl` — Giscus surface and deliberate final overrides.
7. `55-reading-contract.styl` — shared prose/brand type scale and reading surfaces.
8. `56-editorial-restraint.styl` — single-frame surfaces, card rhythm and quiet metadata.
9. `57-dream-atmosphere.styl` — quiet twilight palette and signal-cover composition.
10. `60-responsive.styl` — mobile geometry and accessible navigation controls.

Put new rules in the narrowest matching layer. Avoid adding another global
override at the end unless it intentionally resolves a cross-page conflict.

Use `$viewport-mobile` / `$viewport-desktop` from the entry point for the shared
768/769px breakpoint. Update versions only in `site-version.json`; `npm run build`
synchronizes the stylesheet, theme asset query and service-worker mirrors.

`node tools/style-audit.js` reports conservatively detectable shadowed declarations.
Its optional `--fix` is a mechanical cleanup, not a substitute for visual review.
Run `npm run visual:check` after changing the cascade. The September cleanup removed
243 shadowed declarations while preserving sampled font/color/horizontal geometry.
