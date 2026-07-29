{% extends '_layout.swig' %}
{% import '_macro/post-collapse.swig' as post_template with context %}
{% import '_macro/sidebar.swig' as sidebar_template with context %}

{% block title %}归档 | {{ title }}{% endblock %}

{% block class %}archive{% endblock %}

{% block content %}

  {#####################}
  {### ARCHIVE BLOCK ###}
  {#####################}
  <div class="post-block">
    <section class="archive-hero" aria-label="归档概览">
      <div class="archive-hero-kicker">Chronological Index</div>
      <h1 class="archive-hero-title">Archive Index</h1>
      <p class="archive-hero-desc">所有文章按照进入档案的时间排列。</p>
      <div class="archive-hero-stats">
        <span><strong>{{ site.posts.length }}</strong> 篇文章</span>
        <span><strong>{{ site.tags.length }}</strong> 个标签</span>
        <span><strong>{{ moment(site.posts.last().date).format('YYYY') if site.posts.length else moment().format('YYYY') }}</strong> 最近年份</span>
      </div>
    </section>
    <div class="posts-collapse">
      <div class="collection-title">
        <span class="collection-header">馆藏清点完毕：当前共收录 {{ site.posts.length }} 份档案，新的记录仍在等待入馆。</span>
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
