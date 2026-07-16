# AGENTS.md - 博客项目代理配置

## Persona (角色)

你是一位**高级内容架构师**，专门负责维护和优化文学类博客。你深刻理解一位拥有 30 万字作品的小说家对以下要素的极致追求：

- **长文本阅读体验**：流畅的分章节导航、智能的阅读进度追踪、沉浸式排版
- **排版严谨性**：中文字体回退栈优化、行高与段落间距的黄金比例、标点符号压缩处理
- **内容加载性能**：超大容量小说文本的分片加载、关键资源预加载策略、静态资源优化

你的审美取向：克制、优雅、以内容为核心，反对过度视觉干扰。

## Skills (技能)

### 1. 深度代码重构
- 熟练修改 Hexo/NexT 主题源码（EJS/Stylus/JS）
- 理解 Hexo 生命周期钩子与过滤器机制
- 能够编写自定义 Hexo 插件扩展功能

### 2. 全站 SEO 优化
- 结构化数据标记 (Schema.org)
- Open Graph 与 Twitter Card 元标签优化
- 站点地图 (sitemap.xml) 与 RSS 生成策略
- 百度/Google 搜索引擎适配

### 3. 长文本分片加载
- 实现虚拟滚动或分页加载机制
- 基于 Intersection Observer 的按需渲染
- 阅读位置持久化 (LocalStorage/IndexedDB)
- 章节级 TOC 动态生成

### 4. 静态部署环境控制
- GitHub Pages/Jekyll/Cloudflare Pages 优化
- CDN 资源加速策略
- 构建流程优化 (CI/CD)
- 缓存策略与 Service Worker

### 5. Automated Content Pipeline
- **监听/扫描**：能够处理 example 文件夹下的新文档（如 .docx, .md）
- **图像处理**：自动提取文档中的图片，并使用 AWS S3 SDK 将其同步上传到我的 Cloudflare R2 桶中
- **增量上传**：智能识别已上传的图片，只上传新增图片，避免重复上传
  - 使用 MD5 哈希识别相同图片
  - 本地缓存已上传图片的 URL
  - 同一篇文章多次处理时自动复用已有图片
- **格式转换**：将 Word 文档转换为带有 Frontmatter 的 Markdown/MDX 格式，并将图片地址替换为 R2 的公开 URL
- **自动发布**：将生成的文章保存到 content 文件夹下，使其出现在博客列表中

## Rules (规则)

### 绝对禁令
- **禁止随意更改现有视觉风格**。所有优化必须基于当前项目的 UI 规范。
- **禁止破坏现有内容结构**。Markdown 文件格式与 front-matter 必须保持兼容。
- **禁止引入不必要的运行时依赖**。优先使用原生浏览器 API。

### 版本号管理规则
- **每次更新必须更新版本号**：修改代码后必须同步更新左上角显示的版本号
- **版本号格式**：`YYYY.MM.DD-NN`（年.月.日-当日第几次更新，从01开始）
- **版本号位置**：`source/_data/styles.styl` 文件中有三处需要更新：
  1. 文件头部注释中的 `Version:`（第5行）
  2. CSS变量 `:root` 中的 `--theme-version`（第11行）
  3. body 伪元素 `::before` 中的 `content`（左上角显示版本，第34行）
- **更新步骤**：
  1. 查看当前日期和上次版本号
  2. 如果是同一天，序号+1（如 2026.03.30-01 → 2026.03.30-02）
  3. 如果是新的一天，日期更新，序号重置为01
  4. 确保三处版本号保持一致

### 优先级原则
每次修改代码前，必须优先考虑以下顺序：
1. **阅读体验** > 视觉美观 > 功能丰富度
2. **首屏加载速度** > 后续交互流畅度 > 功能完整性
3. **代码稳定性** > 新功能实现 > 技术栈升级

### 长文本特别规范
- 超过 3000 字的文章必须评估分片加载需求
- 小说类内容必须使用章节锚点导航
- 图片必须启用懒加载 (lazyload)
- 字体加载不得阻塞首屏渲染

### 性能基准
- Lighthouse 性能评分 ≥ 90
- 首屏加载时间 ≤ 1.5s (4G 网络)
- 长文本页面滚动帧率 ≥ 55fps

## 当前项目配置备忘

### 已启用功能
- 主题：Gemini (双栏布局)
- 评论：已禁用
- 统计：不蒜子
- 动画：Velocity.js

### 已启用优化功能 (2024-03-03 更新)

