/**
 * Cloudflare R2 图片上传器
 * 使用 AWS SDK v3 S3 客户端（R2 兼容 S3 API）
 */

const { S3Client, PutObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const config = require('../config/r2-config');

class R2Uploader {
  constructor() {
    this.validateConfig();
    this.s3Client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey
      }
    });
  }

  validateConfig() {
    try {
      config.validate();
      console.log('✅ R2 配置验证通过');
    } catch (error) {
      console.error('❌ R2 配置错误:', error.message);
      throw error;
    }
  }

  /**
   * 生成唯一文件名
   * @param {Buffer} buffer - 文件内容
   * @param {string} originalName - 原始文件名
   * @returns {string} 唯一文件名
   */
  generateUniqueName(buffer, originalName) {
    const hash = crypto.createHash('md5').update(buffer).digest('hex').slice(0, 8);
    const ext = path.extname(originalName) || '.png';
    const base = path.basename(originalName, ext);
    const timestamp = Date.now();
    
    // 格式: blog/2024/03/filename_hash_timestamp.ext
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    
    return `${config.uploadPrefix}/${year}/${month}/${base}_${hash}_${timestamp}${ext}`;
  }

  /**
   * 检测文件 MIME 类型
   * @param {string} filename - 文件名
   * @returns {string} MIME 类型
   */
  getMimeType(filename) {
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.bmp': 'image/bmp',
      '.ico': 'image/x-icon'
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * 检查文件是否已存在
   * @param {string} key - 文件键名
   * @returns {Promise<boolean>}
   */
  async fileExists(key) {
    try {
      await this.s3Client.send(new HeadObjectCommand({
        Bucket: config.bucketName,
        Key: key
      }));
      return true;
    } catch (error) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        return false;
      }
      throw error;
    }
  }

  /**
   * 上传单个文件到 R2
   * @param {Buffer} buffer - 文件内容
   * @param {string} originalName - 原始文件名
   * @returns {Promise<{key: string, url: string}>}
   */
  async upload(buffer, originalName) {
    const key = this.generateUniqueName(buffer, originalName);
    const contentType = this.getMimeType(originalName);
    
    // 检查文件是否已存在（基于 MD5）
    const exists = await this.fileExists(key);
    if (exists) {
      console.log(`📝 文件已存在，跳过上传: ${key}`);
      return {
        key,
        url: this.getPublicUrl(key)
      };
    }

    try {
      const command = new PutObjectCommand({
        Bucket: config.bucketName,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        Metadata: {
          'original-name': originalName,
          'uploaded-at': new Date().toISOString()
        }
      });

      await this.s3Client.send(command);
      
      const url = this.getPublicUrl(key);
      console.log(`✅ 上传成功: ${key}`);
      console.log(`🔗 访问地址: ${url}`);
      
      return { key, url };
    } catch (error) {
      console.error(`❌ 上传失败: ${originalName}`, error);
      throw error;
    }
  }

  /**
   * 从文件路径上传
   * @param {string} filePath - 本地文件路径
   * @returns {Promise<{key: string, url: string}>}
   */
  async uploadFromPath(filePath) {
    try {
      const buffer = await fs.readFile(filePath);
      const filename = path.basename(filePath);
      return await this.upload(buffer, filename);
    } catch (error) {
      console.error(`❌ 读取文件失败: ${filePath}`, error);
      throw error;
    }
  }

  /**
   * 批量上传多个文件（支持增量上传）
   * @param {Array<{buffer: Buffer, name: string}>} files - 文件列表
   * @param {Object} options - 选项
   * @param {ImageCacheManager} options.cacheManager - 缓存管理器
   * @param {string} options.articleId - 文章标识
   * @returns {Promise<Array<{key: string, url: string, originalName: string, isNew: boolean}>>}
   */
  async uploadBatch(files, options = {}) {
    const { cacheManager, articleId } = options;
    const hasCache = cacheManager && articleId;
    
    if (hasCache) {
      console.log(`📦 开始批量上传 ${files.length} 个文件（支持增量）...`);
    } else {
      console.log(`📦 开始批量上传 ${files.length} 个文件到 R2...`);
    }
    
    const results = [];
    let newCount = 0;
    let cachedCount = 0;
    
    for (const file of files) {
      try {
        let result;
        let isNew = false;
        
        // 检查本地缓存
        if (hasCache) {
          const cached = cacheManager.getCachedImage(file.buffer);
          if (cached) {
            console.log(`📋 使用缓存图片: ${file.name} → ${cached.url}`);
            result = {
              key: cached.key,
              url: cached.url
            };
            cachedCount++;
          }
        }
        
        // 如果缓存中没有，上传新图片
        if (!result) {
          result = await this.upload(file.buffer, file.name);
          isNew = true;
          newCount++;
          
          // 添加到缓存
          if (hasCache) {
            await cacheManager.addToCache(
              file.buffer,
              result.url,
              result.key,
              articleId
            );
          }
        }
        
        results.push({
          ...result,
          originalName: file.name,
          isNew
        });
      } catch (error) {
        console.error(`❌ 上传失败: ${file.name}`, error.message);
        results.push({
          key: null,
          url: null,
          originalName: file.name,
          error: error.message,
          isNew: false
        });
      }
    }
    
    const successCount = results.filter(r => !r.error).length;
    if (hasCache) {
      console.log(`✅ 批量上传完成: ${successCount}/${files.length} 成功`);
      console.log(`   🆕 新上传: ${newCount} 张 | 📋 使用缓存: ${cachedCount} 张`);
    } else {
      console.log(`✅ 批量上传完成: ${successCount}/${files.length} 成功`);
    }
    
    return results;
  }

  /**
   * 获取公开访问 URL
   * @param {string} key - 文件键名
   * @returns {string} 公开 URL
   */
  getPublicUrl(key) {
    if (config.publicUrl) {
      // R2.dev 子域名需要包含 bucket 名称
      // 格式: https://{subdomain}.r2.dev/{bucket}/{key}
      if (config.publicUrl.includes('.r2.dev')) {
        return `${config.publicUrl}/${config.bucketName}/${key}`;
      }
      return `${config.publicUrl}/${key}`;
    }
    // 如果没有配置公开 URL，使用 R2 原生域名
    return `${config.endpoint}/${config.bucketName}/${key}`;
  }
}

module.exports = R2Uploader;
