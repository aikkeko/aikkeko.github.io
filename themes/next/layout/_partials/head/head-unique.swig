{%- set echo_social_image = page.header_image or page.cover or (page.photos[0] if page.photos and page.photos.length else null) %}
{%- if not echo_social_image and is_home() %}
  {%- set echo_social_image = '/images/Z.A.T.O_02_ca04.jpg' %}
{%- endif %}
{{ open_graph({
  image: echo_social_image,
  twitter_card: 'summary_large_image' if echo_social_image else 'summary'
}) }}

{{ canonical() }}

{# This partial is intentionally uncached, so article size is evaluated per page. #}
{%- if is_post() and page.content and page.content.length > 3000 %}
  <script src="{{ url_for('/js/long-text-loader.js') }}" defer></script>
{%- endif %}

{# Exports some front-matter variables to Front-End #}
<script id="page-configurations">
  // https://hexo.io/docs/variables.html
  CONFIG.page = {
    sidebar: {{ page.sidebar | json }},
    isHome : {{ is_home() }},
    isPost : {{ is_post() }},
    lang   : '{{ page.lang }}'
  };
</script>
