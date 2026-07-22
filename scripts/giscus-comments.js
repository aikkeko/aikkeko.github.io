/* global hexo */

'use strict';

/**
 * Inject a Giscus discussion terminal into article pages.
 * Configuration lives in source/_data/comments.yml so site-owned settings
 * remain outside the NexT theme and survive theme upgrades.
 */

const template = `
{%- set echo_is_home = page.path == 'index.html' %}
{%- set echo_is_post = page.layout == 'post' %}
{%- set echo_is_about = page.type == 'about' %}
{%- set echo_is_media = page.type == 'media' %}
{%- set echo_surface = (surface_home and echo_is_home) or (surface_posts and echo_is_post) or (surface_about and echo_is_about) or (surface_media and echo_is_media) %}
{%- if echo_surface %}
  {%- if echo_is_home %}
    {%- set echo_title = '公共回声' %}
    {%- set echo_description = '在这里留下关于站点、文章或任何事情的话。每一条留言都会成为档案的一部分。' %}
  {%- elif echo_is_about %}
    {%- set echo_title = '给我留言' %}
    {%- set echo_description = '想要交流、提问，或只是说声你来过，都可以在这里留下回声。' %}
  {%- elif echo_is_media %}
    {%- set echo_title = '节目回声' %}
    {%- set echo_description = '谈谈某期节目、声音与画面，或推荐下一份值得收录的信号。' %}
  {%- else %}
    {%- set echo_title = '留下回声' %}
    {%- set echo_description = '使用 GitHub 登录后留言或回复。讨论将与这份文章档案保持关联。' %}
  {%- endif %}
  <section class="comments giscus-comments" aria-labelledby="echo-comments-title">
    <header class="giscus-comments-header">
      <div>
        <span class="giscus-comments-kicker">ECHO TERMINAL / GITHUB DISCUSSIONS</span>
        <h2 id="echo-comments-title">{{ echo_title }}</h2>
        <p>{{ echo_description }}</p>
      </div>
      <span class="giscus-comments-status">PUBLIC CHANNEL</span>
    </header>

    {%- if giscus_ready %}
      <div class="giscus-comments-body">
        <div class="giscus"></div>
        <script src="https://giscus.app/client.js"
                data-repo="{{ repo }}"
                data-repo-id="{{ repo_id }}"
                data-category="{{ category }}"
                data-category-id="{{ category_id }}"
                data-mapping="{{ mapping }}"
                data-strict="{{ strict }}"
                data-reactions-enabled="{{ reactions }}"
                data-emit-metadata="0"
                data-input-position="{{ input_position }}"
                data-theme="{{ theme }}"
                data-lang="{{ language }}"
                data-loading="{{ loading }}"
                crossorigin="anonymous"
                async>
        </script>
        <a class="giscus-github-link" href="{{ discussions_url }}" target="_blank" rel="noopener noreferrer">
          在 GitHub 中打开讨论 <i class="fa fa-arrow-right" aria-hidden="true"></i>
        </a>
      </div>
    {%- elif show_unconfigured %}
      <div class="giscus-pending" role="status">
        <span class="giscus-pending-mark" aria-hidden="true"><i class="far fa-comment-dots"></i></span>
        <div>
          <strong>回声频道尚未开放</strong>
          <p>GitHub Discussions is waiting to be connected.</p>
        </div>
      </div>
    {%- endif %}
  </section>
{%- endif %}
`;

function flag(value, fallback) {
  const resolved = typeof value === 'boolean' ? value : fallback;
  return resolved ? '1' : '0';
}

hexo.extend.filter.register('theme_inject', injects => {
  const data = hexo.locals.get('data') || {};
  const config = data.comments || {};
  const text = value => String(value || '').trim();

  const repo = text(config.repo);
  const repoId = text(config.repo_id);
  const category = text(config.category);
  const categoryId = text(config.category_id);
  const surfaces = config.surfaces || {};
  const enabled = config.enabled !== false;
  const ready = enabled && repo && repoId && category && categoryId;

  if (!enabled && !config.show_unconfigured) return;

  injects.comment.raw('giscus', template, {
    configKey       : 'giscus',
    class           : 'giscus',
    button          : 'GitHub',
    surface_posts   : surfaces.posts !== false,
    surface_home    : surfaces.home !== false,
    surface_about   : surfaces.about !== false,
    surface_media   : surfaces.media !== false,
    giscus_ready    : Boolean(ready),
    show_unconfigured: config.show_unconfigured !== false,
    repo,
    repo_id         : repoId,
    category,
    category_id     : categoryId,
    mapping         : text(config.mapping) || 'pathname',
    strict          : flag(config.strict, true),
    reactions       : flag(config.reactions, true),
    input_position  : text(config.input_position) || 'top',
    theme           : text(config.theme) || 'transparent_dark',
    language        : text(config.language) || 'zh-CN',
    loading         : config.lazy === false ? 'eager' : 'lazy',
    discussions_url : repo ? `https://github.com/${repo}/discussions` : '#'
  }, {cache: false});
});

// NexT only renders its comment injection when page.comments is truthy.
// Explicitly enable that slot for the configured non-post surfaces.
hexo.extend.filter.register('template_locals', locals => {
  const data = hexo.locals.get('data') || {};
  const config = data.comments || {};
  const surfaces = config.surfaces || {};
  const page = locals.page;

  if (!page || config.enabled === false) return locals;

  const path = String(page.path || '').replace(/\\/g, '/');
  const enabled =
    (surfaces.home !== false && path === 'index.html') ||
    (surfaces.posts !== false && page.layout === 'post') ||
    (surfaces.about !== false && page.type === 'about') ||
    (surfaces.media !== false && page.type === 'media');

  if (enabled) page.comments = true;
  return locals;
});
