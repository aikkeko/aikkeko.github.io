{% extends '_layout.swig' %}

{% block title %}{{ title }}{%- if theme.index_with_subtitle and subtitle %} - {{ subtitle }}{%- endif %}{% endblock %}

{% block class %}index{% endblock %}

{% block content %}
{%- set is_first_index_page = not page.current or page.current == 1 %}
{%- if is_first_index_page %}
{# Hero Section - Full screen immersive landing page #}
<div class="hero-section">
  <div class="hero-mask"></div>
  <div class="hero-catalogue-labels" aria-hidden="true">
    <span class="hero-label hero-label-lost">LOST PROPERTY OFFICE</span>
    <span class="hero-label hero-label-record">RECORD 07 / RETURNED DREAMS</span>
    <span class="hero-label hero-label-aisle">AISLE OF QUIET WEATHER</span>
    <span class="hero-label hero-label-water">WATER RATION / BISCUIT TIN</span>
    <span class="hero-label hero-label-defect">DEFECTIVE MEMORIES</span>
    <span class="hero-label hero-label-after">AFTER CLOSING HOURS</span>
    <span class="hero-label hero-label-map">NO MAP FOR THIS AISLE</span>
    <span class="hero-label hero-label-remember">ITEMS MAY REMEMBER YOU</span>
    <span class="hero-label hero-label-fragile">FRAGILE / KEEP DRY</span>
    <span class="hero-label hero-label-static">OPEN UNTIL STATIC ENDS</span>
  </div>
  <div class="hero-content">
    <div class="hero-text">
      <div class="hero-kicker">艾声回响</div>
      <h1 class="site-title-main">{{ title }}</h1>
      {%- if subtitle %}
      <p class="site-subtitle-main hero-subtitle-reveal">{{ subtitle }}</p>
      {%- endif %}
    </div>
    <a href="#posts-section" class="scroll-down" aria-label="向下滚动">
      <div class="scroll-down-icon">
        <i class="fa fa-chevron-down"></i>
      </div>
    </a>
  </div>
</div>
{%- endif %}

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
    
    <article class="post-card{% if is_first_index_page and loop.first %} post-card-featured{% endif %}" itemscope itemtype="http://schema.org/Article">
      {%- if hero_image %}
      <div class="post-card-image">
        <a href="{{ url_for(post.path) }}">
          <img class="post-card-cover" src="{{ hero_image }}" alt="{{ post.title }}" itemprop="image" loading="lazy" onload="this.closest('.post-card-image').classList.add('is-loaded')" onerror="this.closest('.post-card-image').classList.add('is-loaded'); this.remove()">
        </a>
      </div>
      {%- endif %}
      
      <div class="post-card-content">
        <div class="post-card-heading">
          <h2 class="post-card-title" itemprop="name headline">
            <a href="{{ url_for(post.path) }}" itemprop="url">{{ post.title or __('post.untitled') }}</a>
          </h2>
          <span class="post-card-index" aria-hidden="true"></span>
        </div>
        
        {# A configured description wins; otherwise derive the card copy from the article body. #}
        {%- set card_description = post.description or post.excerpt or post.content %}
        {%- if card_description %}
        <div class="post-card-excerpt" itemprop="description">
          {{ card_description | replace(r/<[^>]+>/g, '') | truncate(280, '...') }}
        </div>
        {%- endif %}
        
        <div class="post-card-meta">
          <span class="post-meta-item post-card-date">
            <i class="far fa-calendar"></i>
            <time datetime="{{ moment(post.date).format() }}" itemprop="dateCreated datePublished">
              {{ moment(post.date).locale('en').format('MMM DD, YYYY') }}
            </time>
          </span>
          
          {%- if post.categories and post.categories.length %}
          <span class="post-meta-item post-card-category">
            <i class="far fa-folder"></i>
            {%- for cat in post.categories.toArray() %}
              <a href="{{ url_for(cat.path) }}">{{ cat.name }}</a>
              {%- if not loop.last %}, {%- endif %}
            {%- endfor %}
          </span>
          {%- endif %}
          
          {%- if post.tags and post.tags.length %}
          {%- set visible_tags = post.tags.toArray().slice(0, 2) %}
          <span class="post-meta-item post-card-tags">
            <i class="far fa-tags"></i>
            {%- for tag in visible_tags %}
              <a href="{{ url_for(tag.path) }}">#{{ tag.name }}</a>
              {%- if not loop.last %}<span class="tag-separator">, </span>{%- endif %}
            {%- endfor %}
            {%- if post.tags.length > visible_tags.length %}
              <span class="tag-more">+{{ post.tags.length - visible_tags.length }}</span>
            {%- endif %}
          </span>
          {%- endif %}
          
          <span class="post-meta-item post-card-words">
            <i class="far fa-file-word"></i> {{ wordcount(post.content) }} words
          </span>
          
          <span class="post-meta-item post-card-reading-time">
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
  // A short, deliberate descent from the cover to the archive list.
  (function() {
    var trigger = document.querySelector('.scroll-down[href="#posts-section"]');
    var target = document.getElementById('posts-section');
    if (!trigger || !target) return;

    trigger.addEventListener('click', function(event) {
      event.preventDefault();

      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        target.scrollIntoView();
        return;
      }

      var startY = window.scrollY || window.pageYOffset;
      var targetY = target.getBoundingClientRect().top + startY;
      var distance = targetY - startY;
      var duration = 480;
      var startedAt = performance.now();

      function easeInOutCubic(progress) {
        return progress < 0.5
          ? 4 * progress * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 3) / 2;
      }

      function step(now) {
        var progress = Math.min((now - startedAt) / duration, 1);
        window.scrollTo(0, startY + distance * easeInOutCubic(progress));
        if (progress < 1) {
          requestAnimationFrame(step);
        } else {
          history.replaceState(null, '', '#posts-section');
        }
      }

      requestAnimationFrame(step);
    });
  })();

  // Pagination is a continuation of the archive list, not a replay of the cover.
  document.querySelectorAll('#posts-section .pagination a').forEach(function(link) {
    var target = new URL(link.href, window.location.href);
    target.hash = 'posts-section';
    link.href = target.href;
  });
</script>

{% endblock %}

{% block sidebar %}{% endblock %}
