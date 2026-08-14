# Style layers

`source/_data/styles.styl` is the stable entry point consumed by NexT. Its
imports are ordered from broad foundations to narrow final overrides:

1. `00-foundation.styl` — tokens, page shell, sidebar, baseline utilities.
2. `10-home-editorial.styl` — homepage cover and article-list composition.
3. `20-archive-pages.styl` — shared directory heroes, tags and chronology.
4. `30-reading-shell.styl` — article banner, prose and reading navigation.
5. `40-cards-media.styl` — cards, image loading states and signal archive.
6. `50-comments-final.styl` — Giscus surface and deliberate final overrides.

Put new rules in the narrowest matching layer. Avoid adding another global
override at the end unless it intentionally resolves a cross-page conflict.
