/**
 * Long Text Optimizer - 长文本渐进渲染与阅读位置增强
 * 使用原生 content-visibility 保留完整 DOM，避免分片回填造成布局跳动。
 */

(function() {
  'use strict';

  const CONFIG = {
    LONG_TEXT_THRESHOLD: 3000,
    CHUNK_SIZE: 2200
  };

  class LongTextManager {
    constructor() {
      this.postBody = document.querySelector('.post-body');
      if (!this.postBody) return;

      const textLength = this.postBody.innerText.trim().length;
      if (textLength > CONFIG.LONG_TEXT_THRESHOLD) {
        this.postBody.classList.add('long-text-optimized');
        this.createRenderChunks();
      }

      if (!this.isThemeBookmarkEnabled()) {
        this.enhanceBookmark();
      }
    }

    isThemeBookmarkEnabled() {
      return Boolean(window.CONFIG && window.CONFIG.bookmark && window.CONFIG.bookmark.enable);
    }

    createRenderChunks() {
      const children = Array.from(this.postBody.children);
      if (children.length < 2) return;

      const fragment = document.createDocumentFragment();
      let chunk = this.createChunk(0);
      let chunkSize = 0;
      let chunkIndex = 0;

      children.forEach((child) => {
        const childSize = (child.innerText || child.textContent || '').length;
        const startsChapter = child.tagName === 'H2' && chunk.childElementCount > 0;
        const reachedLimit = chunkSize >= CONFIG.CHUNK_SIZE && chunk.childElementCount > 0;

        if (startsChapter || reachedLimit) {
          fragment.appendChild(chunk);
          chunkIndex += 1;
          chunk = this.createChunk(chunkIndex);
          chunkSize = 0;
        }

        chunk.appendChild(child);
        chunkSize += childSize;
      });

      if (chunk.childElementCount > 0) {
        fragment.appendChild(chunk);
      }

      this.postBody.appendChild(fragment);
      this.postBody.dataset.renderChunks = String(chunkIndex + 1);
    }

    createChunk(index) {
      const section = document.createElement('section');
      section.className = 'long-text-chunk';
      section.id = `reading-section-${index + 1}`;
      section.dataset.chunkIndex = String(index);
      section.setAttribute('aria-label', `阅读分段 ${index + 1}`);
      return section;
    }

    enhanceBookmark() {
      const storageKey = `hexo-bookmark-data:${window.location.pathname}`;
      let saveTimer = null;

      const savePosition = () => {
        const scrollTop = window.scrollY || document.documentElement.scrollTop;
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        const headings = Array.from(document.querySelectorAll('.post-body h2[id]'));
        let currentSection = '';

        headings.forEach((heading) => {
          // 避免 Hexo 5 静态资源处理链误解析小于等于运算符。
          if (heading.getBoundingClientRect().top < 121) {
            currentSection = heading.id;
          }
        });

        localStorage.setItem(storageKey, JSON.stringify({
          scrollTop,
          scrollPercent: docHeight > 0 ? scrollTop / docHeight : 0,
          section: currentSection,
          timestamp: Date.now()
        }));
      };

      window.addEventListener('scroll', () => {
        window.clearTimeout(saveTimer);
        saveTimer = window.setTimeout(savePosition, 500);
      }, { passive: true });

      window.addEventListener('load', () => {
        try {
          const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
          if (!saved) return;

          const section = saved.section && document.getElementById(saved.section);
          window.setTimeout(() => {
            if (section) {
              section.scrollIntoView({ block: 'start' });
            } else if (Number.isFinite(saved.scrollTop)) {
              window.scrollTo(0, saved.scrollTop);
            }
          }, 150);
        } catch (error) {
          console.warn('[LongTextManager] 阅读位置恢复失败:', error);
        }
      }, { once: true });
    }
  }

  const init = () => new LongTextManager();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
