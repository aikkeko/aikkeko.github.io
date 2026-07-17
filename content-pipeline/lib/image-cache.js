/**
 * 图片缓存管理器
 * 用于追踪已上传的图片，避免重复上传
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class ImageCacheManager {
  constructor(options = {}) {
    this.cacheDir = options.cacheDir || './.pipeline-cache';
    this.cacheFile = path.join(this.cacheDir, 'image-cache.json');
    this.cache = {};
  }

  /**
   * 初始化缓存
   */
  async initialize() {
    try {
      await fs.access(this.cacheDir);
    } catch {
      await fs.mkdir(this.cacheDir, { recursive: true });
    }

    try {
      const data = await fs.readFile(this.cacheFile, 'utf8');
      this.cache = JSON.parse(data);
      console.log(`📦 已加载图片缓存: ${Object.keys(this.cache).length} 张`);
    } catch {
      this.cache = {};
      console.log('📦 新建图片缓存');
    }
  }

  /**
   * 计算图片哈希
   * @param {Buffer} buffer - 图片内容
   * @returns {string} MD5 哈希
   */
  calculateHash(buffer) {
    return crypto.createHash('md5').update(buffer).digest('hex');
  }

  /**
   * 检查图片是否已上传
   * @param {Buffer} buffer - 图片内容
   * @returns {Object|null} 缓存信息或 null
   */
  getCachedImage(buffer) {
    const hash = this.calculateHash(buffer);
    return this.cache[hash] || null;
  }

  /**
   * 添加图片到缓存
   * @param {Buffer} buffer - 图片内容
   * @param {string} url - R2 URL
   * @param {string} key - R2 key
   * @param {string} articleId - 文章标识
   */
  async addToCache(buffer, url, key, articleId = '') {
    const hash = this.calculateHash(buffer);
    this.cache[hash] = {
      url,
      key,
      articleId,
      uploadedAt: new Date().toISOString(),
      size: buffer.length
    };
    await this.saveCache();
  }

  /**
   * 保存缓存到文件
   */
  async saveCache() {
    await fs.writeFile(this.cacheFile, JSON.stringify(this.cache, null, 2));
  }

  /**
   * 获取文章关联的所有图片
   * @param {string} articleId - 文章标识
   * @returns {Array} 图片列表
   */
  getArticleImages(articleId) {
    return Object.entries(this.cache)
      .filter(([_, info]) => info.articleId === articleId)
      .map(([hash, info]) => ({ hash, ...info }));
  }

  /**
   * 清理过期缓存（可选）
   * @param {number} days - 过期天数
   */
  async cleanExpired(days = 30) {
    const now = Date.now();
    const expired = Object.entries(this.cache).filter(([_, info]) => {
      const uploaded = new Date(info.uploadedAt).getTime();
      return (now - uploaded) > (days * 24 * 60 * 60 * 1000);
    });

    for (const [hash] of expired) {
      delete this.cache[hash];
    }

    if (expired.length > 0) {
      await this.saveCache();
      console.log(`🧹 清理过期缓存: ${expired.length} 张`);
    }
  }
}

module.exports = ImageCacheManager;
