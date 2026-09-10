'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const yaml = require('js-yaml');
const yamlOptions = { schema: yaml.JSON_SCHEMA, noRefs: true, lineWidth: 140, noCompatMode: true };

function parsePost(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) throw new Error('文章缺少有效的 frontmatter');
  return { front: yaml.load(match[1], { schema: yaml.JSON_SCHEMA }) || {}, body: raw.slice(match[0].length) };
}

function stableId(key) {
  return `article-${crypto.createHash('sha256').update(key).digest('hex').slice(0, 16)}`;
}

function expectedFilename(key) {
  const match = key.match(/^(\d{4})(\d{2})(\d{2})_(.+)$/);
  return match && `${match[1]}-${match[2]}-${match[3]}-${match[4].trim().replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '-')}.md`;
}

function listPosts(postsRoot) {
  return fs.readdirSync(postsRoot).filter(name => name.endsWith('.md')).sort().map(name => {
    const file = path.join(postsRoot, name);
    const raw = fs.readFileSync(file, 'utf8');
    return { name, file, raw, ...parsePost(raw) };
  });
}

function resolvePost(key, entry, posts) {
  let candidates = posts.filter(post =>
    (entry.id && post.front.article_id === entry.id) || post.front.source_key === key);
  if (!candidates.length && entry.post_file) candidates = posts.filter(post => post.name === entry.post_file);
  if (!candidates.length) candidates = posts.filter(post => post.name === expectedFilename(key));
  if (!candidates.length) {
    // Legacy migration only: a date is never sufficient to identify an article.
    const prefix = expectedFilename(key)?.slice(0, 11);
    candidates = posts.filter(post => prefix && post.name.startsWith(prefix) &&
      String(post.front.title).trim() === String(entry.title || key.slice(9)).trim());
  }
  if (candidates.length !== 1) throw new Error(`无法唯一关联文章「${key}」，请核对 archive.yml 中的 post_file（匹配 ${candidates.length} 篇）`);
  return candidates[0];
}

function planSync(registry, postsRoot) {
  const posts = listPosts(postsRoot);
  const writes = [];
  const usedFiles = new Set();
  const usedIds = new Set();
  for (const [key, entry] of Object.entries(registry.articles || {})) {
    if (!entry.title?.trim()) throw new Error(`文章标题不能为空：${key}`);
    const post = resolvePost(key, entry, posts);
    entry.id = entry.id || post.front.article_id || stableId(key);
    if (usedFiles.has(post.file) || usedIds.has(entry.id)) throw new Error(`文章关联重复：${key}`);
    usedFiles.add(post.file);
    usedIds.add(entry.id);
    entry.post_file = post.name;
    const front = { ...post.front, article_id: entry.id, source_key: key,
      title: entry.title, author: entry.author || registry.defaults?.author || 'AikeKo',
      categories: entry.categories || [], tags: entry.tags || [] };
    if (entry.description) front.description = entry.description;
    else delete front.description;
    // Date, filename and permalink deliberately stay unchanged: comments use pathname.
    const content = `---\n${yaml.dump(front, yamlOptions)}---\n${post.body}`;
    if (content !== post.raw) writes.push({ file: post.file, content });
  }
  return writes;
}

function revision(archivePath, postsRoot) {
  const hash = crypto.createHash('sha256').update(fs.readFileSync(archivePath));
  for (const post of listPosts(postsRoot)) hash.update(post.name).update(post.raw);
  return hash.digest('hex');
}

function readSnapshot(file) {
  try { return fs.readFileSync(file); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

function assertUnchanged(file, expected) {
  const current = readSnapshot(file);
  if (current === null ? expected !== null : expected === null || !current.equals(Buffer.from(expected))) {
    throw new Error(`文件已修改，未覆盖，请重新处理：${path.basename(file)}`);
  }
}

// A planner runs synchronously under the same lock as the commit, so reads,
// revision checks and writes cannot race another cooperating writer.
function commitWrites(plan, backupRoot) {
  fs.mkdirSync(backupRoot, { recursive: true });
  const lock = path.join(backupRoot, '.lock');
  let fd;
  try { fd = fs.openSync(lock, 'wx'); } catch { throw new Error('另一项保存或构建正在同步内容，请稍后重试'); }
  const backup = path.join(backupRoot, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`);
  const staged = [];
  const committed = [];
  try {
    const writes = typeof plan === 'function' ? plan() : plan;
    if (!writes.length) return null;
    fs.mkdirSync(backup);
    const manifest = [];
    writes.forEach(({ file, content }, index) => {
      const before = readSnapshot(file);
      if (before) fs.writeFileSync(path.join(backup, `${index}.bak`), before);
      manifest.push({ file, backup: before ? `${index}.bak` : null });
      const temp = `${file}.${process.pid}.tmp`;
      staged.push({ file, temp, before, remove: content === null });
      if (content !== null) fs.writeFileSync(temp, content, 'utf8');
    });
    fs.writeFileSync(path.join(backup, 'manifest.json'), JSON.stringify(manifest, null, 2));
    for (const item of staged) {
      if (item.remove) { if (item.before !== null) fs.unlinkSync(item.file); }
      else fs.renameSync(item.temp, item.file);
      committed.push(item);
    }
    return backup;
  } catch (error) {
    for (const item of committed.reverse()) {
      if (item.before) fs.writeFileSync(item.file, item.before);
      else fs.unlinkSync(item.file);
    }
    throw error;
  } finally {
    staged.forEach(item => { if (fs.existsSync(item.temp)) fs.unlinkSync(item.temp); });
    fs.closeSync(fd);
    fs.unlinkSync(lock);
  }
}

module.exports = { parsePost, stableId, expectedFilename, listPosts, resolvePost, planSync, revision, commitWrites, readSnapshot, assertUnchanged, yamlOptions };
