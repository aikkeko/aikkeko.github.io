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
    {{ partial('_partials/page/identity-hero.swig', {
      hero_class: 'archive-hero', hero_label: '归档概览', hero_kicker: 'CHRONOLOGICAL ARCHIVE',
      hero_title: '归档', hero_desc: '所有文章按照进入档案的时间排列。',
      hero_stats: [
        { value: site.posts.length, label: '篇文章' },
        { value: site.tags.length, label: '个标签' },
        { value: moment(site.posts.last().date).format('YYYY') if site.posts.length else moment().format('YYYY'), label: '最近年份' }
      ]
    }) }}
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
