{% extends '_layout.swig' %}
{% import '_macro/post-collapse.swig' as post_template with context %}
{% import '_macro/sidebar.swig' as sidebar_template with context %}

{% block title %}分类：{{ page.category }} | {{ title }}{% endblock %}

{% block class %}category{% endblock %}

{% block content %}

  {######################}
  {### CATEGORY BLOCK ###}
  {######################}
  <div class="post-block">
    <section class="category-detail-hero page-identity-hero" aria-label="分类文章">
      <div class="page-hero-kicker">Category Record / Archive Index</div>
      <h1 class="page-hero-title">{{ page.category }}</h1>
      <p class="page-hero-desc">收录在同一内容分类下的文章。</p>
      <div class="page-hero-stats">
        <span><strong>{{ page.posts.length }}</strong> 篇文章</span>
        <span><strong>分类</strong> 记录</span>
      </div>
    </section>

    <div class="posts-collapse">
      <div class="collection-title">
        <h2 class="collection-header">
          {{- page.category }}
          <small>分类</small>
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
