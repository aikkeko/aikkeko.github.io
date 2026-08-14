<section class="page-identity-hero{% if hero_class %} {{ hero_class }}{% endif %}" aria-label="{{ hero_label or hero_title }}">
  <div class="page-hero-kicker{% if hero_class == 'archive-hero' %} archive-hero-kicker{% endif %}">{{ hero_kicker }}</div>
  <h1 class="page-hero-title{% if hero_class == 'archive-hero' %} archive-hero-title{% endif %}">{{ hero_title }}</h1>
  {% if hero_desc %}<p class="page-hero-desc{% if hero_class == 'archive-hero' %} archive-hero-desc{% endif %}">{{ hero_desc }}</p>{% endif %}
  {% if hero_stats and hero_stats.length %}
    <div class="page-hero-stats{% if hero_class == 'archive-hero' %} archive-hero-stats{% endif %}">
      {% for stat in hero_stats %}
        <span><strong>{{ stat.value }}</strong>{% if stat.label %} {{ stat.label }}{% endif %}</span>
      {% endfor %}
    </div>
  {% endif %}
</section>
