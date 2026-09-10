/**
 * Markdown 文档处理器
 * 处理 .md 文件，提取图片并上传
 */

const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');
const { parsePost, yamlOptions } = require('../../tools/lib/content-store');

class MarkdownProcessor {
  constructor(options = {}) {
    this.options = {
      defaultAuthor: options.defaultAuthor || 'AikeKo',
      imageTransformer: options.imageTransformer || null
    };
  }

  /**
   * 处理 Markdown 文件
   * @param {string} content - Markdown 内容
   * @param {string} filename - 文件名
   * @param {string} basePath - 基础路径（用于查找本地图片）
   * @returns {Promise<{content: string, images: Array, metadata: Object}>}
   */
  async process(content, filename, basePath = '', configuredMetadata = {}) {
    console.log(`📝 正在处理 Markdown: ${filename}`);
    
    // 提取元数据
    const { metadata: sourceMetadata, body } = this.extractFrontmatter(content, filename);
    const metadata = this.mergeConfiguredMetadata(sourceMetadata, configuredMetadata);
    
    // 提取图片
    const images = await this.extractImages(body, basePath);
    if (images.length && !this.options.imageTransformer) throw new Error('图片上传不可用，保留原文章，请检查 R2 配置');
    
    // 如果有图片转换器，上传图片并替换链接
    let processedContent = body;
    if (this.options.imageTransformer && images.length > 0) {
      console.log(`🖼️ 发现 ${images.length} 张本地图片，开始上传...`);
      const uploadResults = await this.options.imageTransformer(images);
      if (uploadResults.length !== images.length || uploadResults.some(result => !result?.url || result.error)) {
        throw new Error('图片上传未全部成功，保留原文章，请重试');
      }
      
      // 替换图片链接
      processedContent = this.replaceImageLinks(body, images, uploadResults);
    }
    
    // 组装最终内容
    const finalContent = this.rebuildDocument(metadata, processedContent);
    
    console.log(`✅ Markdown 处理完成: ${metadata.title || filename}`);
    
    return {
      content: finalContent,
      images,
      metadata
    };
  }

  mergeConfiguredMetadata(sourceMetadata, configuredMetadata) {
    if (!configuredMetadata || typeof configuredMetadata !== 'object') {
      return sourceMetadata;
    }

    const merged = { ...sourceMetadata, ...configuredMetadata };

    if (configuredMetadata.category && !configuredMetadata.categories) {
      merged.categories = [configuredMetadata.category];
    }

    delete merged.category;
    delete merged.frontmatter;
    delete merged.id;
    delete merged.post_file;

    if (configuredMetadata.frontmatter && typeof configuredMetadata.frontmatter === 'object') {
      Object.assign(merged, configuredMetadata.frontmatter);
    }

    return merged;
  }

  /**
   * 提取 Frontmatter
   * @param {string} content - 文档内容
   * @returns {Object} { metadata, body }
   */
  extractFrontmatter(content, filename = 'untitled.md') {
    content = content.replace(/^\uFEFF/, '');
    if (/^---\r?\n/.test(content)) {
      const { front, body } = parsePost(content);
      if (!front || typeof front !== 'object' || Array.isArray(front)) throw new Error('frontmatter 必须是 YAML 对象');
      return { metadata: front, body };
    }
    const name = path.basename(filename, path.extname(filename));
    const dated = name.match(/^(\d{4})(\d{2})(\d{2})_(.+)$/);
    return {
      metadata: {
        title: dated ? dated[4] : name,
        date: dated ? `${dated[1]}-${dated[2]}-${dated[3]} 00:00:00` : new Date().toISOString(),
        author: this.options.defaultAuthor
      },
      body: content
    };
  }

  /**
   * 提取本地图片
   * @param {string} content - Markdown 内容
   * @param {string} basePath - 基础路径
   * @returns {Promise<Array>} 图片列表
   */
  async extractImages(content, basePath) {
    const images = [];
    
    // Markdown 图片语法: ![alt](path)
    const markdownImageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
    let match;
    
    while ((match = markdownImageRegex.exec(content)) !== null) {
      const [fullMatch, alt, imagePath] = match;
      
      // 只处理本地路径（非 URL）
      if (!imagePath.startsWith('http') && !imagePath.startsWith('//')) {
        const absolutePath = path.isAbsolute(imagePath) 
          ? imagePath 
          : path.join(basePath, imagePath);
        
        try {
          const buffer = await fs.readFile(absolutePath);
          images.push({
            buffer,
            name: path.basename(imagePath),
            alt,
            originalPath: imagePath,
            absolutePath
          });
        } catch (error) {
          throw new Error(`无法读取图片 ${imagePath}：${error.message}`);
        }
      }
    }
    
    // HTML 图片标签
    const htmlImageRegex = /<img[^\u003e]*src="([^"]+)"[^\u003e]*>/g;
    while ((match = htmlImageRegex.exec(content)) !== null) {
      const imagePath = match[1];
      
      if (!imagePath.startsWith('http') && !imagePath.startsWith('//')) {
        const absolutePath = path.isAbsolute(imagePath) 
          ? imagePath 
          : path.join(basePath, imagePath);
        
        try {
          // 检查是否已添加
          const alreadyAdded = images.some(img => img.absolutePath === absolutePath);
          if (!alreadyAdded) {
            const buffer = await fs.readFile(absolutePath);
            images.push({
              buffer,
              name: path.basename(imagePath),
              alt: '',
              originalPath: imagePath,
              absolutePath
            });
          }
        } catch (error) {
          throw new Error(`无法读取图片 ${imagePath}：${error.message}`);
        }
      }
    }
    
    return images;
  }

  /**
   * 替换图片链接
   * @param {string} content - 原始内容
   * @param {Array} originalImages - 原始图片列表
   * @param {Array} uploadResults - 上传结果
   * @returns {string} 替换后的内容
   */
  replaceImageLinks(content, originalImages, uploadResults) {
    let newContent = content;
    
    originalImages.forEach((image, index) => {
      const result = uploadResults[index];
      if (result && result.url) {
        // 替换 Markdown 语法
        const markdownRegex = new RegExp(
          `!\\[([^\\]]*)\\]\\(${this.escapeRegex(image.originalPath)}\\)`,
          'g'
        );
        newContent = newContent.replace(markdownRegex, `![$1](${result.url})`);
        
        // 替换 HTML 语法
        const htmlRegex = new RegExp(
          `src="${this.escapeRegex(image.originalPath)}"`,
          'g'
        );
        newContent = newContent.replace(htmlRegex, `src="${result.url}"`);
      }
    });
    
    return newContent;
  }

  /**
   * 转义正则特殊字符
   * @param {string} string - 字符串
   * @returns {string} 转义后的字符串
   */
  escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * 重建文档
   * @param {Object} metadata - 元数据
   * @param {string} body - 正文
   * @returns {string} 完整文档
   */
  rebuildDocument(metadata, body) {
    return `---\n${yaml.dump(metadata, yamlOptions)}---\n${body}`;
  }
}

module.exports = MarkdownProcessor;