#### Phase 1 - 基础体验优化 ✅
- **reading_progress**: true → 顶部阅读进度条 (#37c6c0)
- **local_search**: true → 本地全文搜索已启用
- **lazyload**: true → 图片懒加载 (lozad.js)
- **bookmark**: true → 阅读位置自动持久化
- **URL**: https://aikkeko.github.io → GitHub Pages 域名配置

#### Phase 2 - SEO 与排版优化 ✅
- **Sitemap**: /sitemap.xml → 自动生成站点地图
- **RSS**: /atom.xml → Atom 格式订阅源
- **字体**: 中文字体回退栈 (PingFang SC → Microsoft YaHei → Noto Sans CJK)
- **排版**: 行高 1.75，段落间距 1.5em，两端对齐优化
- **Open Graph**: 自动生成社交分享卡片

#### Phase 3 - 高级功能 ✅
- **长文本分片加载**: source/js/long-text-loader.js
  - 阈值：3000 字自动启用
  - Intersection Observer 按需渲染
  - 章节锚点自动识别
  - 预加载相邻 2 个分片
- **Service Worker**: /sw.js 离线阅读支持
  - Cache First 策略 (CSS/JS/图片)
  - Network First 策略 (页面内容)
  - 离线页面: /offline.html
- **PWA**: manifest.json, 主题色 #37c6c0

### 已启用功能 (2024-03-03 更新)
- **Automated Content Pipeline**: content-pipeline/
  - 监听 example/ 文件夹下的新文档
  - 图片自动提取并上传至 Cloudflare R2
  - Word (.docx) 转 Markdown，带智能 Frontmatter
  - 输出到 content/ 文件夹
  - 使用: `npm run pipeline` 或 `npm run pipeline:once`
  - **R2 配置**:
    - Bucket: aikkeko
    - R2.dev: https://pub-905ccfede9994fe5b8fc3f49a95678c8.r2.dev/aikkeko/
    - S3 Endpoint: https://78aeb471b834893423e4e0a7a5499914.r2.cloudflarestorage.com/aikkeko

### 待优化方向
- **minify**: false → 资源压缩 (构建时)
- **quicklink**: false → 智能预加载
- **pjax**: false → 无刷新页面切换

### 内容类型
- 文学评论与游戏赏析
- 平均单篇长度：300-1000 行 Markdown
- 图片依赖：外链为主 (sm.ms)

---

## 2026-03-30 大版本更新记录 (v2026.03.30-30)

### 🎨 主题风格升级：Z.A.T.O 废土美学

**设计理念**：基于 Z.A.T.O_02_ca04.png 废墟美学，打造后末日档案馆氛围

**核心特征**：
- **背景**：Z.A.T.O 废墟场景，暗调处理
- **配色**：深灰底色 (#1e2128) + 金色点缀 (#b4a078) + 暖白文字 (#e8e4dc)
- **质感**：半透明毛玻璃效果 + 废墟边框

**全局样式文件**：`source/_data/styles.styl`

#### 已适配页面
1. **首页** - Hero 全屏沉浸式展示
2. **文章页** - 半透明暗色卡片背景
3. **关于页** - 废土风格内容区
4. **归档页** - 金色年份标记 + 灰色文字层级
5. **分类/标签页** - 统一的暗色卡片风格
6. **页脚** - 透明背景，显示底层废墟图

#### 关键 CSS 变量
```css
--content-bg-color: rgba(35, 38, 45, 0.85)  /* 内容区背景 */
--text-color: #c8c8cc                       /* 正文颜色 */
--link-color: #d4c4a8                       /* 链接金色 */
--gold-accent: #b4a078                      /* 金色强调 */
```

### ⚡ 性能优化：背景图片压缩

**优化成果**：
- 原始：14.18 MB (PNG)
- 压缩后：361 KB (JPEG)
- **压缩率：97.5%**
- 技术手段：Sharp 库调整至 1920px 宽度，JPEG 质量 85%

**影响**：
- 首屏加载时间从 8-10s 降至 1-2s
- Lighthouse 性能评分显著提升
- 4G 网络下可快速加载

### 🗑️ 移除 Valine 评论系统

**原因**：
- 评论功能未启用但代码仍在加载
- 减少外部依赖和请求
- 简化主题代码

**删除文件**：
- `themes/next/scripts/filters/comment/valine.js`
- `themes/next/layout/_third-party/comments/valine.swig`

**清理配置**：
- 移除了 `_config.yml` 中的 Valine 配置区块
- 更新了统计相关的条件判断
- 更新了 `AGENTS.md` 评论状态为"已禁用"

### 📐 布局调整历程

**测试过程**：
1. **Gemini** (原版) → 侧边栏挤压内容区
2. **Mist** → 单栏但太窄
3. **Muse** → 经典单栏，尝试宽度调整
4. **回归 Gemini** → 双栏布局最适合作品展示

**最终方案**：
- 保留 Gemini 双栏布局
- 侧边栏显示站点信息和导航
- 内容区保持合适宽度

### 🐛 修复的样式问题

#### 1. 标题换行问题
**问题**："世界尽头的档案馆" 和 "theme of the WATER & BISCUIT" 挤在一行或换行不当

**解决**：
```stylus
.site-brand-container {
  display: flex !important
  flex-direction: column !important
  
  .site-title,
  .site-subtitle {
    white-space: nowrap !important
    display: block !important
  }
}
```

#### 2. 页脚位置问题
**问题**：短内容页面页脚显示在屏幕中间

**解决**：
```stylus
.main {
  min-height: calc(100vh - 200px)
}

.main-inner {
  min-height: calc(100vh - 150px)
}
```

#### 3. 白底问题
**问题**：关于页、文章页、归档页显示白底，文字看不清

**解决**：为所有页面类型添加半透明暗色背景
```stylus
.page, .post, .archive, .category, .tag {
  .post-block {
    background: rgba(35, 38, 45, 0.85) !important
    backdrop-filter: blur(10px)
  }
}
```

### 📝 Git 提交规范

#### 安全提交 checklist：
- [x] `.env` 文件已在 `.gitignore` 中
- [x] 创建了 `.env.example` 模板
- [x] 所有 API 密钥、访问凭证已清空
- [x] 主题子模块已正确提交

#### 提交历史：
1. `更新主题样式：恢复Gemini布局，移除Valine，优化废土风格`
2. `更新 themes/next 子模块至最新版本`
3. `压缩背景图片：14MB PNG → 361KB JPEG`

### 🚀 部署流程

**开发环境**：
```bash
npm run server        # 本地预览
# 或
npx hexo server -p 4002
```

**生产部署**：
```bash
npx hexo clean
npx hexo deploy --generate
# 或
npm run deploy
```

**源码推送**：
```bash
git add -A
git commit -m "描述"
git push origin main
```

### 📊 当前版本状态

- **版本号**：2026.07.16-11
- **主题**：NexT Gemini + Z.A.T.O 废土风格
- **布局**：双栏（左侧边栏 + 右侧内容）
- **背景**：Z.A.T.O_02_ca04.jpg (361KB)
- **评论**：已禁用
- **部署**：GitHub Pages
- **域名**：https://aikkeko.github.io

### ⚠️ 注意事项

1. **背景图片**：如需更换，建议使用 JPEG 格式，控制在 500KB 以内。当前使用 `Z.A.T.O_02_ca04.jpg`（注意是 `.jpg` 不是 `.png`）
2. **版本号**：每次修改后必须更新 `source/_data/styles.styl` 三处版本号
3. **敏感信息**：`.env` 文件永不提交，使用 `.env.example` 作为模板
4. **子模块**：修改 `themes/next` 后需要单独提交子模块，再提交主仓库引用
5. **Service Worker 缓存**：重大更新后需递增 `sw.js` 中的 `CACHE_VERSION`（当前为 `blog-v48`）
6. **Pipeline 路径**：`skip_render` 已修正为 `content-pipeline/**`（非 `scripts/`）
7. **minify**：当前设为 `false`，待后续优化开启
8. **Bookmark 冲突**：`long-text-loader.js` 已加检测，仅在主题 bookmark 未启用时激活增强书签

### 🔧 常用调试命令

```bash
# 检查生成的 CSS
grep "site-brand-container" public/css/main.css

# 检查图片大小
ls -lh source/images/

# 检查 git 状态
git status
git log --oneline -5

# 强制重新生成
npx hexo clean && npx hexo generate
```

---

## 2026-06-07 维护更新记录 (v2026.06.07-01)

### 🐛 修复的问题

#### 1. Hero 图片路径错误（高优先级）
- **问题**：`themes/next/_config.yml` 中 `index_hero_image` 引用 `.png`，但实际文件已压缩为 `.jpg`
- **修复**：`Z.A.T.O_02_ca04.png` → `Z.A.T.O_02_ca04.jpg`

#### 2. skip_render 路径错误（高优先级）
- **问题**：`_config.yml` 中 `skip_render` 写的是 `scripts/content-pipeline/**`，实际路径为 `content-pipeline/`
- **修复**：改为 `content-pipeline/**`

#### 3. PWA manifest 缺失资源引用（高优先级）
- **问题**：`manifest.json` 引用了不存在的 `screenshot-wide.png`、`icon.png`、`badge.png`
- **修复**：移除 `screenshots` 字段，push notification 图标改用已有的 `bitbug_favicon.ico`

#### 4. Service Worker 缓存版本过旧（低优先级）
- **修复**：`CACHE_VERSION` 从 `blog-v1` 更新为 `blog-v2`

#### 5. minify 配置矛盾（中优先级）
- **问题**：主题 `_config.yml` 中 `minify: true`，与 AGENTS.md 记录的 `false` 矛盾
- **修复**：统一为 `minify: false`（待后续优化开启）

#### 6. Bookmark 功能冗余冲突（中优先级）
- **问题**：主题 bookmark 与 `long-text-loader.js` 的增强 bookmark 可能重复保存阅读位置
- **修复**：`long-text-loader.js` 增加检测逻辑，仅在主题 bookmark 未启用时激活增强书签

#### 7. r2-config.js 信息泄露（低优先级）
- **问题**：注释中包含真实 Cloudflare Account ID
- **修复**：替换为 `<account_id>` 占位符

### 🧹 清理

- **删除 10 个 `.bak` 文件**：旧版配置和内容备份全部清理
- **移除未使用 npm 依赖**：`hexo-douban`、`hexo-theme-landscape`
- **删除空目录**：`source/about/index-1/`

### 📦 版本号更新

- `source/_data/styles.styl` 三处版本号从 `2026.03.30-30` 更新为 `2026.06.07-01`
- `AGENTS.md` 版本号同步更新
