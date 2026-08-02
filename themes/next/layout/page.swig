{% extends '_layout.swig' %}
{% import '_macro/sidebar.swig' as sidebar_template with context %}

{% block title %}
  {%- set page_title_suffix = ' | ' + title %}

  {%- if page.type === 'categories' and not page.title %}
    {{- __('title.category') + page_title_suffix }}
  {%- elif page.type === 'tags' and not page.title %}
    {{- __('title.tag') + page_title_suffix }}
  {%- elif page.type === 'schedule' and not page.title %}
    {{- __('title.schedule') + page_title_suffix }}
  {%- else %}
    {{- page.title + page_title_suffix }}
  {%- endif %}
{% endblock %}

{% block class %}page posts-expand{% endblock %}

{% block content %}

    {%- set archive_config = site.data.archive or {} %}
    {%- set media_archive = archive_config.media or {} %}
    {%- set media_page = media_archive.page or {} %}
    {%- set media_items = media_archive.items or [] %}
    {%- set media_featured_id = media_archive.featured %}
    {%- if not media_featured_id and media_items.length %}
      {%- set media_featured_id = media_items[0].id %}
    {%- endif %}
    {##################}
    {### PAGE BLOCK ###}
    {##################}
    <div class="post-block" lang="{{ page.lang or config.language }}">
      {%- if page.type === 'about' %}
        <section class="about-hero page-identity-hero" aria-label="About this site">
          <div class="page-hero-kicker">Site Notes / Keeper Profile</div>
          <h1 class="page-hero-title">About</h1>
          <p class="page-hero-desc">记录书籍、动画、游戏、日常，以及未被归类的回声。</p>
          <div class="page-hero-stats">
            <span><strong>{{ site.posts.length }}</strong> 篇文章</span>
            <span><strong>{{ site.tags.length }}</strong> 个标签</span>
            <span><strong>{{ media_items.length }}</strong> 份声像</span>
          </div>
        </section>
      {%- elif page.type === 'tags' %}
        <section class="tag-index-hero page-identity-hero" aria-label="标签索引">
          <div class="page-hero-kicker">Tag Index / Quick Filter</div>
          <h1 class="page-hero-title">Tag Index</h1>
          <p class="page-hero-desc">按照主题与内容线索查找文章。</p>
          <div class="page-hero-stats">
            <span><strong>{{ site.tags.length }}</strong> 个标签</span>
            <span><strong>{{ site.posts.length }}</strong> 篇文章</span>
          </div>
        </section>
      {%- elif page.type === 'categories' %}
        <section class="category-index-hero page-identity-hero" aria-label="分类索引">
          <div class="page-hero-kicker">Category Index / Reading Route</div>
          <h1 class="page-hero-title">Category Index</h1>
          <p class="page-hero-desc">按照主要内容类别浏览文章。</p>
          <div class="page-hero-stats">
            <span><strong>{{ site.categories.length }}</strong> 个分类</span>
            <span><strong>{{ site.tags.length }}</strong> 个标签</span>
          </div>
        </section>
      {%- elif page.type === 'resources' %}
        <section class="resource-hero page-identity-hero" aria-label="资源索引">
          <div class="page-hero-kicker">Resource Index / External Records</div>
          <h1 class="page-hero-title">Resource Index</h1>
          <p class="page-hero-desc">收录链接、书单与常用工具。</p>
          <div class="page-hero-stats">
            <span><strong>资料</strong> 索引</span>
            <span><strong>逐步</strong> 补充</span>
          </div>
        </section>
      {%- elif page.type === 'media' %}
        <section class="media-hero page-identity-hero" aria-label="声像档案">
          <div class="page-hero-kicker">{{ media_page.kicker or 'Signal Index / Recorded Transmissions' }}</div>
          <h1 class="page-hero-title">{{ media_page.title or 'Signal Archive' }}</h1>
          <p class="page-hero-desc">{{ media_page.description or '收录电台、视频与那些值得被保留的声音。' }}</p>
          <div class="page-hero-stats">
            <span><strong>{{ media_items.length }}</strong> 条声像</span>
          </div>
        </section>
      {%- else %}
        {% include '_partials/page/page-header.swig' %}
      {%- endif %}
      {#################}
      {### PAGE BODY ###}
      {#################}
      <div class="post-body{%- if page.direction and page.direction.toLowerCase() === 'rtl' %} rtl{%- endif %}">
        {%- if page.type === 'tags' %}
          <div class="tag-cloud tag-index-panel">
            <div class="tag-cloud-title">
              共收录 {{ site.tags.length }} 个标签
            </div>
            <div class="tag-cloud-tags">
              {{ tagcloud({
                min_font   : theme.tagcloud.min,
                max_font   : theme.tagcloud.max,
                amount     : theme.tagcloud.amount,
                color      : true,
                start_color: theme.tagcloud.start,
                end_color  : theme.tagcloud.end})
              }}
            </div>
          </div>
        {% elif page.type === 'about' %}
          <div class="about-content-panel">
            <div class="about-prose">
              {{ page.content }}
            </div>
          </div>
        {% elif page.type === 'categories' %}
          <div class="category-all-page category-index-panel">
            <div class="category-all-title">
              共收录 {{ site.categories.length }} 个分类
            </div>
            <div class="category-all">
              {{ list_categories() }}
            </div>
          </div>
        {% elif page.type === 'resources' %}
          <div class="resource-panel">
            <span class="resource-panel-kicker">资源说明</span>
            <p>这里将逐步整理链接、阅读路径与站外资料。</p>
          </div>
        {% elif page.type === 'media' %}
          <section class="media-archive" data-media-archive>
            {% if media_items.length %}
              <div class="media-toolbar" aria-label="筛选声像档案">
                <label class="media-search">
                  <i class="fa fa-search" aria-hidden="true"></i>
                  <span class="media-visually-hidden">搜索声像档案</span>
                  <input type="search" autocomplete="off" placeholder="搜索标题、平台或标签" data-media-search>
                </label>
                <span class="media-result-counter">共 <strong data-media-result-count>{{ media_items.length }}</strong> 项</span>
              </div>

              <div class="media-grid">
                {% for item in media_items %}
                  <article class="media-card{% if item.id === media_featured_id %} is-featured{% endif %}{% if item.embed %} has-player{% endif %}" data-media-card>
                    <div class="media-card-cover{% if item.embed %} has-embed{% elif not item.cover %} is-placeholder{% endif %}">
                      {% if item.embed %}
                        <div class="media-card-player" data-media-player data-media-embed="{{ item.embed }}">
                          <button class="media-player-launch" type="button" data-media-play aria-label="播放：{{ item.title }}">
                            {% if item.cover %}
                              <img src="{{ item.cover }}" alt="" loading="lazy" referrerpolicy="no-referrer">
                            {% endif %}
                            <span class="media-player-play" aria-hidden="true"><i class="fa fa-play"></i></span>
                          </button>
                          <div class="media-player-frame" data-media-frame hidden></div>
                        </div>
                      {% elif item.cover %}
                        <img src="{{ item.cover }}" alt="" loading="lazy" referrerpolicy="no-referrer">
                      {% else %}
                        <i class="fa fa-wave-square" aria-hidden="true"></i>
                      {% endif %}
                      {% if not item.embed %}<span class="media-card-kind">已归档</span>{% endif %}
                    </div>
                    <div class="media-card-content">
                      <h2 class="media-card-title">{{ item.title }}</h2>
                      {% if item.description %}<p class="media-card-description">{{ item.description }}</p>{% endif %}
                      <div class="media-card-meta">
                        {% if item.platform %}<span><i class="fa fa-satellite-dish" aria-hidden="true"></i>{{ item.platform }}</span>{% endif %}
                        {% if item.date %}<time datetime="{{ item.date }}"><i class="far fa-calendar" aria-hidden="true"></i>{{ moment(item.date).locale('en').format('MMM DD, YYYY') }}</time>{% endif %}
                        {% if item.duration %}<span><i class="far fa-clock" aria-hidden="true"></i>{{ item.duration }}</span>{% endif %}
                      </div>
                      {% if item.tags and item.tags.length %}
                        <div class="media-card-tags" aria-label="标签">
                          {% for tag in item.tags %}<span># {{ tag }}</span>{% endfor %}
                        </div>
                      {% endif %}
                      {% if item.url %}
                        <button class="media-card-action" type="button" data-media-open="{{ item.url }}">
                          打开原页面 <i class="fa fa-arrow-right" aria-hidden="true"></i>
                        </button>
                      {% else %}
                        <span class="media-card-action is-disabled">链接待补</span>
                      {% endif %}
                    </div>
                  </article>
                {% endfor %}
              </div>

              <div class="media-no-results" data-media-no-results hidden>
                <span>没有匹配的声像</span>
                <p>当前筛选条件下没有找到记录。</p>
                <button type="button" data-media-reset>清除筛选</button>
              </div>
            {% else %}
              <div class="media-empty-state">
                <i class="fa fa-wave-square" aria-hidden="true"></i>
                <span>尚未收录声像</span>
                <p>可在 <code>source/_data/archive.yml</code> 中添加第一条记录。</p>
              </div>
            {% endif %}
          </section>
          <script src="{{ url_for('/js/media-archive.js') }}" defer></script>
        {% elif page.type === 'schedule' %}
          <div class="event-list">
          </div>
          {% include '_scripts/pages/schedule.swig' %}
        {% else %}
          {{ page.content }}
        {%- endif %}
      </div>
      {#####################}
      {### END PAGE BODY ###}
      {#####################}
    </div>
    {% include '_partials/page/breadcrumb.swig' %}
    {######################}
    {### END PAGE BLOCK ###}
    {######################}

{% endblock %}

{% block sidebar %}
  {{ sidebar_template.render(true) }}
{% endblock %}
