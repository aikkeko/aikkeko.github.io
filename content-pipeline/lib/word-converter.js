/**
 * Word 文档转 Markdown 转换器
 * 支持提取图片、生成 Frontmatter
 */

const mammoth = require('mammoth');
const cheerio = require('cheerio');
const path = require('path');

class WordToMarkdownConverter {
  constructor(options = {}) {
    this.options = {
      // 默认作者
      defaultAuthor: options.defaultAuthor || 'AikeKo',
      // 默认分类
      defaultCategory: options.defaultCategory || '随笔',
      // 图片转换函数
      imageTransformer: options.imageTransformer || null
    };
  }

  /**
   * 从文件名提取标题
   * @param {string} filename - 文件名
   * @returns {string} 标题
   */
  extractTitleFromFilename(filename) {
    const basename = path.basename(filename, path.extname(filename));
    // 移除常见的日期前缀 (如 2024-01-01-title)
    return basename.replace(/^\d{4}[-_]\d{2}[-_]\d{2}[-_]/, '').replace(/[-_]/g, ' ');
  }

  /**
   * 从文档内容推断分类和标签
   * @param {string} content - 文档内容
   * @returns {Object} { category, tags }
   */
  inferCategoryAndTags(content) {
    const lowerContent = content.toLowerCase();
    
    // 关键词映射
    const keywords = {
      '游戏': ['游戏', 'galgame', 'rpg', '评测', '攻略', 'nintendo', 'playstation'],
      '动画': ['动画', 'anime', 'eva', 'manga', '番剧', '宫崎骏'],
      '文学': ['小说', '文学', '书评', '读后感', '卡夫卡', '村上春树'],
      '技术': ['代码', '编程', 'javascript', 'python', 'hexo', '教程'],
      '生活': ['日常', '随笔', '旅行', '美食', '摄影']
    };

    let matchedCategory = this.options.defaultCategory;
    let matchedTags = [];

    for (const [category, words] of Object.entries(keywords)) {
      if (words.some(word => lowerContent.includes(word))) {
        matchedCategory = category;
        matchedTags = words.filter(word => lowerContent.includes(word)).slice(0, 3);
        break;
      }
    }

    return { category: matchedCategory, tags: matchedTags };
  }

  /**
   * 转换 Word 文档为 Markdown
   * @param {Buffer} buffer - Word 文档 Buffer
   * @param {string} filename - 原始文件名
   * @param {Object} options - 选项
   * @param {string} options.articleId - 文章标识（用于图片缓存）
   * @param {ImageCacheManager} options.cacheManager - 缓存管理器
   * @returns {Promise<{markdown: string, images: Array, metadata: Object}>}
   */
  async convert(buffer, filename, options = {}) {
    console.log(`📝 正在转换: ${filename}`);
    
    const { articleId, cacheManager } = options;
    
    // 提取标题
    const title = this.extractTitleFromFilename(filename);
    
    // 使用 mammoth 内置的图片处理，生成 base64 图片
    const mammothOptions = {
      convertImage: mammoth.images.imgElement((image) => {
        return image.read().then((imageBuffer) => {
          const base64 = imageBuffer.toString('base64');
          return {
            src: `data:${image.contentType};base64,${base64}`,
            alt: image.altText || ''
          };
        });
      })
    };

    // 转换为 HTML
    let result;
    try {
      result = await mammoth.convertToHtml({ buffer }, mammothOptions);
      console.log(`  ✓ HTML 转换成功，原始长度: ${result.value.length} 字符`);
    } catch (error) {
      console.error('❌ HTML 转换失败:', error.message);
      // 降级到纯文本转换
      result = await mammoth.extractRawText({ buffer });
      result.value = `<p>${result.value.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>`;
    }
    let html = result.value;
    
    // 提取图片
    const images = [];
    const $ = cheerio.load(html);
    
    $('img').each((index, element) => {
      const $img = $(element);
      const src = $img.attr('src');
      const alt = $img.attr('alt') || '';
      
      // 检查是否是 base64 图片
      if (src && src.startsWith('data:')) {
        const match = src.match(/^data:image\/\w+;base64,(.+)$/);
        if (match) {
          const imageBuffer = Buffer.from(match[1], 'base64');
          const ext = src.match(/data:image\/(\w+);/)?.[1] || 'png';
          const imageName = `image_${index + 1}.${ext}`;
          
          images.push({
            buffer: imageBuffer,
            name: imageName,
            alt: alt,
            originalSrc: src
          });
        }
      }
    });

    // 如果有图片转换器，转换图片链接
    if (this.options.imageTransformer && images.length > 0) {
      console.log(`🖼️ 发现 ${images.length} 张图片，开始上传...`);
      
      // 传入缓存选项
      const uploadOptions = {};
      if (cacheManager && articleId) {
        uploadOptions.cacheManager = cacheManager;
        uploadOptions.articleId = articleId;
      }
      
      const uploadResults = await this.options.imageTransformer(images, uploadOptions);
      
      // 替换 HTML 中的图片链接
      $('img').each((index, element) => {
        const $img = $(element);
        const src = $img.attr('src');
        
        if (src && src.startsWith('data:')) {
          const result = uploadResults[index];
          if (result && result.url) {
            $img.attr('src', result.url);
            const status = result.isNew ? '🆕' : '📋';
            console.log(`  ${status} 替换图片 ${index + 1}: ${result.url}`);
          }
        }
      });
      
      html = $.html();
    }

    // 转换 HTML 为 Markdown
    const markdown = this.htmlToMarkdown(html, $);
    
    // 推断分类和标签
    const { category, tags } = this.inferCategoryAndTags(markdown);
    
    // 生成 Frontmatter
    const metadata = {
      title,
      date: new Date().toISOString(),
      author: this.options.defaultAuthor,
      categories: [category],
      tags: tags,
      description: this.generateDescription(markdown)
    };

    // 组装最终 Markdown
    const frontmatter = this.generateFrontmatter(metadata);
    const finalMarkdown = `${frontmatter}\n\n${markdown}`;

    console.log(`✅ 转换完成: ${title}`);
    
    return {
      markdown: finalMarkdown,
      images,
      metadata
    };
  }

