'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');
const yaml = require('js-yaml');
const store = require('../tools/lib/content-store');

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
  if (!input || !input.articles || !Array.isArray(input.media?.items)) throw new Error('内容配置不完整，未保存');
  if (Object.keys(current.articles || {}).some(key => !input.articles[key])) throw new Error('不支持在此删除文章，请保留现有文章记录');
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
    for (const field of ['id', 'post_file']) {
      if (current.articles?.[key]?.[field]) result.articles[key][field] = current.articles[key][field];
    }
    for (const optional of ['date', 'header_image', 'frontmatter']) {
      if (Object.prototype.hasOwnProperty.call(article, optional)) result.articles[key][optional] = article[optional];
    }
  }

  const ids = new Set();
  for (const item of Array.isArray(input?.media?.items) ? input.media.items : []) {
    if (!item || typeof item !== 'object') continue;
    const id = cleanText(item.id, 200).trim();
    if (!id || ids.has(id)) throw new Error('节目 ID 为空或重复');
    if (!item.title?.trim()) throw new Error('节目标题不能为空');
    for (const field of ['url', 'embed', 'cover']) {
      const value = String(item[field] || '').trim();
      if (value && !/^https?:\/\//i.test(value) && !(field === 'cover' && /^\/(?!\/)/.test(value))) throw new Error(`节目 ${id} 的 ${field} 地址无效`);
    }
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
  if (!file.startsWith(publicRoot + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
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
    try { sendJson(response, 200, { registry: readRegistry(), revision: store.revision(archivePath, postsRoot) }); }
    catch (error) { sendJson(response, 500, { error: error.message }); }
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
        let registry, synced;
        const backup = store.commitWrites(() => {
          if (payload.revision !== store.revision(archivePath, postsRoot)) {
            const error = new Error('文件已被其他窗口或程序修改。当前修改仍保留在表单中，请复制需要保留的内容后重新载入。');
            error.status = 409;
            throw error;
          }
          registry = sanitizeRegistry(payload.registry);
          const writes = store.planSync(registry, postsRoot);
          synced = writes.map(item => ({ file: path.relative(projectRoot, item.file), status: 'updated' }));
          writes.push({ file: archivePath, content: archiveHeader + yaml.dump(registry, yamlOptions) });
          return writes;
        }, path.join(path.dirname(archivePath), '..', '..', '.content-backups'));
        sendJson(response, 200, { ok: true, registry, revision: store.revision(archivePath, postsRoot), synced, backup, savedAt: new Date().toISOString() });
      } catch (error) {
        sendJson(response, error.status || 400, { error: error.message });
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
