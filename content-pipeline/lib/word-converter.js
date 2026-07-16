/**
 * Word to Markdown converter.
 *
 * Project rules:
 * - The first meaningful title/line in the doc becomes the blog title.
 * - That title is removed from the Markdown body.
 * - The first image in the doc becomes header_image / cover only.
 * - That cover image is removed from the Markdown body.
 * - Remaining local/doc images are uploaded through the configured transformer.
 */

const mammoth = require('mammoth');
const cheerio = require('cheerio');
const path = require('path');

class WordToMarkdownConverter {
  constructor(options = {}) {
    this.options = {
      defaultAuthor: options.defaultAuthor || 'AikeKo',
      defaultCategory: options.defaultCategory || '随笔',
      imageTransformer: options.imageTransformer || null
    };
  }

  extractTitleFromFilename(filename) {
    const basename = path.basename(filename, path.extname(filename));
    return basename
      .replace(/^\d{8}_/, '')
      .replace(/^\d{4}[-_]\d{2}[-_]\d{2}[-_]/, '')
      .replace(/[-_]/g, ' ')
      .trim();
  }

  inferCategoryAndTags(content) {
    const lowerContent = content.toLowerCase();
    const keywords = {
      '游戏': ['游戏', 'galgame', 'rpg', 'vorkuta', 'z.a.t.o', 'narcissu', '攻略', '评测', 'nintendo', 'playstation'],
      '动画': ['动画', 'anime', 'eva', 'evangelion', 'manga', '番剧', '宫崎骏'],
      '文学': ['小说', '文学', '书评', '读后感', '卡夫卡', '村上春树', 'carnival'],
      '技术': ['代码', '编程', 'javascript', 'python', 'hexo', '教程'],
      '生活': ['日常', '随笔', '旅行', '新加坡', '摄影']
    };

    let matchedCategory = this.options.defaultCategory;
    let matchedTags = [];

    for (const [category, words] of Object.entries(keywords)) {
      const matches = words.filter(word => lowerContent.includes(word.toLowerCase()));
      if (matches.length > 0) {
        matchedCategory = category;
        matchedTags = matches.slice(0, 3);
        break;
      }
    }

    return { category: matchedCategory, tags: matchedTags };
  }

  async convert(buffer, filename, options = {}) {
    console.log(`📝 正在转换: ${filename}`);

    const { articleId, cacheManager, sourceDate } = options;

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

    let result;
    try {
      result = await mammoth.convertToHtml({ buffer }, mammothOptions);
      console.log(`  ✓ HTML 转换成功，原始长度: ${result.value.length} 字符`);
    } catch (error) {
      console.error('❌ HTML 转换失败:', error.message);
      result = await mammoth.extractRawText({ buffer });
      result.value = `<p>${result.value.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>`;
    }

    let html = result.value;
    const $ = cheerio.load(html);
    const images = this.extractEmbeddedImages($);

    if (this.options.imageTransformer && images.length > 0) {
      console.log(`🖼️ 发现 ${images.length} 张图片，开始上传...`);

      const uploadOptions = {};
      if (cacheManager && articleId) {
        uploadOptions.cacheManager = cacheManager;
        uploadOptions.articleId = articleId;
      }

      const uploadResults = await this.options.imageTransformer(images, uploadOptions);
      this.replaceEmbeddedImageSources($, uploadResults);
      html = $.html();
    }

    const coverImage = this.extractCoverImage($);
    const title = this.extractTitleFromDocument($, filename);
    this.normalizeQuoteBlocks($);
    this.removeLeadingEmptyBlocks($);
    html = $.html();

    const markdown = this.htmlToMarkdown(html);
    const { category, tags } = this.inferCategoryAndTags(markdown);

    const metadata = {
      title,
      date: sourceDate ? `${sourceDate} 00:00:00` : new Date().toISOString(),
      author: this.options.defaultAuthor,
      categories: [category],
      tags,
      description: this.generateDescription(markdown),
      header_image: coverImage
    };

    const frontmatter = this.generateFrontmatter(metadata);
    const finalMarkdown = `${frontmatter}\n\n${markdown}`;

    console.log(`✅ 转换完成: ${title}`);

    return {
      markdown: finalMarkdown,
      images,
      metadata
    };
  }

  extractEmbeddedImages($) {
    const images = [];

    $('img').each((index, element) => {
      const $img = $(element);
      const src = $img.attr('src');
      const alt = $img.attr('alt') || '';

      if (!src || !src.startsWith('data:')) {
        return;
      }

      const match = src.match(/^data:image\/\w+;base64,(.+)$/);
      if (!match) {
        return;
      }

      const imageBuffer = Buffer.from(match[1], 'base64');
      const ext = src.match(/data:image\/(\w+);/)?.[1] || 'png';

      images.push({
        buffer: imageBuffer,
        name: `image_${index + 1}.${ext}`,
        alt,
        originalSrc: src
      });
    });

    return images;
  }

