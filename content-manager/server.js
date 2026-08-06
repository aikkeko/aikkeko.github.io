'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');
const yaml = require('js-yaml');

const projectRoot = path.resolve(__dirname, '..');
const publicRoot = path.join(__dirname, 'public');
const archivePath = process.env.CONTENT_MANAGER_ARCHIVE
  ? path.resolve(process.env.CONTENT_MANAGER_ARCHIVE)
  : path.join(projectRoot, 'source', '_data', 'archive.yml');
const postsRoot = process.env.CONTENT_MANAGER_POSTS
  ? path.resolve(process.env.CONTENT_MANAGER_POSTS)
  : path.join(projectRoot, 'source', '_posts');
const host = '127.0.0.1';
const port = Number(process.env.CONTENT_MANAGER_PORT || 4173);
const yamlOptions = {
  schema: yaml.JSON_SCHEMA,
  noRefs: true,
  noCompatMode: true,
  lineWidth: 140,
  quotingType: '"'
};

const archiveHeader = `# Archive content configuration
#
# This is the only file you normally need to edit.
# It controls articles, the homepage feature, and the signal archive.
#
# The article key must equal the DOCX/MD filename without its extension.
# Existing values are never overwritten by \`npm run pipeline:metadata\`.
# Saving this file while \`npm run pipeline\` is active regenerates all posts.
#
# Set homepage.featured_article to an article key, or leave it empty to use the newest post.
# Leave description empty to show the beginning of the article automatically.
# Add a description only when you want to override that automatic excerpt.
# Add radio/video records under media.items; media.featured accepts an item id.
# R2 credentials remain in the private root .env file and are never written here.
# Optional article fields: date, header_image, frontmatter

`;

function readRegistry() {
  return yaml.load(fs.readFileSync(archivePath, 'utf8'), { schema: yaml.JSON_SCHEMA }) || {};
}

function cleanText(value, max = 20000) {
  return String(value == null ? '' : value).replace(/\r\n/g, '\n').slice(0, max);
}

function cleanTags(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(item => cleanText(item, 80).trim()).filter(Boolean))].slice(0, 24);
}

function sanitizeRegistry(input) {
  const current = readRegistry();
  const result = {
    defaults: { author: cleanText(input?.defaults?.author || current.defaults?.author || 'AikeKo', 100).trim() },
    homepage: { featured_article: cleanText(input?.homepage?.featured_article, 300).trim() },
    articles: {},
    media: {
      page: {
        title: cleanText(input?.media?.page?.title || current.media?.page?.title || '声像档案', 120).trim(),
        kicker: cleanText(input?.media?.page?.kicker || current.media?.page?.kicker || 'SIGNAL ARCHIVE', 120).trim(),
        description: cleanText(input?.media?.page?.description || current.media?.page?.description, 500).trim()
      },
      featured: cleanText(input?.media?.featured, 200).trim(),
      items: []
    }
  };

  const incomingArticles = input?.articles && typeof input.articles === 'object' ? input.articles : {};
  for (const [key, article] of Object.entries(incomingArticles)) {
    if (!/^\d{8}_.+/.test(key) || !article || typeof article !== 'object') continue;
    const categories = cleanTags(article.categories);
    result.articles[key] = {
      title: cleanText(article.title, 400).trim(),
      author: cleanText(article.author || result.defaults.author, 100).trim(),
      description: cleanText(article.description, 4000).trim(),
      categories,
      tags: cleanTags(article.tags)
    };
    for (const optional of ['date', 'header_image', 'frontmatter']) {
      if (Object.prototype.hasOwnProperty.call(article, optional)) result.articles[key][optional] = article[optional];
    }
  }

  const ids = new Set();
  for (const item of Array.isArray(input?.media?.items) ? input.media.items : []) {
    if (!item || typeof item !== 'object') continue;
    const id = cleanText(item.id, 200).trim();
    if (!id || ids.has(id)) continue;
    ids.add(id);
    result.media.items.push({
      id,
      type: 'video',
      title: cleanText(item.title, 500).trim(),
      episode: cleanText(item.episode, 100).trim(),
      platform: cleanText(item.platform || 'Bilibili', 100).trim(),
      date: cleanText(item.date, 100).trim(),
      duration: cleanText(item.duration, 100).trim(),
      url: cleanText(item.url, 1000).trim(),
      embed: cleanText(item.embed, 1000).trim(),
      cover: cleanText(item.cover, 1000).trim(),
      description: cleanText(item.description, 4000).trim(),
      tags: cleanTags(item.tags)
    });
  }

  if (!result.articles[result.homepage.featured_article]) result.homepage.featured_article = '';
  if (!ids.has(result.media.featured)) result.media.featured = '';
  return result;
}

