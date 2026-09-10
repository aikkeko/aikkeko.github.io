/**
 * Content Pipeline 主控制器
 * 自动化内容处理流程
 */

const fs = require('fs').promises;
const path = require('path');
const DocumentWatcher = require('./lib/document-watcher');
const WordToMarkdownConverter = require('./lib/word-converter');
const MarkdownProcessor = require('./lib/markdown-processor');
const R2Uploader = require('./lib/r2-uploader');
const ImageCacheManager = require('./lib/image-cache');
const yaml = require('js-yaml');
const chokidar = require('chokidar');
const store = require('../tools/lib/content-store');
const { stableId } = store;

class ContentPipeline {
  constructor(options = {}) {
    this.options = {
      watchPath: options.watchPath || './example',
      outputPath: options.outputPath || './content',
      author: options.author || 'AikeKo'
    };
    
    this.watcher = null;
    this.r2Uploader = null;
    this.wordConverter = null;
    this.markdownProcessor = null;
    this.imageCache = null;
    this.articleMetadata = { defaults: {}, articles: {} };
    this.metadataWatcher = null;
    this.metadataPath = options.metadataPath || path.join(__dirname, '..', 'source', '_data', 'archive.yml');
    this.backupPath = options.backupPath || path.join(__dirname, '..', '.content-backups');
    this.queue = Promise.resolve();
  }

  /**
   * 初始化管道
   */
  async initialize() {
    console.log('🚀 初始化 Content Pipeline...\n');
    
    // 确保输出目录存在
    await this.ensureDirectory(this.options.outputPath);
    await this.loadArticleMetadata();
    
    // 初始化图片缓存管理器
    this.imageCache = new ImageCacheManager();
    await this.imageCache.initialize();
    
    // 初始化 R2 上传器
    try {
      this.r2Uploader = new R2Uploader();
      console.log('✅ R2 上传器已初始化\n');
    } catch (error) {
      console.warn('⚠️  R2 上传器初始化失败，图片上传功能将不可用');
      console.warn('   请检查环境变量配置\n');
    }
    
    // 初始化文档处理器
    const imageTransformer = this.r2Uploader 
      ? (images, options) => this.r2Uploader.uploadBatch(images, options)
      : null;
    
    this.wordConverter = new WordToMarkdownConverter({
      defaultAuthor: this.options.author,
      imageTransformer
    });
    
    this.markdownProcessor = new MarkdownProcessor({
      defaultAuthor: this.options.author,
      imageTransformer
    });
    
    // 初始化监听器
    this.watcher = new DocumentWatcher({
      watchPath: this.options.watchPath,
      onNewDocument: (filePath) => this.processDocument(filePath),
      onDocumentChange: (filePath) => this.processDocument(filePath),
      onDocumentRemove: (filePath) => this.removeDocument(filePath)
    });
    
    console.log('✅ Content Pipeline 初始化完成\n');
  }

  /**
   * 启动监听
   */
  async start() {
    await this.initialize();
    this.watcher.start();
    this.startMetadataWatcher();
    
    console.log('🎯 Pipeline 正在运行，等待新文档...');
    console.log(`   监视目录: ${path.resolve(this.options.watchPath)}`);
    console.log(`   输出目录: ${path.resolve(this.options.outputPath)}`);
    console.log('\n按 Ctrl+C 停止\n');
  }

  /**
   * 停止监听
   */
  async stop() {
    if (this.watcher) {
      await this.watcher.stop();
    }
    if (this.metadataWatcher) {
      await this.metadataWatcher.close();
      this.metadataWatcher = null;
    }
    await this.queue;
  }

  /**
   * 处理单个文档
   * @param {string} filePath - 文件路径
   */
  enqueue(operation) {
    const pending = this.queue.then(operation);
    this.queue = pending.catch(() => {});
    return pending;
  }

  processDocument(filePath) {
    return this.enqueue(() => this.processDocumentNow(filePath));
  }

