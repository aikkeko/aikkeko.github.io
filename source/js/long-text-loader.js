/**
 * Long Text Chunk Loader - 长文本分片加载优化
 * 针对 30 万字小说级内容的性能优化方案
 * 
 * 核心功能：
 * 1. 检测长文本（>3000字）
 * 2. Intersection Observer 按需渲染
 * 3. 阅读位置持久化增强
 * 4. 章节锚点预加载
 */

(function() {
  'use strict';
  
  // 配置
  const CONFIG = {
    LONG_TEXT_THRESHOLD: 3000,    // 长文本阈值：3000字
    CHUNK_SIZE: 2000,             // 每个分片约 2000 字
    PRELOAD_OFFSET: 2,            // 预加载前后 2 个分片
    ENABLE_CHUNKING: true         // 是否启用分片
  };

  // 长文本管理器
  class LongTextManager {
    constructor() {
      this.postBody = document.querySelector('.post-body');
      this.chunks = [];
      this.currentChunk = 0;
      this.observer = null;
      this.isLongText = false;
      this.originalContent = null;
      
      this.init();
    }

    init() {
      if (!this.postBody) return;
      
      // 检测是否为长文本
      const textLength = this.postBody.innerText.length;
      this.isLongText = textLength > CONFIG.LONG_TEXT_THRESHOLD;
      
      if (this.isLongText && CONFIG.ENABLE_CHUNKING) {
        this.setupChunking();
      }
      
      // 增强阅读位置持久化
      this.enhanceBookmark();
    }

    setupChunking() {
      // 保存原始内容
      this.originalContent = this.postBody.innerHTML;
      
      // 按章节分割内容
      const sections = this.splitBySections();
      
      if (sections.length <= 3) {
        // 章节数较少，不需要分片
        return;
      }
      
      // 创建分片容器
      this.chunks = this.createChunks(sections);
      
      // 渲染初始分片
      this.renderInitialChunks();
      
      // 设置 Intersection Observer
      this.setupIntersectionObserver();
      
      // 添加分片加载提示
      this.addLoadingIndicator();
      
      console.log(`[LongTextManager] 长文本检测：${this.postBody.innerText.length} 字，已分片为 ${this.chunks.length} 个区块`);
    }

    splitBySections() {
      // 按 h2 标签分割章节
      const sections = [];
      let currentHTML = '';
      let lastElement = null;
      
      const children = Array.from(this.postBody.children);
      
      children.forEach((child, index) => {
        if (child.tagName === 'H2' && currentHTML && index > 0) {
          sections.push({
            html: currentHTML,
            id: lastElement ? lastElement.id : `section-${sections.length}`,
            title: lastElement ? lastElement.innerText : ''
          });
          currentHTML = '';
        }
        
        currentHTML += child.outerHTML;
        
        if (child.tagName === 'H2') {
          lastElement = child;
        }
      });
      
      // 添加最后一个章节
      if (currentHTML) {
        sections.push({
          html: currentHTML,
          id: lastElement ? lastElement.id : `section-${sections.length}`,
          title: lastElement ? lastElement.innerText : ''
        });
      }
      
      return sections;
    }

    createChunks(sections) {
      const chunks = [];
      let currentChunk = [];
      let currentSize = 0;
      
      sections.forEach((section, index) => {
        const sectionSize = section.html.length;
        
        if (currentSize + sectionSize > CONFIG.CHUNK_SIZE && currentChunk.length > 0) {
          chunks.push({
            sections: [...currentChunk],
            index: chunks.length,
            loaded: chunks.length === 0  // 第一个分片默认加载
          });
          currentChunk = [section];
          currentSize = sectionSize;
        } else {
          currentChunk.push(section);
          currentSize += sectionSize;
        }
      });
      
      // 添加最后一个分片
      if (currentChunk.length > 0) {
        chunks.push({
          sections: [...currentChunk],
          index: chunks.length,
          loaded: chunks.length === 0
        });
      }
      
      return chunks;
    }

    renderInitialChunks() {
      // 清空内容
      this.postBody.innerHTML = '';
      
      // 创建分片容器
      this.chunks.forEach((chunk, index) => {
        const chunkDiv = document.createElement('div');
        chunkDiv.className = `text-chunk chunk-${index}`;
        chunkDiv.dataset.chunkIndex = index;
        
        if (chunk.loaded) {
          chunkDiv.innerHTML = chunk.sections.map(s => s.html).join('');
          chunkDiv.classList.add('loaded');
        } else {
          chunkDiv.innerHTML = `
            <div class="chunk-placeholder" style="
              min-height: 400px;
              display: flex;
              align-items: center;
              justify-content: center;
              color: #999;
              font-size: 14px;
              background: linear-gradient(to bottom, #fafafa, #f5f5f5);
              border-radius: 4px;
              margin: 20px 0;
            ">
              <span>章节加载中...</span>
            </div>
          `;
        }
        
        this.postBody.appendChild(chunkDiv);
        chunk.element = chunkDiv;
      });
    }

    setupIntersectionObserver() {
      const options = {
        root: null,
        rootMargin: '1000px 0px',  // 提前 1000px 开始加载
        threshold: 0.1
      };

      this.observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const chunkIndex = parseInt(entry.target.dataset.chunkIndex);
            this.loadChunk(chunkIndex);
            
            // 预加载相邻分片
            this.preloadAdjacentChunks(chunkIndex);
          }
        });
      }, options);

      // 观察所有未加载的分片
      this.chunks.forEach(chunk => {
        if (!chunk.loaded && chunk.element) {
          this.observer.observe(chunk.element);
        }
      });
    }

    loadChunk(index) {
      const chunk = this.chunks[index];
      if (!chunk || chunk.loaded) return;
      
      // 使用 requestAnimationFrame 避免阻塞
      requestAnimationFrame(() => {
        const content = chunk.sections.map(s => s.html).join('');
        chunk.element.innerHTML = content;
        chunk.element.classList.add('loaded');
        chunk.element.classList.remove('loading');
        chunk.loaded = true;
        
        // 重新初始化 NexT 组件
        if (typeof NexT !== 'undefined' && NexT.boot && NexT.boot.refresh) {
          NexT.boot.refresh();
        }
        
        console.log(`[LongTextManager] 分片 ${index + 1}/${this.chunks.length} 已加载`);
      });
    }

    preloadAdjacentChunks(currentIndex) {
      for (let i = 1; i <= CONFIG.PRELOAD_OFFSET; i++) {
        if (currentIndex + i < this.chunks.length) {
          setTimeout(() => {
            this.loadChunk(currentIndex + i);
          }, i * 100);
        }
        if (currentIndex - i >= 0) {
          setTimeout(() => {
            this.loadChunk(currentIndex - i);
          }, i * 100);
        }
      }
    }

    addLoadingIndicator() {
      // 添加分片加载进度指示器
      const progressDiv = document.createElement('div');
      progressDiv.className = 'chunk-progress';
      progressDiv.innerHTML = `
        <div style="
          position: fixed;
          bottom: 80px;
          right: 20px;
          background: rgba(255,255,255,0.95);
          padding: 10px 15px;
          border-radius: 20px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          font-size: 12px;
          color: #666;
          z-index: 1000;
          opacity: 0;
          transition: opacity 0.3s;
        ">
          <span class="loaded-chunks">1</span> / <span class="total-chunks">${this.chunks.length}</span> 章节已加载
        </div>
      `;
      document.body.appendChild(progressDiv);
      
      // 显示进度
      setTimeout(() => {
        progressDiv.firstElementChild.style.opacity = '1';
      }, 1000);
      
      // 更新进度
      this.updateProgress = () => {
        const loaded = this.chunks.filter(c => c.loaded).length;
        progressDiv.querySelector('.loaded-chunks').textContent = loaded;
        
        if (loaded === this.chunks.length) {
          setTimeout(() => {
            progressDiv.firstElementChild.style.opacity = '0';
          }, 2000);
        }
      };
    }

    enhanceBookmark() {
      // 增强书签功能：更精确的位置保存
      const savePosition = () => {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        const scrollPercent = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
        
        // 获取当前章节
        let currentSection = '';
        const headings = document.querySelectorAll('.post-body h2');
        headings.forEach(heading => {
          const rect = heading.getBoundingClientRect();
          if (rect.top <= 100) {
            currentSection = heading.id || '';
          }
        });
        
        const bookmarkData = {
          url: window.location.pathname,
          scrollTop: scrollTop,
          scrollPercent: scrollPercent.toFixed(2),
          section: currentSection,
          timestamp: Date.now()
        };
        
        localStorage.setItem('hexo-bookmark-data', JSON.stringify(bookmarkData));
      };

      // 使用防抖优化保存频率
      let saveTimer;
      window.addEventListener('scroll', () => {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(savePosition, 500);
      }, { passive: true });

      // 页面加载时恢复位置
      window.addEventListener('load', () => {
        try {
          const data = localStorage.getItem('hexo-bookmark-data');
          if (data) {
            const bookmark = JSON.parse(data);
            if (bookmark.url === window.location.pathname && bookmark.section) {
              // 优先跳转到章节
              const section = document.getElementById(bookmark.section);
              if (section) {
                setTimeout(() => {
                  section.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 500);
              }
            }
          }
        } catch (e) {
          console.error('[LongTextManager] 恢复阅读位置失败:', e);
        }
      });
    }
  }

  // 初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new LongTextManager());
  } else {
    new LongTextManager();
  }
})();
