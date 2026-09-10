'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const yaml = require('js-yaml');
const cheerio = require('cheerio');
const MarkdownProcessor = require('../../content-pipeline/lib/markdown-processor');
const WordConverter = require('../../content-pipeline/lib/word-converter');
const Pipeline = require('../../content-pipeline');
const store = require('../lib/content-store');
const { commitCoverUpdates } = require('../../content-pipeline/sync-media-covers');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aike-pipeline-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const source = path.join(root, 'input'), posts = path.join(root, 'posts');
  fs.mkdirSync(source); fs.mkdirSync(posts);
  const metadataPath = path.join(root, 'archive.yml'), backupPath = path.join(root, 'backups');
  fs.writeFileSync(metadataPath, 'defaults: {}\narticles: {}\n');
  const pipeline = new Pipeline({ watchPath: source, outputPath: posts, metadataPath, backupPath });
  pipeline.markdownProcessor = new MarkdownProcessor();
  const input = path.join(source, '20260910_测试.md'), output = path.join(posts, '2026-09-10-测试.md');
  fs.writeFileSync(input, '正文');
  return { root, source, posts, metadataPath, backupPath, pipeline, input, output };
}

test('plain Markdown derives stable metadata; YAML and body survive a round trip', async () => {
  const processor = new MarkdownProcessor();
  const plain = await processor.process('正文\r\n第二段', '20260910_文章.md');
  assert.equal(plain.metadata.title, '文章');
  assert.equal(plain.metadata.date, '2026-09-10 00:00:00');
  const metadata = { title: '章节: 第一章 # 正文', tags: ['文学', '生活'], comments: false,
    description: '第一行\n第二行\n', custom: { enabled: true, count: 2 } };
  const input = '\uFEFF' + processor.rebuildDocument(metadata, '\n保留正文\n').replace(/\n/g, '\r\n');
  const parsed = processor.extractFrontmatter(input, '20260910_文章.md');
  assert.deepEqual(parsed.metadata, metadata);
  const output = store.parsePost(processor.rebuildDocument(parsed.metadata, parsed.body));
  assert.deepEqual(output.front, metadata);
  assert.equal(output.body, '\r\n保留正文\r\n');
  assert.throws(() => processor.extractFrontmatter('---\ntitle: [broken\n---\n正文'), /flow|collection|unexpected/i);
});

test('failed local image reads and uploads reject Markdown conversion', async () => {
  const processor = new MarkdownProcessor({ imageTransformer: async () => [{ error: 'offline', url: null }] });
  await assert.rejects(processor.process('---\ntitle: test\n---\n![](missing.png)', 'test.md', os.tmpdir()), /无法读取图片/);
  processor.extractImages = async () => [{ name: 'a.png', buffer: Buffer.from('image') }];
  await assert.rejects(processor.process('正文', '20260910_测试.md'), /上传未全部成功/);
});

test('imports back up changes, preserve URL/date/ID, and back up deletion', async t => {
  const f = fixture(t);
  await f.pipeline.processDocument(f.input);
  const front = store.parsePost(fs.readFileSync(f.output, 'utf8')).front;
  front.permalink = 'stable.html'; front.date = '2020-01-01';
  const old = `---\n${yaml.dump(front)}---\n旧正文`;
  fs.writeFileSync(f.output, old);
  fs.writeFileSync(f.input, '新正文');
  await f.pipeline.processDocument(f.input);
  const post = store.parsePost(fs.readFileSync(f.output, 'utf8'));
  assert.equal(post.body, '新正文'); assert.equal(post.front.permalink, 'stable.html');
  assert.equal(post.front.date, front.date); assert.equal(post.front.article_id, front.article_id);
  const backups = fs.readdirSync(f.backupPath).map(name => path.join(f.backupPath, name, '0.bak')).filter(fs.existsSync);
  assert.ok(backups.some(file => fs.readFileSync(file, 'utf8') === old));
  const latest = fs.readFileSync(f.output, 'utf8');
  fs.unlinkSync(f.input); await f.pipeline.removeDocument(f.input);
  assert.equal(fs.existsSync(f.output), false);
  assert.ok(fs.readdirSync(f.backupPath).some(name => {
    const file = path.join(f.backupPath, name, '0.bak');
    return fs.existsSync(file) && fs.readFileSync(file, 'utf8') === latest;
  }));
});