  async processDocumentNow(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const filename = path.basename(filePath);

    if (!this.isPublishableFilename(filename)) {
      console.log(`\n⏭️  跳过非发布文档: ${filename}`);
      return;
    }
    
    console.log(`\n📄 开始处理: ${filename}`);
    console.log('─'.repeat(50));
    
    try {
      await this.loadArticleMetadata();
      const metadataSnapshot = this.metadataSnapshot;
      const sourceSnapshot = store.readSnapshot(filePath);
      const outputFilename = this.generateOutputFilename(filename);
      const outputPath = path.resolve(this.options.outputPath, outputFilename);
      const before = store.readSnapshot(outputPath);
      let result;
      
      if (ext === '.docx') {
        result = await this.processWordDocument(filePath);
      } else if (ext === '.md') {
        result = await this.processMarkdownDocument(filePath);
      } else {
        console.log(`⚠️  不支持的文件类型: ${ext}`);
        return;
      }
      
      // 保存到输出目录
      // Word 文档返回 markdown 字段，Markdown 文档返回 content 字段
      let content = result.markdown || result.content;
      const parsed = store.parsePost(content);
      if (!parsed.front.title || typeof parsed.front.title !== 'string') throw new Error('文章标题无效');
      // Re-importing must not change an existing URL, publication date or ID.
      if (before) {
        const previous = store.parsePost(before.toString('utf8')).front;
        if (previous.source_key && previous.source_key !== parsed.front.source_key) {
          throw new Error('输出文件已关联其他源文档，请检查 post_file');
        }
        for (const field of ['date', 'permalink', 'slug', 'article_id', 'source_key']) {
          if (Object.prototype.hasOwnProperty.call(previous, field)) parsed.front[field] = previous[field];
        }
        content = `---\n${yaml.dump(parsed.front, store.yamlOptions)}---\n${parsed.body}`;
      }
      store.commitWrites(() => {
        store.assertUnchanged(this.metadataPath, metadataSnapshot);
        store.assertUnchanged(filePath, sourceSnapshot);
        store.assertUnchanged(outputPath, before);
        return before?.equals(Buffer.from(content)) ? [] : [{ file: outputPath, content }];
      }, this.backupPath);
      
      // 确保 categories 和 tags 是数组
      const categories = Array.isArray(result.metadata.categories) 
        ? result.metadata.categories 
        : [result.metadata.categories || '未分类'];
      const tags = Array.isArray(result.metadata.tags) 
        ? result.metadata.tags 
        : [];
      
      console.log('✅ 处理完成!');
      console.log(`   输出文件: ${outputPath}`);
      console.log(`   标题: ${result.metadata.title}`);
      console.log(`   分类: ${categories.join(', ')}`);
      console.log(`   标签: ${tags.join(', ') || '无'}`);
      if (result.images && result.images.length > 0) {
        console.log(`   图片: ${result.images.length} 张`);
      }
      console.log('─'.repeat(50));
      
    } catch (error) {
      console.error(`❌ 处理失败: ${filename}`, error);
      throw error;
    }
  }

  /**
   * 处理 Word 文档
   * @param {string} filePath - 文件路径
   * @returns {Promise<Object>}
   */
  async processWordDocument(filePath) {
    const buffer = await fs.readFile(filePath);
    const filename = path.basename(filePath);
    const filenameMeta = this.extractFilenameMetadata(filename);
    
    // 生成文章标识（基于文件名）
    const articleId = this.generateArticleId(filename);
    const persistentMetadata = this.getArticleMetadata(filename);
    
    return await this.wordConverter.convert(buffer, filename, {
      articleId,
      cacheManager: this.imageCache,
      sourceDate: filenameMeta?.date,
      persistentMetadata
    });
  }

  /**
   * Load hand-maintained article metadata. Keys are source document names
   * without their extension, so editing a DOCX never loses manual settings.
   */
  async loadArticleMetadata() {
    const metadataPath = this.metadataPath;

    try {
      const raw = await fs.readFile(metadataPath, 'utf8');
      this.metadataSnapshot = Buffer.from(raw);
      const parsed = yaml.load(raw) || {};
      this.articleMetadata = {
        defaults: parsed.defaults && typeof parsed.defaults === 'object'
          ? parsed.defaults
          : {},
        articles: parsed.articles && typeof parsed.articles === 'object'
          ? parsed.articles
          : {}
      };
    } catch (error) {
      if (error.code === 'ENOENT') {
        this.metadataSnapshot = null;
        this.articleMetadata = { defaults: {}, articles: {} };
        return;
      }
      throw new Error(`Unable to read article metadata: ${error.message}`);
    }
  }

  /**
   * Match metadata to the source filename, not its title or body.
   */
  getArticleMetadata(filename) {
    const documentKey = path.basename(filename, path.extname(filename));
    const defaults = this.articleMetadata.defaults || {};
    const entry = this.articleMetadata.articles[documentKey];

    if (!entry || typeof entry !== 'object') {
      return { ...defaults, frontmatter: { article_id: stableId(documentKey), source_key: documentKey } };
    }

    return { ...defaults, ...entry, frontmatter: {
      ...entry.frontmatter, article_id: entry.id || stableId(documentKey), source_key: documentKey
    } };
  }

