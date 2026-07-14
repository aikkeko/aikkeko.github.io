{% extends '_layout.swig' %}
{% import '_macro/post-collapse.swig' as post_template with context %}
{% import '_macro/sidebar.swig' as sidebar_template with context %}

{% block title %}{{ __('title.tag') }}: {{ page.tag }} | {{ title }}{% endblock %}

{% block class %}tag{% endblock %}

{% block content %}

  {#################}
  {### TAG BLOCK ###}
  {#################}
  <div class="post-block">
    <section class="tag-detail-hero page-identity-hero" aria-label="Tagged posts">
      <div class="page-hero-kicker">Filtered Shelf / Tag Record</div>
      <h1 class="page-hero-title">#{{ page.tag }}</h1>
      <p class="page-hero-desc">同一枚标签下的文章被临时摆放在这里，像一排从废墟货架上重新拾起的索引卡。</p>
      <div class="page-hero-stats">
        <span><strong>{{ page.posts.length }}</strong> entries</span>
        <span><strong>{{ __('title.tag') }}</strong> collection</span>
      </div>
    </section>

    <div class="posts-collapse">
      <div class="collection-title">
        <h2 class="collection-header">
          {{- page.tag }}
          <small>{{ __('title.tag') }}</small>
        </h2>
      </div>

      {{ post_template.render(page.posts) }}
    </div>
  </div>
  {#####################}
  {### END TAG BLOCK ###}
  {#####################}

  {% include '_partials/pagination.swig' %}

{% endblock %}

{% block sidebar %}
  {{ sidebar_template.render(false) }}
{% endblock %}
