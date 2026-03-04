/**
 * Markdown 文档处理器
 * 处理 .md 文件，提取图片并上传
 */

const fs = require('fs').promises;
const path = require('path');
const cheerio = require('cheerio');

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
  async process(content, filename, basePath = '') {
    console.log(`📝 正在处理 Markdown: ${filename}`);
    
    // 提取元数据
    const { metadata, body } = this.extractFrontmatter(content);
    
    // 提取图片
    const images = await this.extractImages(body, basePath);
    
    // 如果有图片转换器，上传图片并替换链接
    let processedContent = body;
    if (this.options.imageTransformer && images.length > 0) {
      console.log(`🖼️ 发现 ${images.length} 张本地图片，开始上传...`);
      const uploadResults = await this.options.imageTransformer(images);
      
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

  /**
   * 提取 Frontmatter
   * @param {string} content - 文档内容
   * @returns {Object} { metadata, body }
   */
  extractFrontmatter(content) {
    const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
    const match = content.match(frontmatterRegex);
    
    if (match) {
      const frontmatterText = match[1];
      const body = match[2];
      
      // 解析 YAML
      const metadata = {};
      frontmatterText.split('\n').forEach(line => {
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
          const key = line.substring(0, colonIndex).trim();
          let value = line.substring(colonIndex + 1).trim();
          
          // 处理数组
          if (value.startsWith('[') && value.endsWith(']')) {
            try {
              value = JSON.parse(value.replace(/'/g, '"'));
            } catch {
              value = value.slice(1, -1).split(',').map(s => s.trim());
            }
          }
          
          metadata[key] = value;
        }
      });
      
      return { metadata, body };
    }
    
    // 没有 frontmatter，创建一个
    return {
      metadata: {
        title: path.basename(filename, '.md'),
        date: new Date().toISOString(),
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
          console.warn(`⚠️ 无法读取图片: ${imagePath}`, error.message);
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
          console.warn(`⚠️ 无法读取图片: ${imagePath}`, error.message);
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
    const yaml = [];
    yaml.push('---');
    
    Object.entries(metadata).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        yaml.push(`${key}:`);
        value.forEach(item => yaml.push(`  - ${item}`));
      } else {
        yaml.push(`${key}: ${value}`);
      }
    });
    
    yaml.push('---');
    
    return `${yaml.join('\n')}\n\n${body}`;
  }
}

module.exports = MarkdownProcessor;
