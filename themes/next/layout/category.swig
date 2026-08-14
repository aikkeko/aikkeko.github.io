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
    {{ partial('_partials/page/identity-hero.swig', {
      hero_class: 'category-detail-hero', hero_label: '分类文章', hero_kicker: 'CATEGORY RECORD',
      hero_title: page.category, hero_desc: '收录在同一内容分类下的文章。',
      hero_stats: [{ value: page.posts.length, label: '篇文章' }, { value: '分类', label: '记录' }]
    }) }}

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
