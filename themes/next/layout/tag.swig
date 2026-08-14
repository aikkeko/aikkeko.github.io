{% extends '_layout.swig' %}
{% import '_macro/post-collapse.swig' as post_template with context %}
{% import '_macro/sidebar.swig' as sidebar_template with context %}

{% block title %}标签：{{ page.tag }} | {{ title }}{% endblock %}

{% block class %}tag{% endblock %}

{% block content %}

  {#################}
  {### TAG BLOCK ###}
  {#################}
  <div class="post-block">
    {{ partial('_partials/page/identity-hero.swig', {
      hero_class: 'tag-detail-hero', hero_label: '标签文章', hero_kicker: 'FILTERED RECORD',
      hero_title: '#' + page.tag, hero_desc: '收录在同一标签下的文章。',
      hero_stats: [{ value: page.posts.length, label: '篇文章' }, { value: '标签', label: '合集' }]
    }) }}

    <div class="posts-collapse">
      <div class="collection-title">
        <h2 class="collection-header">
          {{- page.tag }}
          <small>标签</small>
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
