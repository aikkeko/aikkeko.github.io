{% extends '_layout.swig' %}
{% import '_macro/sidebar.swig' as sidebar_template with context %}

{% block title %}{{ page.title }} | {{ title }}{% endblock %}

{% block class %}post posts-expand{% endblock %}

{% block content %}

  {# 获取头图 #}
  {%- set hero_image = null %}
  {%- if page.header_image %}
    {%- set hero_image = page.header_image %}
  {%- else %}
    {%- set img_regex = r/<img[^>]+src=["\']([^"\']+)["\'][^>]*>/i %}
    {%- set img_match = img_regex.exec(page.content) %}
    {%- if img_match %}
      {%- set hero_image = img_match[1] %}
    {%- endif %}
  {%- endif %}
  
  {%- if not hero_image and theme.hero_image.default_image %}
    {%- set hero_image = theme.hero_image.default_image %}
  {%- endif %}

  {# Banner 区域 - 仅在有头图时显示 #}
  {%- if hero_image %}
  <div class="post-banner" style="background-image: url('{{ hero_image }}'), url('/images/Z.A.T.O_02_ca04.jpg');">
    <div class="post-banner-mask"></div>
    <div class="post-banner-content">
      <div class="post-banner-text">
        <h1 class="post-banner-title" itemprop="name headline">{{ page.title }}</h1>
        
        <div class="post-banner-meta">
          <span class="post-banner-author">
            <i class="fa fa-user"></i> {{ config.author or 'Anonymous' }}
          </span>
          
          <span class="post-banner-date">
            <i class="fa fa-calendar"></i> {{ moment(page.date).format('MMM DD, YYYY') }}
          </span>
          
          {%- if page.categories and page.categories.length %}
          <span class="post-banner-category">
            <i class="fa fa-folder"></i>
            {%- for cat in page.categories.toArray() %}
              {{ cat.name }}{%- if not loop.last %}, {%- endif %}
            {%- endfor %}
          </span>
          {%- endif %}
          
          {%- set wordcount = wordcount(page.content) %}
          {%- set min2read = min2read(page.content) %}
          <span class="post-banner-words">
            <i class="fa fa-file-word"></i> {{ wordcount }} words
          </span>
          <span class="post-banner-reading-time">
            <i class="fa fa-clock"></i> {{ min2read }} min read
          </span>
        </div>
      </div>
    </div>
  </div>
  {%- endif %}

  {# 文章内容 #}
  {{ partial('_macro/post.swig', {post: page, has_banner: hero_image}) }}

{% endblock %}

{% block sidebar %}
  {{ sidebar_template.render(true) }}
{% endblock %}