function atomicWrite(file, content) {
  const temp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temp, content, 'utf8');
  fs.renameSync(temp, file);
}

function findPostFile(articleKey, title) {
  const match = articleKey.match(/^(\d{4})(\d{2})(\d{2})_/);
  if (!match) return null;
  const prefix = `${match[1]}-${match[2]}-${match[3]}-`;
  const candidates = fs.readdirSync(postsRoot)
    .filter(name => name.startsWith(prefix) && name.endsWith('.md'));
  if (candidates.length === 1) return path.join(postsRoot, candidates[0]);
  for (const name of candidates) {
    const raw = fs.readFileSync(path.join(postsRoot, name), 'utf8');
    const front = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    const parsed = front ? yaml.load(front[1], { schema: yaml.JSON_SCHEMA }) || {} : {};
    if (String(parsed.title || '').trim() === String(title || '').trim()) return path.join(postsRoot, name);
  }
  return null;
}

function syncPostFrontmatter(articleKey, article, defaultAuthor) {
  const postFile = findPostFile(articleKey, article.title);
  if (!postFile) return { key: articleKey, status: 'not-found' };
  const raw = fs.readFileSync(postFile, 'utf8');
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!match) return { key: articleKey, status: 'invalid-frontmatter' };
  const front = yaml.load(match[1], { schema: yaml.JSON_SCHEMA }) || {};
  front.title = article.title;
  front.author = article.author || defaultAuthor;
  front.categories = article.categories || [];
  front.tags = article.tags || [];
  if (article.description) front.description = article.description;
  else delete front.description;
  const body = raw.slice(match[0].length);
  const next = `---\n${yaml.dump(front, yamlOptions)}---\n\n${body.replace(/^\r?\n/, '')}`;
  if (next !== raw) atomicWrite(postFile, next);
  return { key: articleKey, status: 'updated', file: path.relative(projectRoot, postFile) };
}

function sendJson(response, status, data) {
  const body = JSON.stringify(data);
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store'
  });
  response.end(body);
}

function serveFile(response, pathname) {
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '');
  const file = path.resolve(publicRoot, relative);
  if (!file.startsWith(publicRoot) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    response.writeHead(404);
    response.end('Not found');
    return;
  }
  const type = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml' }[path.extname(file)] || 'application/octet-stream';
  const content = fs.readFileSync(file);
  response.writeHead(200, {
    'Content-Type': `${type}; charset=utf-8`,
    'Content-Length': content.length,
    'Cache-Control': 'no-store'
  });
  response.end(content);
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url, `http://${host}:${port}`);
  if (request.method === 'GET' && url.pathname === '/api/data') {
    sendJson(response, 200, readRegistry());
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/save') {
    const origin = request.headers.origin;
    if (origin && origin !== `http://${host}:${port}` && origin !== `http://localhost:${port}`) {
      sendJson(response, 403, { error: 'Invalid origin' });
      return;
    }
    let body = '';
    request.on('data', chunk => {
      body += chunk;
      if (body.length > 2 * 1024 * 1024) request.destroy();
    });
    request.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const registry = sanitizeRegistry(payload.registry);
        const changedKeys = Array.isArray(payload.changedArticleKeys) ? payload.changedArticleKeys : [];
        atomicWrite(archivePath, archiveHeader + yaml.dump(registry, yamlOptions));
        const synced = changedKeys
          .filter(key => registry.articles[key])
          .map(key => syncPostFrontmatter(key, registry.articles[key], registry.defaults.author));
        sendJson(response, 200, { ok: true, synced, savedAt: new Date().toISOString() });
      } catch (error) {
        sendJson(response, 400, { error: error.message });
      }
    });
    return;
  }

  if (request.method === 'GET') {
    serveFile(response, url.pathname);
    return;
  }
  response.writeHead(405);
  response.end('Method not allowed');
});

server.listen(port, host, () => {
  const address = `http://${host}:${port}/`;
  console.log(`Aike · Echo content manager: ${address}`);
  console.log('Press Ctrl+C to stop. This server only accepts local connections.');
  if (!process.argv.includes('--no-open')) {
    const command = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', address]]
      : process.platform === 'darwin' ? ['open', [address]] : ['xdg-open', [address]];
    const child = spawn(command[0], command[1], { detached: true, stdio: 'ignore' });
    child.unref();
  }
});
