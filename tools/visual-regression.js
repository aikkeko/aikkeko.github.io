'use strict';
const fs = require('fs');
const http = require('http');
const path = require('path');
const { launchBrowser, delay } = require('./lib/browser-test');
const ROOT = path.resolve(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const label = process.argv.includes('--baseline') ? 'baseline' : 'current';
const OUT = path.join(ROOT, 'artifacts/visual-regression', label + (process.env.TEST_HEIGHT ? '-height-' + Number(process.env.TEST_HEIGHT) : ''));
const widths = process.env.TEST_WIDTHS ? process.env.TEST_WIDTHS.split(',').map(Number) : [320, 375, 390, 430, 768, 1440];
const generatedPost = fs.readdirSync(PUBLIC).filter(name => /^\d{4}-\d{2}-\d{2}-.+\.html$/i.test(name))
  .sort((a, b) => fs.statSync(path.join(PUBLIC, b)).size - fs.statSync(path.join(PUBLIC, a)).size)[0];
const pages = [['home', '/'], ['about', '/about/'], ['tags', '/tags/'], ['archives', '/archives/'], ['media', '/media/']];
if (fs.existsSync(path.join(PUBLIC, 'page/2/index.html'))) pages.push(['page2', '/page/2/']);
if (generatedPost) pages.push(['post', '/' + generatedPost]);
const server = http.createServer((request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost');
    let file = path.resolve(PUBLIC, '.' + decodeURIComponent(url.pathname));
    if (file !== PUBLIC && !file.startsWith(PUBLIC + path.sep)) { response.writeHead(403).end(); return; }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) { response.writeHead(404).end(); return; }
    const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml' };
    response.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).pipe(response);
  } catch { response.writeHead(400).end(); }
});
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await launchBrowser();
  const results = [];
  try {
    for (const width of widths) {
      await browser.viewport(width, Number(process.env.TEST_HEIGHT) || (width < 769 ? 844 : 1000));
      for (const [name, route] of pages) {
        if (process.env.TEST_PAGES && !process.env.TEST_PAGES.split(',').includes(name)) continue;
        await browser.navigate(base + encodeURI(route));
        if (process.env.TEST_SETTLE_MS) await delay(Number(process.env.TEST_SETTLE_MS));
        const result = await browser.evaluate(`(() => {
          const selectors = ['.site-title-main', '.site-brand-container', '.post-card', '.media-card', '.post-body', '.archive-hero'];
          const boxes = selectors.flatMap(selector => [...document.querySelectorAll(selector)].slice(0, 3).map(el => {
            const r = el.getBoundingClientRect(), s = getComputedStyle(el);
            return { selector, left: r.left, right: r.right, width: r.width, height: r.height,
              font: s.fontFamily, fontSize: s.fontSize, lineHeight: s.lineHeight, color: s.color, background: s.backgroundColor };
          })).filter(box => box.width > 0);
          return { viewport: innerWidth, document: document.documentElement.scrollWidth, boxes };
        })()`);
        result.page = name; result.width = width; result.errors = [...browser.errors];
        result.failures = [];
        if (result.viewport !== width) result.failures.push('Viewport emulation mismatch');
        if (result.document > width + 1) result.failures.push('Document horizontal overflow');
        result.readingContract = await browser.evaluate(`(() => {
          const read = selector => { const el = document.querySelector(selector); if (!el) return null;
            const style = getComputedStyle(el), rect = el.getBoundingClientRect();
            return { size: parseFloat(style.fontSize), height: rect.height, width: rect.width }; };
          return { brand: read('.site-title'), prose: read('.reading-surface .post-body p'),
            header: read('.header'), menu: read('.site-nav-toggle button'), search: read('.site-nav-right .toggle') };
        })()`);
        const contract = result.readingContract, mobile = width < 769;
        if (contract.brand && contract.brand.size !== (mobile ? 18 : 20)) result.failures.push('Inconsistent brand type scale');
        if (contract.prose && contract.prose.size !== (mobile ? 17 : 18)) result.failures.push('Inconsistent prose type scale');
        if (mobile && contract.header.height > 74) result.failures.push('Mobile header is oversized');
        if (mobile) for (const key of ['menu', 'search']) {
          if (contract[key] && (contract[key].width < 44 || contract[key].height < 44)) result.failures.push('Small navigation touch target: ' + key);
        }
        for (const box of result.boxes) if (box.left < -1 || box.right > width + 1) result.failures.push(`Overflow: ${box.selector}`);
        await browser.screenshot(path.join(OUT, `${width}-${name}.png`));
        if (name === 'home') {
          const checkAxis = async () => browser.evaluate(`(() => {
            const title = document.querySelector('.site-title-main').getBoundingClientRect();
            const arrow = document.querySelector('.scroll-down-icon').getBoundingClientRect();
            return Math.abs((title.left + title.width / 2) - (arrow.left + arrow.width / 2));
          })()`);
          result.heroAxisOffset = await checkAxis();
          if (result.heroAxisOffset > 1) result.failures.push('Hero arrow/title center mismatch');
          const cardRhythm = await browser.evaluate(`(() => [...document.querySelectorAll('.post-card-excerpt')].map(el => {
            const style = getComputedStyle(el);
            return { lines: style.webkitLineClamp, height: el.getBoundingClientRect().height, lineHeight: parseFloat(style.lineHeight) };
          }))()`);
          if (cardRhythm.some(item => item.lines !== '4' || item.height > item.lineHeight * 4 + 2)) result.failures.push('Article summary exceeds four lines');
          await browser.call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
          for (const time of [0, 900, 1800]) {
            await browser.evaluate(`document.getAnimations().filter(animation => animation.effect?.target === document.querySelector('.scroll-down')).forEach(animation => { animation.pause(); animation.currentTime = ${time}; })`);
            if (await checkAxis() > 1) result.failures.push(`Hero center drifts during animation at ${time}ms`);
          }
          await browser.call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
          await browser.evaluate('document.querySelector(".posts-section")?.scrollIntoView()');
          await delay(250);
          await browser.screenshot(path.join(OUT, `${width}-home-posts.png`));
          if (width < 769) {
            await browser.evaluate('window.scrollTo(0,0); document.querySelector(".site-nav-toggle .toggle")?.click()');
            await delay(300);
            const nav = await browser.evaluate('(() => { const el = document.querySelector(".site-nav"); return el && getComputedStyle(el).display !== "none" && el.getBoundingClientRect().height > 0; })()');
            if (!nav) result.failures.push('Mobile menu did not open');
          }
        }
        if (name === 'media') {
          const searchResults = await browser.evaluate(`(async () => {
            const input = document.querySelector('[data-media-search]');
            const counter = document.querySelector('.media-result-counter');
            if (!input || !counter || !counter.hidden) return false;
            input.value = 'no-match-archive-test-9381'; input.dispatchEvent(new Event('input', { bubbles: true }));
            await new Promise(resolve => setTimeout(resolve, 220));
            const empty = !counter.hidden && document.querySelector('[data-media-result-count]').textContent === '0' && !document.querySelector('[data-media-no-results]').hidden;
            input.value = ''; input.dispatchEvent(new Event('input', { bubbles: true }));
            await new Promise(resolve => setTimeout(resolve, 220));
            return empty && counter.hidden && [...document.querySelectorAll('[data-media-card]')].every(card => !card.hidden);
          })()`);
          if (!searchResults) result.failures.push('Filtered count/reset mismatch');
          const coverFits = await browser.evaluate(`(() => [...document.querySelectorAll('.media-player-launch > img')].every(image => {
            const cover = image.parentElement.getBoundingClientRect(), rect = image.getBoundingClientRect();
            return rect.top >= cover.top - 1 && rect.bottom <= cover.bottom + 1;
          }))()`);
          if (!coverFits) result.failures.push('Media thumbnail exceeds its frame');
          const toggleTest = await browser.evaluate(`(() => {
            const button = document.querySelector('.media-description-toggle:not([hidden])');
            if (!button) return true;
            button.click();
            const opened = button.getAttribute('aria-expanded') === 'true';
            button.click();
            return opened && button.getAttribute('aria-expanded') === 'false';
          })()`);
          if (!toggleTest) result.failures.push('Description toggle failed');
        }
        if (result.errors.length) result.failures.push('Browser JavaScript error');
        results.push(result);
        console.log(`${width} ${name}: ${result.failures.join('; ') || 'PASS'}`);
      }
    }
  } finally {
    fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(results, null, 2));
    await browser.close(); server.close();
  }
  if (results.some(result => result.failures.length)) process.exitCode = 1;
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
