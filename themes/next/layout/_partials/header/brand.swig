<div class="site-brand-container">
  <div class="site-nav-toggle">
    <div class="toggle" aria-label="{{ __('accessibility.nav_toggle') }}">
      <span class="toggle-line toggle-line-first"></span>
      <span class="toggle-line toggle-line-middle"></span>
      <span class="toggle-line toggle-line-last"></span>
    </div>
  </div>

  <div class="site-meta{%- if theme.custom_logo %} custom-logo{%- endif %}">
    {%- if theme.custom_logo %}
      <a href="{{ config.root }}" class="site-logo-link" rel="start" aria-label="{{ title }}">
        <img class="custom-logo-image" src="{{ theme.custom_logo }}" alt="">
      </a>
    {%- endif %}

    <a href="{{ config.root }}" class="brand" rel="start">
      <span class="logo-line-before"><i></i></span>
      <h1 class="site-title">{{ title }}</h1>
      <span class="logo-line-after"><i></i></span>
    </a>
  </div>

  <div class="site-nav-right">
    <div class="toggle popup-trigger">
      {%- if theme.algolia_search.enable or theme.local_search.enable %}
        <i class="fa fa-search fa-fw fa-lg"></i>
      {%- endif %}
    </div>
  </div>
</div>