  replaceEmbeddedImageSources($, uploadResults) {
    $('img').each((index, element) => {
      const $img = $(element);
      const src = $img.attr('src');

      if (!src || !src.startsWith('data:')) {
        return;
      }

      const result = uploadResults[index];
      if (result && result.url) {
        $img.attr('src', result.url);
        const status = result.isNew ? '🆕' : '📋';
        console.log(`  ${status} 替换图片 ${index + 1}: ${result.url}`);
      }
    });
  }

  extractCoverImage($) {
    const $firstImage = $('img').first();
    if (!$firstImage.length) {
      return '';
    }

    const coverImage = $firstImage.attr('src') || '';
    const $parent = $firstImage.parent();

    if ($parent.length && this.normalizeText($parent.text()) === '' && $parent.children().length === 1) {
      $parent.remove();
    } else {
      $firstImage.remove();
    }

    return coverImage;
  }

  extractTitleFromDocument($, filename) {
    const fallback = this.extractTitleFromFilename(filename);
    const candidates = $('body').length ? $('body').find('h1,h2,h3,p') : $('h1,h2,h3,p');

    for (const element of candidates.toArray()) {
      const $element = $(element);
      const text = this.normalizeText($element.text());

      if (!text || $element.find('img').length && text.length < 2) {
        continue;
      }

      if (/^h[1-3]$/i.test(element.tagName || element.name)) {
        $element.remove();
        return this.cleanTitle(text) || fallback;
      }

      const title = this.deriveTitleFromParagraph(text);
      if (title) {
        const remainder = text.slice(title.length).trim().replace(/^[:：|｜\-—–\s]+/, '');
        if (remainder.length > 20) {
          $element.text(remainder);
        } else {
          $element.remove();
        }
        return this.cleanTitle(title) || fallback;
      }
    }

    return fallback;
  }

  deriveTitleFromParagraph(text) {
    const normalized = this.cleanTitle(text);
    if (!normalized) {
      return '';
    }

    if (normalized.length <= 96) {
      return normalized;
    }

    const sentence = normalized.match(/^(.{4,96}?[。！？!?])(?:\s|$)/);
    return sentence ? sentence[1].trim() : '';
  }