test('imports refuse edits made during conversion and leave lock protected files untouched', async t => {
  const f = fixture(t); await f.pipeline.processDocument(f.input);
  const original = fs.readFileSync(f.output, 'utf8');
  const convert = f.pipeline.processMarkdownDocument.bind(f.pipeline);
  f.pipeline.processMarkdownDocument = async file => {
    const result = await convert(file); fs.appendFileSync(f.output, '\n外部编辑'); return result;
  };
  await assert.rejects(f.pipeline.processDocument(f.input), /文件已修改/);
  assert.equal(fs.readFileSync(f.output, 'utf8'), original + '\n外部编辑');
  f.pipeline.processMarkdownDocument = async file => {
    const result = await convert(file); fs.appendFileSync(f.metadataPath, '# 管理器修改\n'); return result;
  };
  await assert.rejects(f.pipeline.processDocument(f.input), /文件已修改/);
  f.pipeline.processMarkdownDocument = convert;
  fs.writeFileSync(path.join(f.backupPath, '.lock'), '');
  await assert.rejects(f.pipeline.processDocument(f.input), /正在同步/);
  assert.equal(fs.readFileSync(f.output, 'utf8'), original + '\n外部编辑');
});

test('overlapping imports are serialized and batch failures reach the caller', async t => {
  const f = fixture(t); let active = 0, peak = 0;
  const convert = f.pipeline.processMarkdownDocument.bind(f.pipeline);
  f.pipeline.processMarkdownDocument = async file => {
    peak = Math.max(peak, ++active);
    await new Promise(resolve => setTimeout(resolve, 15));
    try { return await convert(file); } finally { active--; }
  };
  await Promise.all([f.pipeline.processDocument(f.input), f.pipeline.processDocument(f.input)]);
  assert.equal(peak, 1);
  fs.writeFileSync(path.join(f.source, '20260910_另一篇.md'), '正文');
  const attempted = [];
  f.pipeline.processDocument = async file => { attempted.push(file); if (file === f.input) throw new Error('转换失败'); };
  await assert.rejects(f.pipeline.processAllDocuments(), /导入失败 1\/2/);
  assert.equal(attempted.length, 2);
});

test('cover updates merge current metadata by ID and reject conflicts without partial saves', t => {
  const f = fixture(t);
  const registry = { articles: { key: { title: '运行期间保存的新标题' } }, media: { items: [
    { id: 'one', cover: 'https://old/image.jpg' }, { id: 'two', cover: 'https://old/image.jpg' }
  ] } };
  fs.writeFileSync(f.metadataPath, '# Header\n' + yaml.dump(registry));
  const backup = commitCoverUpdates(f.metadataPath, [{ id: 'two', oldUrl: 'https://old/image.jpg', newUrl: 'https://new/image.jpg' }], f.backupPath);
  const saved = yaml.load(fs.readFileSync(f.metadataPath, 'utf8'));
  assert.equal(saved.articles.key.title, registry.articles.key.title);
  assert.equal(saved.media.items[0].cover, registry.media.items[0].cover);
  assert.equal(saved.media.items[1].cover, 'https://new/image.jpg');
  assert.ok(fs.existsSync(path.join(backup, '0.bak')));
  const before = fs.readFileSync(f.metadataPath, 'utf8');
  assert.throws(() => commitCoverUpdates(f.metadataPath, [
    { id: 'one', oldUrl: 'https://old/image.jpg', newUrl: 'https://new/one.jpg' },
    { id: 'two', oldUrl: 'https://old/image.jpg', newUrl: 'https://conflict/image.jpg' }
  ], f.backupPath), /已修改/);
  assert.equal(fs.readFileSync(f.metadataPath, 'utf8'), before);
});

test('Word table conversion preserves cells, merged cells, links and image attributes', () => {
  const converter = new WordConverter();
  const markdown = converter.htmlToMarkdown('<p>前文</p><table><tr><td colspan="2">甲 &amp; 乙</td></tr><tr><td><a href="https://example.com">丙</a></td><td><img src="https://example.com/a.png" alt="丁"></td></tr></table><p>后文</p>');
  const $ = cheerio.load(markdown);
  assert.equal($('tr').length, 2); assert.equal($('td').length, 3);
  assert.equal($('td').first().attr('colspan'), '2'); assert.equal($('td').first().text(), '甲 & 乙');
  assert.equal($('a').attr('href'), 'https://example.com'); assert.equal($('img').attr('alt'), '丁');
  assert.ok(markdown.startsWith('前文')); assert.ok(markdown.endsWith('后文'));
});
