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