  normalizeQuoteBlocks($) {
    const isQuoteParagraph = element => {
      const $p = $(element);

      if ($p.find('img').length) {
        return false;
      }

      const text = this.normalizeText($p.text());
      if (!text || text.length > 220) {
        return false;
      }

      return this.isItalicOnlyParagraph($p);
    };

    const paragraphs = $('p').toArray();
    const handled = new Set();

    paragraphs.forEach(element => {
      if (handled.has(element) || !isQuoteParagraph(element)) {
        return;
      }

      const group = [element];
      handled.add(element);

      let next = $(element).next();
      while (next.length && next[0].tagName && next[0].tagName.toLowerCase() === 'p' && isQuoteParagraph(next[0])) {
        group.push(next[0]);
        handled.add(next[0]);
        next = next.next();
      }

      const quoteHtml = group
        .map(node => {
          const $node = $(node);
          return `<p>${$node.html() || this.normalizeText($node.text())}</p>`;
        })
        .join('');

      $(element).replaceWith(`<blockquote>${quoteHtml}</blockquote>`);
      group.slice(1).forEach(node => $(node).remove());
    });

    return;

    $('p').each((_, element) => {
      const $p = $(element);

      if ($p.find('img').length) {
        return;
      }

      const text = this.normalizeText($p.text());
      if (!text || text.length > 220) {
        return;
      }

      if (!this.isItalicOnlyParagraph($p)) {
        return;
      }

      $p.replaceWith(`<blockquote><p>${$p.html() || text}</p></blockquote>`);
      return;

      const hasOnlyInlineEmphasis = $p.children().length > 0 && $p.children().toArray().every(child => {
        const name = (child.tagName || child.name || '').toLowerCase();
        return ['em', 'i', 'strong', 'b', 'span', 'br'].includes(name);
      });
      const looksQuoted = /^[“"「『《〈‘'—–-]/.test(text) || /[”"」』》〉’']$/.test(text) || /^——/.test(text);

      if (looksQuoted || hasOnlyInlineEmphasis && /[“”"「」『』《》]/.test(text)) {
        $p.replaceWith(`<blockquote><p>${$p.html() || text}</p></blockquote>`);
      }
    });
  }

  isItalicOnlyParagraph($p) {
    const meaningfulNodes = $p.contents().toArray().filter(node => {
      if (node.type === 'text') {
        return this.normalizeText(node.data || '').length > 0;
      }

      if (node.type === 'tag') {
        const name = (node.tagName || node.name || '').toLowerCase();
        return name !== 'br' && this.normalizeText(this.getNodeText(node)).length > 0;
      }

      return false;
    });

    return meaningfulNodes.length > 0 && meaningfulNodes.every(node => this.isItalicNode($p, node));
  }

  isItalicNode($p, node) {
    if (node.type !== 'tag') {
      return false;
    }

    const name = (node.tagName || node.name || '').toLowerCase();

    if (name === 'em' || name === 'i') {
      return true;
    }

    if (!['span', 'strong', 'b'].includes(name)) {
      return false;
    }

    const children = (node.children || []).filter(child => {
      if (child.type === 'text') {
        return this.normalizeText(child.data || '').length > 0;
      }

      if (child.type === 'tag') {
        const childName = (child.tagName || child.name || '').toLowerCase();
        return childName !== 'br' && this.normalizeText(this.getNodeText(child)).length > 0;
      }

      return false;
    });

    return children.length > 0 && children.every(child => this.isItalicNode($p, child));
  }

  getNodeText(node) {
    if (!node) {
      return '';
    }

    if (node.type === 'text') {
      return node.data || '';
    }

    return (node.children || []).map(child => this.getNodeText(child)).join('');
  }

  removeLeadingEmptyBlocks($) {
    let changed = true;
    while (changed) {
      changed = false;
      const $first = ($('body').children().first().length ? $('body').children().first() : $.root().children().first());
      if ($first.length && this.normalizeText($first.text()) === '' && $first.find('img').length === 0) {
        $first.remove();
        changed = true;
      }
    }
  }

  htmlToMarkdown(html) {
    let markdown = html;

    markdown = markdown.replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*\/?>/gi, (match, src, alt) => `![${alt}](${src})`);
    markdown = markdown.replace(/<img[^>]*src="([^"]*)"[^>]*\/?>/gi, '![]($1)');

    markdown = markdown.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '# $1\n\n');
    markdown = markdown.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '## $1\n\n');
    markdown = markdown.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '### $1\n\n');
    markdown = markdown.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '#### $1\n\n');

    markdown = markdown.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (match, content) => {
      const quoteText = this.decodeHtml(this.stripHtml(
        content
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<\/p>\s*<p[^>]*>/gi, '\n')
          .replace(/<\/?p[^>]*>/gi, '')
      )).trim();

      if (!quoteText) {
        return '';
      }

      return quoteText.split(/\n+/).map(line => `> ${line.trim()}`).join('\n') + '\n\n';
    });

    markdown = markdown.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n\n');
    markdown = markdown.replace(/<br\s*\/?>/gi, '\n');

    markdown = markdown.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**');
    markdown = markdown.replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**');
    markdown = markdown.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '*$1*');
    markdown = markdown.replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '*$1*');

    markdown = markdown.replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)');

    markdown = markdown.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, '\n```\n$1\n```\n');
    markdown = markdown.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`');

    markdown = markdown.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (match, content) => {
      return content.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n');
    });
    markdown = markdown.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (match, content) => {
      let index = 1;
      return content.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, item) => `${index++}. ${item}\n`);
    });

    markdown = markdown.replace(/<hr\s*\/?>/gi, '\n---\n\n');
    markdown = this.stripHtml(markdown);
    markdown = this.decodeHtml(markdown);
    markdown = markdown.replace(/[ \t]+\n/g, '\n');
    markdown = markdown.replace(/\n{3,}/g, '\n\n');

    return markdown.trim();
  }

  generateFrontmatter(metadata) {
    const yaml = [];
    yaml.push('---');
    yaml.push(`title: ${this.toYamlString(metadata.title)}`);
    yaml.push(`date: ${metadata.date}`);
    yaml.push(`author: ${this.toYamlString(metadata.author)}`);

    if (metadata.header_image) {
      yaml.push(`header_image: ${this.toYamlString(metadata.header_image)}`);
    }

    yaml.push('categories:');
    metadata.categories.forEach(cat => yaml.push(`  - ${this.toYamlString(cat)}`));
    yaml.push('tags:');
    metadata.tags.forEach(tag => yaml.push(`  - ${this.toYamlString(tag)}`));

    if (metadata.description) {
      yaml.push(`description: ${this.toYamlString(metadata.description)}`);
    }

    yaml.push('---');
    return yaml.join('\n');
  }

  toYamlString(value) {
    return JSON.stringify(String(value || ''));
  }

  generateDescription(markdown) {
    const plainText = markdown
      .replace(/^#+\s+/gm, '')
      .replace(/^>\s+/gm, '')
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/`/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (plainText.length <= 180) {
      return plainText;
    }

    return plainText.substring(0, 180).trim() + '...';
  }

  cleanTitle(value) {
    return this.normalizeText(value)
      .replace(/^#+\s*/, '')
      .trim();
  }

  normalizeText(value) {
    return this.decodeHtml(String(value || ''))
      .replace(/\u00a0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  stripHtml(value) {
    return String(value || '').replace(/<[^>]+>/g, '');
  }

  decodeHtml(value) {
    return String(value || '')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ');
  }
}

module.exports = WordToMarkdownConverter;
