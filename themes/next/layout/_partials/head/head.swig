<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=2">
<meta name="theme-color" content="{{ theme.android_chrome_color }}">
<meta name="generator" content="Hexo {{ hexo_version }}">

{%- if theme.favicon.apple_touch_icon %}
  <link rel="apple-touch-icon" sizes="180x180" href="{{ url_for(theme.favicon.apple_touch_icon) }}">
{%- endif %}
{%- if theme.favicon.medium %}
  <link rel="icon" type="image/png" sizes="32x32" href="{{ url_for(theme.favicon.medium) }}">
{%- endif %}
{%- if theme.favicon.small %}
  <link rel="icon" type="image/png" sizes="16x16" href="{{ url_for(theme.favicon.small) }}">
{%- endif %}
{%- if theme.favicon.safari_pinned_tab %}
  <link rel="mask-icon" href="{{ url_for(theme.favicon.safari_pinned_tab) }}" color="{{ theme.android_chrome_color }}">
{%- endif %}

{# Web App Manifest for PWA #}
<link rel="manifest" href="{{ url_for('/manifest.json') }}">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="档案馆">
<meta name="application-name" content="Aike · Echo">
<meta name="msapplication-TileColor" content="#1e2128">
<meta name="msapplication-tap-highlight" content="no">

{%- if theme.favicon.ms_browserconfig %}
  <meta name="msapplication-config" content="{{ url_for(theme.favicon.ms_browserconfig) }}">
{%- endif %}

{%- if theme.disable_baidu_transformation %}
  <meta http-equiv="Cache-Control" content="no-transform">
  <meta http-equiv="Cache-Control" content="no-siteapp">
{%- endif %}
{%- if theme.google_site_verification %}
  <meta name="google-site-verification" content="{{ theme.google_site_verification }}">
{%- endif %}
{%- if theme.bing_site_verification %}
  <meta name="msvalidate.01" content="{{ theme.bing_site_verification }}">
{%- endif %}
{%- if theme.yandex_site_verification %}
  <meta name="yandex-verification" content="{{ theme.yandex_site_verification }}">
{%- endif %}
{%- if theme.baidu_site_verification %}
  <meta name="baidu-site-verification" content="{{ theme.baidu_site_verification }}">
{%- endif %}

<link rel="stylesheet" href="{{ url_for(theme.css) }}/main.css">

{# The archive background is used by every page. Discover it before CSS
   parsing so the homepage hero can paint as soon as the connection is ready. #}
<link rel="preload" as="image" href="{{ url_for('/images/Z.A.T.O_02_ca04.jpg') }}" fetchpriority="high">

{{ next_font() }}

{%- set font_awesome_uri = theme.vendors.fontawesome or next_vendors('font-awesome/css/all.min.css') %}
<link rel="stylesheet" href="{{ font_awesome_uri }}">

{%- if theme.fancybox %}
  {%- set fancybox_css_uri = theme.vendors.fancybox_css or next_vendors('//cdn.jsdelivr.net/gh/fancyapps/fancybox@3/dist/jquery.fancybox.min.css') %}
  <link rel="stylesheet" href="{{ fancybox_css_uri }}">
{%- endif %}

{%- if theme.pace.enable %}
  {%- set pace_css_uri = theme.vendors.pace_css or next_vendors('pace/pace-theme-' + theme.pace.theme + '.min.css') %}
  {%- set pace_js_uri = theme.vendors.pace or next_vendors('pace/pace.min.js') %}
  <link rel="stylesheet" href="{{ pace_css_uri }}">
  <script src="{{ pace_js_uri }}"></script>
{%- endif %}

{{ next_config() }}

{# Long Text Optimizer #}
<script src="{{ url_for('/js/long-text-loader.js') }}" async></script>
<script src="{{ url_for('/js/mobile-background.js') }}" defer></script>

{# Service Worker Registration: disabled and cleaned on local preview #}
<script>
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    var hostname = location.hostname;
    var isPrivateNetwork = /^10\./.test(hostname) ||
      /^192\.168\./.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
      /\.local$/i.test(hostname);
    var isLocalPreview = ['localhost', '127.0.0.1', '0.0.0.0', '::1'].indexOf(hostname) !== -1 || isPrivateNetwork;

    if (isLocalPreview) {
      navigator.serviceWorker.getRegistrations()
        .then(function(registrations) {
          return Promise.all(registrations.map(function(registration) {
            return registration.unregister();
          }));
        })
        .then(function() {
          if (!window.caches) return [];
          return caches.keys().then(function(keys) {
            return Promise.all(keys.filter(function(key) {
              return key.indexOf('blog-') === 0;
            }).map(function(key) {
              return caches.delete(key);
            }));
          });
        })
        .then(function() {
          console.log('[ServiceWorker] Local preview cleanup complete.');
        })
        .catch(function(error) {
          console.log('[ServiceWorker] Local preview cleanup failed:', error);
        });
      return;
    }

    navigator.serviceWorker.register('/sw.js')
      .then(function(registration) {
        console.log('[ServiceWorker] Registered:', registration.scope);
      })
      .catch(function(error) {
        console.log('[ServiceWorker] Registration failed:', error);
      });
  });
}
</script>