  /**
   * Rebuild articles when the metadata file changes while watch mode is active.
   */
  startMetadataWatcher() {
    const metadataPath = this.metadataPath;

    this.metadataWatcher = chokidar.watch(metadataPath, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 500,
        pollInterval: 100
      }
    });

    this.metadataWatcher.on('change', async () => {
      try {
        console.log('\n⚙️  文章元数据已修改，正在重新生成文章...');
        await this.processAllDocuments();
      } catch (error) {
        console.error('❌ 文章元数据更新失败:', error.message);
      }
    });

    this.metadataWatcher.on('error', error => {
      console.error('❌ 元数据监听错误:', error);
    });
  }

  /**
   * 处理 Markdown 文档
   * @param {string} filePath - 文件路径
   * @returns {Promise<Object>}
   */
  async processMarkdownDocument(filePath) {
    const content = await fs.readFile(filePath, 'utf8');
    const filename = path.basename(filePath);
    const basePath = path.dirname(filePath);
    
    return await this.markdownProcessor.process(
      content,
      filename,
      basePath,
      this.getArticleMetadata(filename)
    );
  }

  /**
   * 删除文档
   * @param {string} filePath - 文件路径
   */
  removeDocument(filePath) {
    return this.enqueue(async () => {
      const filename = path.basename(filePath);
      if (!this.isPublishableFilename(filename)) return;
      await this.loadArticleMetadata();
      const outputPath = path.resolve(this.options.outputPath, this.generateOutputFilename(filename));
      store.commitWrites(() => {
        store.assertUnchanged(this.metadataPath, this.metadataSnapshot);
        if (store.readSnapshot(filePath) !== null) throw new Error('源文档已恢复，取消删除');
        return store.readSnapshot(outputPath) === null ? [] : [{ file: outputPath, content: null }];
      }, this.backupPath);
      console.log(`🗑️  已备份并删除: ${outputPath}`);
    });
  }

  /**
   * 生成输出文件名
   * @param {string} originalFilename - 原始文件名
   * @returns {string} 输出文件名
   */
  generateOutputFilename(originalFilename) {
    const registered = this.getArticleMetadata(originalFilename).post_file;
    if (registered && path.basename(registered) === registered && registered.endsWith('.md')) return registered;
    const ext = path.extname(originalFilename);
    const basename = path.basename(originalFilename, ext);
    const filenameMeta = this.extractFilenameMetadata(originalFilename);

    if (filenameMeta) {
      return `${filenameMeta.date}-${filenameMeta.slug}.md`;
    }
    
    // 添加日期前缀 (YYYY-MM-DD-title.md)
    const date = new Date();
    const dateStr = date.toISOString().split('T')[0];
    
    return `${dateStr}-${basename}.md`;
  }

  /**
   * 仅发布形如 YYYYMMDD_标题.docx / .md 的文档。
   * @param {string} filename - 文件名
   * @returns {boolean}
   */
  isPublishableFilename(filename) {
    return /^\d{8}_.+\.(docx|md)$/i.test(filename);
  }

  /**
   * 从 YYYYMMDD_标题.ext 中提取发布日期和标题。
   * @param {string} filename - 文件名
   * @returns {{ date: string, title: string, slug: string } | null}
   */
  extractFilenameMetadata(filename) {
    const ext = path.extname(filename);
    const basename = path.basename(filename, ext);
    const match = basename.match(/^(\d{4})(\d{2})(\d{2})_(.+)$/);

    if (!match) {
      return null;
    }

    const [, year, month, day, rawTitle] = match;
    const title = rawTitle.trim();
    const slug = title
      .replace(/[\\/:*?"<>|]/g, '')
      .replace(/\s+/g, '-')
      .trim();

    return {
      date: `${year}-${month}-${day}`,
      title,
      slug
    };
  }

  /**
   * 确保目录存在
   * @param {string} dirPath - 目录路径
   */
  async ensureDirectory(dirPath) {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
      console.log(`📁 创建目录: ${dirPath}`);
    }
  }

  /**
   * 生成文章标识
   * @param {string} filename - 文件名
   * @returns {string} 文章标识
   */
  generateArticleId(filename) {
    // 使用文件名（不含扩展名）作为文章标识
    const basename = path.basename(filename, path.extname(filename));
    // 标准化：转为小写，替换特殊字符
    return basename.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]/g, '-');
  }

  /**
   * 批量处理现有文件
   */
  async processExisting() {
    await this.initialize();
    await this.processAllDocuments();
  }

  /**
   * Process every publishable source document without reinitializing services.
   */
  async processAllDocuments() {
    
    console.log('🔍 扫描现有文件...\n');
    
    try {
      const files = await fs.readdir(this.options.watchPath);
      const supportedFiles = files.filter(file => {
        const ext = path.extname(file).toLowerCase();
        return ['.docx', '.md'].includes(ext) && this.isPublishableFilename(file);
      });
      
      if (supportedFiles.length === 0) {
        console.log('ℹ️  未发现可处理的文件');
        return;
      }
      
      console.log(`📦 发现 ${supportedFiles.length} 个文件，开始处理...\n`);
      
      const failures = [];
      for (const file of supportedFiles) {
        const filePath = path.join(this.options.watchPath, file);
        try { await this.processDocument(filePath); }
        catch (error) { failures.push(`${file}: ${error.message}`); }
      }
      if (failures.length) throw new Error(`导入失败 ${failures.length}/${supportedFiles.length}：\n${failures.join('\n')}`);
      
      console.log('\n✅ 批量处理完成');
      
    } catch (error) {
      console.error('❌ 扫描失败:', error);
      throw error;
    }
  }
}

module.exports = ContentPipeline;
