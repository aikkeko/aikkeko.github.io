'use strict';

/**
 * Keep the media archive predictable as the configuration grows:
 * - the explicitly featured entry remains first;
 * - every other entry is ordered newest to oldest;
 * - entries without a valid date are kept at the end.
 */
function mediaTimestamp(value) {
  if (!value) return Number.NEGATIVE_INFINITY;

  const timestamp = value instanceof Date
    ? value.getTime()
    : Date.parse(String(value));

  return Number.isFinite(timestamp)
    ? timestamp
    : Number.NEGATIVE_INFINITY;
}

hexo.extend.filter.register('template_locals', locals => {
  const archive = locals?.site?.data?.archive;
  const media = archive?.media;

  if (!media || !Array.isArray(media.items) || media.items.length < 2) {
    return locals;
  }

  const featuredId = String(media.featured || '').trim();

  media.items = media.items
    .map((item, originalIndex) => ({ item, originalIndex }))
    .sort((left, right) => {
      const leftIsFeatured = featuredId && left.item.id === featuredId;
      const rightIsFeatured = featuredId && right.item.id === featuredId;

      if (leftIsFeatured !== rightIsFeatured) {
        return leftIsFeatured ? -1 : 1;
      }

      const dateDifference =
        mediaTimestamp(right.item.date) - mediaTimestamp(left.item.date);

      return dateDifference || left.originalIndex - right.originalIndex;
    })
    .map(entry => entry.item);

  return locals;
});
