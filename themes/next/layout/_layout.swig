<!DOCTYPE html>
<html lang="{{ config.language }}">
<head>
  {%- if is_home() and (not page.current or page.current == 1) %}
  <style>
    .archive-background-opening {
      position: fixed;
      inset: 0;
      z-index: 0;
      background: rgba(3, 4, 5, .92);
      opacity: 1;
      visibility: visible;
      pointer-events: none;
    }
    .archive-background-opening.is-revealing {
      animation: archive-background-reveal 1.35s cubic-bezier(.18,.72,.22,1) .72s forwards;
    }
    body > .container {
      position: relative;
      z-index: 1;
    }
    @keyframes archive-background-reveal {
      0% { opacity: 1; }
      100% { opacity: 0; visibility: hidden; pointer-events: none; }
    }
  </style>
  {%- endif %}
  {{ partial('_partials/head/head.swig', {}, {cache: theme.cache.enable}) }}
  {% include '_partials/head/head-unique.swig' %}
  {{- next_inject('head') }}
  <title>{% block title %}{% endblock %}</title>
  {{ partial('_third-party/analytics/index.swig', {}, {cache: theme.cache.enable}) }}
  {{ partial('_scripts/noscript.swig', {}, {cache: theme.cache.enable}) }}
</head>

<body class="{% if is_post() %}post-detail{% endif %}{% if is_home() %} home-page{% endif %}" itemscope itemtype="http://schema.org/WebPage">
  {%- if is_home() and (not page.current or page.current == 1) %}
    <div class="archive-background-opening" aria-hidden="true"></div>
    <script>
      (function() {
        var opening = document.querySelector('.archive-background-opening');
        if (!opening) return;

        var reveal = function() {
          if (opening.classList.contains('is-revealing')) return;
          requestAnimationFrame(function() {
            requestAnimationFrame(function() {
              opening.classList.add('is-revealing');
            });
          });
        };

        if (document.readyState !== 'loading') {
          reveal();
        } else {
          document.addEventListener('DOMContentLoaded', reveal, { once: true });
        }

        // Start promptly even if parsing or a third-party resource stalls.
        window.setTimeout(reveal, 800);
        opening.addEventListener('animationend', function() {
          opening.remove();
        }, { once: true });
      })();
    </script>
  {%- endif %}
  <div class="container{%- if theme.motion.enable %} use-motion{%- endif %}">
    <div class="zato-background-quotes" aria-hidden="true">
      <span class="zato-quote zato-quote-left">ALL STORIES ARE LOST PROPERTY</span>
      <span class="zato-quote zato-quote-right">THE LAST ARCHIVE REMAINS OPEN</span>
      <span class="zato-quote zato-quote-top">PLEASE RETURN BORROWED DREAMS</span>
      <span class="zato-quote zato-quote-mid">MEMORY IS AN INDEX WITHOUT A MAP</span>
      <span class="zato-quote zato-quote-bottom">NO REFUNDS AFTER THE END OF THE WORLD</span>
      <span class="zato-quote zato-quote-code">WATER &amp; BISCUIT / AISLE 30</span>
    </div>
    <div class="headband"></div>

    <header class="header" itemscope itemtype="http://schema.org/WPHeader">
      <div class="header-inner">{% include '_partials/header/index.swig' %}</div>
    </header>

    {{ partial('_partials/widgets.swig', {}, {cache: theme.cache.enable}) }}

    <main class="main">
      <div class="main-inner">
        <div class="content-wrap">
          {% include '_partials/header/sub-menu.swig' %}
          <div class="content {% block class %}{% endblock %}">
            {% block content %}{% endblock %}
          </div>
          {% include '_partials/comments.swig' %}
        </div>
        {%- if theme.sidebar.display !== 'remove' and not is_home() %}
          {% block sidebar %}{% endblock %}
        {%- endif %}
      </div>
    </main>

    <footer class="footer">
      <div class="footer-inner">
        {% include '_partials/languages.swig' %}
        {{ partial('_partials/footer.swig', {}, {cache: theme.cache.enable}) }}
        {{ partial('_third-party/statistics/index.swig', {}, {cache: theme.cache.enable}) }}
      </div>
    </footer>
  </div>

  {{ partial('_partials/search/index.swig', {}, {cache: theme.cache.enable}) }}

  {{ partial('_scripts/index.swig', {}, {cache: theme.cache.enable}) }}
  {{ partial('_third-party/index.swig', {}, {cache: theme.cache.enable}) }}

  {%- if theme.pjax %}
    <div id="pjax">
  {%- endif %}
  {% include '_third-party/math/index.swig' %}
  {% include '_third-party/quicklink.swig' %}

  {{- next_inject('bodyEnd') }}
  {%- if theme.pjax %}
    </div>
  {%- endif %}
</body>
</html>
