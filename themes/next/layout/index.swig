{% extends '_layout.swig' %}

{% block title %}{{ title }}{%- if theme.index_with_subtitle and subtitle %} - {{ subtitle }}{%- endif %}{% endblock %}

{% block class %}index{% endblock %}

{% block content %}
{# Hero Section - Full screen immersive landing page #}
<div class="hero-section" style="background-image: url('{{ theme.index_hero_image or '/images/background.png' }}');">
  <div class="hero-mask"></div>
  <div class="hero-terminal" aria-hidden="true">
    <span>DEPT. STORE ARCHIVE</span>
    <span>NO. 30-000</span>
  </div>
  <div class="hero-content">
    <div class="hero-text">
      <div class="hero-kicker">Literary Archive / Z.A.T.O</div>
      <h1 class="site-title-main">{{ title }}</h1>
      {%- if subtitle %}
      <p class="site-subtitle-main" id="hero-typed" data-text="{{ subtitle }}"></p>
      {%- endif %}
      <div class="hero-rule" aria-hidden="true"></div>
    </div>
    <a href="#posts-section" class="scroll-down" aria-label="向下滚动">
      <div class="scroll-down-icon">
        <i class="fa fa-chevron-down"></i>
      </div>
      <div class="scroll-down-line"></div>
    </a>
  </div>
</div>

{# Posts Section #}
<div id="posts-section" class="posts-section">
  <div class="posts-container">
    {%- for post in page.posts.toArray() %}
    {%- set hero_image = null %}
    {%- if post.header_image %}
      {%- set hero_image = post.header_image %}
    {%- else %}
      {%- set img_regex = r/<img[^>]+src=["\']([^"\']+)["\'][^>]*>/i %}
      {%- set img_match = img_regex.exec(post.content) %}
      {%- if img_match %}
        {%- set hero_image = img_match[1] %}
      {%- endif %}
    {%- endif %}
    
    <article class="post-card" itemscope itemtype="http://schema.org/Article">
      {%- if hero_image %}
      <div class="post-card-image">
        <a href="{{ url_for(post.path) }}">
          <img src="{{ hero_image }}" alt="{{ post.title }}" itemprop="image" loading="lazy" onerror="this.remove()">
        </a>
      </div>
      {%- endif %}
      
      <div class="post-card-content">
        <h2 class="post-card-title" itemprop="name headline">
          <a href="{{ url_for(post.path) }}" itemprop="url">{{ post.title or __('post.untitled') }}</a>
        </h2>
        
        {%- if post.excerpt %}
        <div class="post-card-excerpt" itemprop="description">
          {{ post.excerpt | replace(r/<[^>]+>/g, '') | truncate(150, '...') }}
        </div>
        {%- endif %}
        
        <div class="post-card-meta">
          <span class="post-meta-item">
            <i class="far fa-calendar"></i>
            <time datetime="{{ moment(post.date).format() }}" itemprop="dateCreated datePublished">
              {{ moment(post.date).format('MMM DD, YYYY') }}
            </time>
          </span>
          
          {%- if post.categories and post.categories.length %}
          <span class="post-meta-item">
            <i class="far fa-folder"></i>
            {%- for cat in post.categories.toArray() %}
              <a href="{{ url_for(cat.path) }}">{{ cat.name }}</a>
              {%- if not loop.last %}, {%- endif %}
            {%- endfor %}
          </span>
          {%- endif %}
          
          {%- if post.tags and post.tags.length %}
          <span class="post-meta-item">
            <i class="far fa-tags"></i>
            {%- for tag in post.tags.toArray() %}
              <a href="{{ url_for(tag.path) }}">#{{ tag.name }}</a>
              {%- if not loop.last %}<span class="tag-separator">, </span>{%- endif %}
            {%- endfor %}
          </span>
          {%- endif %}
          
          <span class="post-meta-item">
            <i class="far fa-file-word"></i> {{ wordcount(post.content) }} words
          </span>
          
          <span class="post-meta-item">
            <i class="far fa-clock"></i> {{ min2read(post.content) }} min read
          </span>
        </div>
      </div>
    </article>
    {%- endfor %}
  </div>

  {% include '_partials/pagination.swig' %}
</div>

<script>
// Simple typing effect for hero subtitle
(function() {
  var typedElement = document.getElementById('hero-typed');
  if (!typedElement) return;
  
  var text = typedElement.getAttribute('data-text');
  if (!text) return;
  
  var index = 0;
  typedElement.textContent = '';
  
  function typeWriter() {
    if (index < text.length) {
      typedElement.textContent += text.charAt(index);
      index++;
      setTimeout(typeWriter, 100);
    }
  }
  
  setTimeout(typeWriter, 500);
})();
</script>

{% endblock %}

{% block sidebar %}{% endblock %}
