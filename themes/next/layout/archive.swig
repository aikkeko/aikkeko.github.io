{% extends '_layout.swig' %}
{% import '_macro/post-collapse.swig' as post_template with context %}
{% import '_macro/sidebar.swig' as sidebar_template with context %}

{% block title %}Archive Index | {{ title }}{% endblock %}

{% block class %}archive{% endblock %}

{% block content %}

  {#####################}
  {### ARCHIVE BLOCK ###}
  {#####################}
  <div class="post-block">
    <section class="archive-hero" aria-label="Archive overview">
      <div class="archive-hero-kicker">Chronological Index</div>
      <h1 class="archive-hero-title">Archive Index</h1>
      <p class="archive-hero-desc">All dispatches are arranged by the time they entered the archive.</p>
      <div class="archive-hero-stats">
        <span><strong>{{ site.posts.length }}</strong> posts</span>
        <span><strong>{{ site.tags.length }}</strong> tags</span>
        <span><strong>{{ moment(site.posts.first().date).format('YYYY') if site.posts.length else moment().format('YYYY') }}</strong> latest</span>
      </div>
    </section>
    <div class="posts-collapse">
      <div class="collection-title">
        {%- set posts_length = site.posts.length %}
        {%- if posts_length > 210 %}
          {%- set cheers = 'excellent' %}
        {% elif posts_length > 130 %}
          {%- set cheers = 'great' %}
        {% elif posts_length > 80 %}
          {%- set cheers = 'good' %}
        {% elif posts_length > 50 %}
          {%- set cheers = 'nice' %}
        {% elif posts_length > 30 %}
          {%- set cheers = 'ok' %}
        {% else %}
          {%- set cheers = 'um' %}
        {%- endif %}
        <span class="collection-header">{{ __('cheers.' + cheers) }}! {{ _p('counter.archive_posts', site.posts.length) }} {{ __('keep_on') }}</span>
      </div>

      {{ post_template.render(page.posts) }}

    </div>
  </div>
  {#########################}
  {### END ARCHIVE BLOCK ###}
  {#########################}

  {% include '_partials/pagination.swig' %}

{% endblock %}

{% block sidebar %}
  {{ sidebar_template.render(false) }}
{% endblock %}