  /**
   * HTML 转 Markdown
   * @param {string} html - HTML 内容
   * @param {Object} $ - Cheerio 实例
   * @returns {string} Markdown
   */
  htmlToMarkdown(html, $) {
    // 简单的 HTML 到 Markdown 转换
    let markdown = html;
    
    // 标题
    markdown = markdown.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n');
    markdown = markdown.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n');
    markdown = markdown.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n');
    markdown = markdown.replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n\n');
    
    // 段落
    markdown = markdown.replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n');
    
    // 粗体和斜体
    markdown = markdown.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**');
    markdown = markdown.replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**');
    markdown = markdown.replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*');
    markdown = markdown.replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*');
    
    // 链接
    markdown = markdown.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)');
    
    // 图片（保留已转换的 URL）
    markdown = markdown.replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*\/?>/gi, 
      (match, src, alt) => `![${alt}](${src})`);
    markdown = markdown.replace(/<img[^>]*src="([^"]*)"[^>]*\/?>/gi, '![]($1)');
    
    // 代码块
    markdown = markdown.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, 
      '\n```\n$1\n```\n');
    markdown = markdown.replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`');
    
    // 列表
    markdown = markdown.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (match, content) => {
      return content.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n');
    });
    markdown = markdown.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (match, content) => {
      let index = 1;
      return content.replace(/<li[^>]*>(.*?)<\/li>/gi, () => `${index++}. $1\n`);
    });
    
    // 引用
    markdown = markdown.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, 
      (match, content) => content.split('\n').map(line => `> ${line}`).join('\n') + '\n\n');
    
    // 水平线
    markdown = markdown.replace(/<hr\s*\/?>/gi, '\n---\n\n');
    
    // 移除所有剩余 HTML 标签
    markdown = markdown.replace(/<[^>]+>/g, '');
    
    // 解码 HTML 实体
    markdown = markdown.replace(/&lt;/g, '<')
                       .replace(/&gt;/g, '>')
                       .replace(/&amp;/g, '&')
                       .replace(/&quot;/g, '"')
                       .replace(/&#39;/g, "'")
                       .replace(/&nbsp;/g, ' ');
    
    // 清理多余空白
    markdown = markdown.replace(/\n{3,}/g, '\n\n');
    markdown = markdown.trim();
    
    return markdown;
  }

  /**
   * 生成 Frontmatter
   * @param {Object} metadata - 元数据
   * @returns {string} YAML Frontmatter
   */
  generateFrontmatter(metadata) {
    const yaml = [];
    yaml.push('---');
    yaml.push(`title: ${metadata.title}`);
    yaml.push(`date: ${metadata.date}`);
    yaml.push(`author: ${metadata.author}`);
    yaml.push(`categories:`);
    metadata.categories.forEach(cat => yaml.push(`  - ${cat}`));
    yaml.push(`tags:`);
    metadata.tags.forEach(tag => yaml.push(`  - ${tag}`));
    if (metadata.description) {
      yaml.push(`description: ${metadata.description}`);
    }
    yaml.push('---');
    
    return yaml.join('\n');
  }

  /**
   * 生成文章描述（前200字符）
   * @param {string} markdown - Markdown 内容
   * @returns {string} 描述
   */
  generateDescription(markdown) {
    // 移除 Markdown 语法
    const plainText = markdown
      .replace(/#+ /g, '')
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/`/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, '')
      .replace(/\n/g, ' ')
      .trim();
    
    if (plainText.length <= 200) {
      return plainText;
    }
    return plainText.substring(0, 200).trim() + '...';
  }
}

module.exports = WordToMarkdownConverter;
