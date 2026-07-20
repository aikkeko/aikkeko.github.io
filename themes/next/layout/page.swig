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
    {%- set media_radio_count = 0 %}
    {%- set media_video_count = 0 %}
    {%- for media_item in media_items %}
      {%- if media_item.type === 'radio' %}
        {%- set media_radio_count = media_radio_count + 1 %}
      {%- elif media_item.type === 'video' %}
        {%- set media_video_count = media_video_count + 1 %}
      {%- endif %}
    {%- endfor %}

    {##################}
    {### PAGE BLOCK ###}
    {##################}
    <div class="post-block" lang="{{ page.lang or config.language }}">
      {%- if page.type === 'about' %}
        <section class="about-hero page-identity-hero" aria-label="About this site">
          <div class="page-hero-kicker">Keeper Profile / Z.A.T.O</div>
          <h1 class="page-hero-title">About the Archive</h1>
          <p class="page-hero-desc">Notes on games, fiction, anime, stray days, and ruined echoes.</p>
          <div class="page-hero-stats">
            <span><strong>{{ site.posts.length }}</strong> dispatches</span>
            <span><strong>{{ site.tags.length }}</strong> tags</span>
            <span><strong>Z.A.T.O</strong> archive</span>
          </div>
        </section>
      {%- elif page.type === 'tags' %}
        <section class="tag-index-hero page-identity-hero" aria-label="Tag index">
          <div class="page-hero-kicker">Tag Index / Quick Filter</div>
          <h1 class="page-hero-title">Tag Index</h1>
          <p class="page-hero-desc">Find records by theme, mood, or residue.</p>
          <div class="page-hero-stats">
            <span><strong>{{ site.tags.length }}</strong> tags</span>
            <span><strong>{{ site.posts.length }}</strong> entries</span>
            <span><strong>NO.</strong> 30-000</span>
          </div>
        </section>
      {%- elif page.type === 'categories' %}
        <section class="category-index-hero page-identity-hero" aria-label="Category index">
          <div class="page-hero-kicker">Category Index / Archive Route</div>
          <h1 class="page-hero-title">Category Index</h1>
          <p class="page-hero-desc">Broad routes through the archive.</p>
          <div class="page-hero-stats">
            <span><strong>{{ site.categories.length }}</strong> categories</span>
            <span><strong>{{ site.tags.length }}</strong> tags</span>
            <span><strong>ARCHIVE</strong> map</span>
          </div>
        </section>
      {%- elif page.type === 'resources' %}
        <section class="resource-hero page-identity-hero" aria-label="Resource index">
          <div class="page-hero-kicker">Resource Index / Back Archive</div>
          <h1 class="page-hero-title">Resource Index</h1>
          <p class="page-hero-desc">Useful links, lists, and tools.</p>
          <div class="page-hero-stats">
            <span><strong>Z.A.T.O</strong> index</span>
            <span><strong>OPEN</strong> soon</span>
          </div>
        </section>
      {%- elif page.type === 'media' %}
        <section class="media-hero page-identity-hero" aria-label="Signal archive">
          <div class="page-hero-kicker">{{ media_page.kicker or 'Signal Archive / Broadcast & Moving Image' }}</div>
          <h1 class="page-hero-title">{{ media_page.title or '声像档案' }}</h1>
          <p class="page-hero-desc">{{ media_page.description or 'Radio conversations, video essays, and signals preserved beyond the feed.' }}</p>
          <div class="page-hero-stats">
            <span><strong>{{ media_items.length }}</strong> records</span>
            <span><strong>{{ media_radio_count }}</strong> radio</span>
            <span><strong>{{ media_video_count }}</strong> video</span>
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
              {{ site.tags.length }} TAGS IN FILE
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
            <div class="about-profile-card" aria-hidden="true">
              <span class="about-profile-label">CUSTODIAN</span>
              <strong>Aikeko</strong>
              <em>Archive at World's End</em>
            </div>
            <div class="about-prose">
              {{ page.content }}
            </div>
          </div>
        {% elif page.type === 'categories' %}
          <div class="category-all-page category-index-panel">
            <div class="category-all-title">
              {{ site.categories.length }} CATEGORIES IN FILE
            </div>
            <div class="category-all">
              {{ list_categories() }}
            </div>
          </div>
        {% elif page.type === 'resources' %}
          <div class="resource-panel">
            <span class="resource-panel-kicker">ARCHIVE NOTE</span>
            <p>Reserved for links, reading paths, and external records.</p>
          </div>
        {% elif page.type === 'media' %}
          <section class="media-archive" data-media-archive>
            {% if media_items.length %}
              <div class="media-toolbar" aria-label="Filter signal archive">
                <div class="media-filter-group" role="group" aria-label="Media type">
                  <button class="media-filter is-active" type="button" data-media-filter="all" aria-pressed="true">All Signals</button>
                  <button class="media-filter" type="button" data-media-filter="radio" aria-pressed="false">Radio</button>
                  <button class="media-filter" type="button" data-media-filter="video" aria-pressed="false">Video</button>
                </div>
                <label class="media-search">
                  <i class="fa fa-search" aria-hidden="true"></i>
                  <span class="media-visually-hidden">Search signal archive</span>
                  <input type="search" autocomplete="off" placeholder="Search title, platform, or tag" data-media-search>
                </label>
                <span class="media-result-counter"><strong data-media-result-count>{{ media_items.length }}</strong> visible</span>
              </div>

              <div class="media-grid">
                {% for item in media_items %}
                  <article class="media-card{% if item.id === media_featured_id %} is-featured{% endif %}{% if item.embed %} has-player{% endif %}" data-media-card data-media-type="{{ item.type or 'radio' }}">
                    <div class="media-card-cover{% if item.embed %} has-embed{% elif not item.cover %} is-placeholder{% endif %}">
                      {% if item.embed %}
                        <div class="media-card-player">
                          <iframe src="{{ item.embed }}" title="{{ item.title }}" scrolling="no" frameborder="0" loading="lazy" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>
                        </div>
                      {% elif item.cover %}
                        <img src="{{ item.cover }}" alt="" loading="lazy">
                      {% else %}
                        <i class="fa {% if item.type === 'video' %}fa-play{% else %}fa-headphones{% endif %}" aria-hidden="true"></i>
                      {% endif %}
                      {% if not item.embed %}<span class="media-card-kind">{{ 'Moving Image' if item.type === 'video' else 'Broadcast' }}</span>{% endif %}
                    </div>
                    <div class="media-card-content">
                      <div class="media-card-serial">
                        <span>{{ item.episode or 'UNFILED' }}</span>
                        {% if item.id === media_featured_id %}<em>Featured Signal</em>{% endif %}
                      </div>
                      <h2 class="media-card-title">{{ item.title }}</h2>
                      {% if item.description %}<p class="media-card-description">{{ item.description }}</p>{% endif %}
                      <div class="media-card-meta">
                        {% if item.platform %}<span><i class="fa fa-satellite-dish" aria-hidden="true"></i>{{ item.platform }}</span>{% endif %}
                        {% if item.date %}<time datetime="{{ item.date }}"><i class="far fa-calendar" aria-hidden="true"></i>{{ item.date }}</time>{% endif %}
                        {% if item.duration %}<span><i class="far fa-clock" aria-hidden="true"></i>{{ item.duration }}</span>{% endif %}
                      </div>
                      {% if item.tags and item.tags.length %}
                        <div class="media-card-tags" aria-label="Tags">
                          {% for tag in item.tags %}<span># {{ tag }}</span>{% endfor %}
                        </div>
                      {% endif %}
                      {% if item.url %}
                        <button class="media-card-action" type="button" data-media-open="{{ item.url }}">
                          Open Record <i class="fa fa-arrow-right" aria-hidden="true"></i>
                        </button>
                      {% else %}
                        <span class="media-card-action is-disabled">Link Pending</span>
                      {% endif %}
                    </div>
                  </article>
                {% endfor %}
              </div>

              <div class="media-no-results" data-media-no-results hidden>
                <span>NO MATCHING SIGNAL</span>
                <p>No record matches the current filter.</p>
                <button type="button" data-media-reset>Clear filters</button>
              </div>
            {% else %}
              <div class="media-empty-state">
                <i class="fa fa-wave-square" aria-hidden="true"></i>
                <span>NO SIGNALS CATALOGUED</span>
                <p>The cabinet is ready. Add the first record in <code>source/_data/archive.yml</code>.</p>
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
