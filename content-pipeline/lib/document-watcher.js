/**
 * 文档监听器
 * 监视 example 文件夹下的新文档
 */

const chokidar = require('chokidar');
const path = require('path');

class DocumentWatcher {
  constructor(options = {}) {
    this.options = {
      watchPath: options.watchPath || './example',
      supportedExtensions: options.supportedExtensions || ['.docx', '.md'],
      onNewDocument: options.onNewDocument || null,
      onDocumentChange: options.onDocumentChange || null,
      onDocumentRemove: options.onDocumentRemove || null
    };
    
    this.watcher = null;
    this.processedFiles = new Set();
  }

  /**
   * 启动监听
   */
  start() {
    const { watchPath, supportedExtensions } = this.options;
    
    console.log(`👁️  开始监视文件夹: ${path.resolve(watchPath)}`);
    console.log(`📄 支持的文件类型: ${supportedExtensions.join(', ')}`);
    
    // 创建监听器
    this.watcher = chokidar.watch(watchPath, {
      ignored: /(^|[\/\\])\../, // 忽略隐藏文件
      persistent: true,
      ignoreInitial: false, // 处理已存在的文件
      awaitWriteFinish: {
        stabilityThreshold: 2000, // 等待文件写入完成（2秒）
        pollInterval: 100
      }
    });

    // 文件添加事件
    this.watcher.on('add', (filePath) => {
      if (this.isSupportedFile(filePath)) {
        console.log(`📥 检测到新文件: ${filePath}`);
        this.handleNewDocument(filePath);
      }
    });

    // 文件修改事件
    this.watcher.on('change', (filePath) => {
      if (this.isSupportedFile(filePath)) {
        console.log(`📝 文件已修改: ${filePath}`);
        this.handleDocumentChange(filePath);
      }
    });

    // 文件删除事件
    this.watcher.on('unlink', (filePath) => {
      if (this.isSupportedFile(filePath)) {
        console.log(`🗑️ 文件已删除: ${filePath}`);
        this.handleDocumentRemove(filePath);
      }
    });

    // 监听错误
    this.watcher.on('error', (error) => {
      console.error('❌ 监听错误:', error);
    });

    // 准备就绪
    this.watcher.on('ready', () => {
      console.log('✅ 文档监听已就绪');
    });

    return this;
  }

  /**
   * 停止监听
   */
  stop() {
    if (this.watcher) {
      this.watcher.close();
      console.log('🛑 文档监听已停止');
    }
  }

  /**
   * 检查是否是支持的文件类型
   * @param {string} filePath - 文件路径
   * @returns {boolean}
   */
  isSupportedFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return this.options.supportedExtensions.includes(ext);
  }

  /**
   * 处理新文档
   * @param {string} filePath - 文件路径
   */
  async handleNewDocument(filePath) {
    // 避免重复处理
    if (this.processedFiles.has(filePath)) {
      return;
    }
    
    this.processedFiles.add(filePath);
    
    if (this.options.onNewDocument) {
      try {
        await this.options.onNewDocument(filePath);
      } catch (error) {
        console.error(`❌ 处理新文档失败: ${filePath}`, error);
        // 处理失败，从集合中移除以便重试
        this.processedFiles.delete(filePath);
      }
    }
  }

  /**
   * 处理文档变更
   * @param {string} filePath - 文件路径
   */
  async handleDocumentChange(filePath) {
    if (this.options.onDocumentChange) {
      try {
        await this.options.onDocumentChange(filePath);
      } catch (error) {
        console.error(`❌ 处理文档变更失败: ${filePath}`, error);
      }
    }
  }

  /**
   * 处理文档删除
   * @param {string} filePath - 文件路径
   */
  async handleDocumentRemove(filePath) {
    this.processedFiles.delete(filePath);
    
    if (this.options.onDocumentRemove) {
      try {
        await this.options.onDocumentRemove(filePath);
      } catch (error) {
        console.error(`❌ 处理文档删除失败: ${filePath}`, error);
      }
    }
  }

  /**
   * 扫描目录中的所有现有文件
   * @returns {Promise<Array<string>>}
   */
  async scanExisting() {
    return new Promise((resolve) => {
      const files = [];
      
      this.watcher.on('add', (filePath) => {
        if (this.isSupportedFile(filePath)) {
          files.push(filePath);
        }
      });

      this.watcher.on('ready', () => {
        resolve(files);
      });
    });
  }
}

module.exports = DocumentWatcher;
