{% extends '_layout.swig' %}
{% import '_macro/post-collapse.swig' as post_template with context %}
{% import '_macro/sidebar.swig' as sidebar_template with context %}

{% block title %}Category: {{ page.category }} | {{ title }}{% endblock %}

{% block class %}category{% endblock %}

{% block content %}

  {######################}
  {### CATEGORY BLOCK ###}
  {######################}
  <div class="post-block">
    <section class="category-detail-hero page-identity-hero" aria-label="Categorized posts">
      <div class="page-hero-kicker">Category Record / Archive Index</div>
      <h1 class="page-hero-title">{{ page.category }}</h1>
      <p class="page-hero-desc">Records filed under one broad route.</p>
      <div class="page-hero-stats">
        <span><strong>{{ page.posts.length }}</strong> entries</span>
        <span><strong>category</strong> record</span>
      </div>
    </section>

    <div class="posts-collapse">
      <div class="collection-title">
        <h2 class="collection-header">
          {{- page.category }}
          <small>category</small>
        </h2>
      </div>

      {{ post_template.render(page.posts) }}
    </div>
  </div>
  {##########################}
  {### END CATEGORY BLOCK ###}
  {##########################}

  {% include '_partials/pagination.swig' %}

{% endblock %}

{% block sidebar %}
  {{ sidebar_template.render(false) }}
{% endblock %}
