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
          <h1 class="page-hero-title">关于这间百货公司</h1>
          <p class="page-hero-desc">这里收纳小说、游戏、动画、日常与那些暂时无法归类的废墟回声。</p>
          <div class="page-hero-stats">
            <span><strong>{{ site.posts.length }}</strong> dispatches</span>
            <span><strong>{{ site.tags.length }}</strong> tags</span>
            <span><strong>Z.A.T.O</strong> archive</span>
          </div>
        </section>
      {%- elif page.type === 'tags' %}
        <section class="tag-index-hero page-identity-hero" aria-label="Tag index">
          <div class="page-hero-kicker">Tag Index / Dept. Store Directory</div>
          <h1 class="page-hero-title">标签索引</h1>
          <p class="page-hero-desc">把散落的文章按气味、主题和情绪重新编号。选择一个标签，就像打开一只仍有余温的抽屉。</p>
          <div class="page-hero-stats">
            <span><strong>{{ site.tags.length }}</strong> tags</span>
            <span><strong>{{ site.posts.length }}</strong> entries</span>
            <span><strong>NO.</strong> 30-000</span>
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
              {{ _p('counter.tag_cloud', site.tags.length) }}
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
              <span class="about-profile-label">STOREKEEPER</span>
              <strong>Aikeko</strong>
              <em>世界尽头的百货公司</em>
            </div>
            <div class="about-prose">
              {{ page.content }}
            </div>
          </div>
        {% elif page.type === 'categories' %}
          <div class="category-all-page">
            <div class="category-all-title">
              {{ _p('counter.categories', site.categories.length) }}
            </div>
            <div class="category-all">
              {{ list_categories() }}
            </div>
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
