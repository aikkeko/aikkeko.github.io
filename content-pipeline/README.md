# Automated Content Pipeline

自动化内容管道系统，用于处理 Word 文档和 Markdown 文件，自动上传图片到 Cloudflare R2，并转换为带有 Frontmatter 的 Markdown 格式。

## 功能特性

- 📄 **文档监听**: 自动监视 `example` 文件夹下的新文档
- 🖼️ **图片处理**: 提取文档中的图片并上传到 Cloudflare R2
- 📝 **格式转换**: Word 文档转 Markdown，保留格式和样式
- ⚙️ **持久元数据**: 用一个 YAML 文件维护全部文章的标题、简介、作者、分类和标签
- 📤 **自动发布**: 将处理后的文章保存到 `content` 文件夹

## 安装依赖

```bash
cd scripts/content-pipeline
npm install mammoth @aws-sdk/client-s3 chokidar cheerio
```

或在项目根目录：

```bash
npm install mammoth @aws-sdk/client-s3 chokidar cheerio
```

## 配置 R2

1. 复制环境变量模板：
```bash
cp scripts/content-pipeline/.env.example .env
```

2. 编辑 `.env` 文件，填写你的 Cloudflare R2 凭证：

```env
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET_NAME=blog-images
R2_PUBLIC_URL=https://cdn.yoursite.com
```

### 获取 R2 凭证

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 进入 R2 管理页面
3. 点击 "Manage R2 API Tokens"
4. 创建新的 API Token，选择 "Object Read & Write" 权限
5. 保存 Access Key ID 和 Secret Access Key

## 使用方法

### 文章元数据配置

统一编辑 `source/_data/archive.yml`。这个文件集中管理文章、首页置顶和声像档案。
文章通过源文档文件名关联，键名必须等于
`example` 中的文件名（不含 `.docx` / `.md` 扩展名）：

```yaml
defaults:
  author: AikeKo

homepage:
  # 填写下方 articles 中的键；留空时默认使用最新文章
  featured_article: 20260128_你可以回到Vorkuta，但那已经没有人了

articles:
  20260128_你可以回到Vorkuta，但那已经没有人了:
    title: 你可以回到Vorkuta-5，但那里已经没有人了
    author: AikeKo
    description: "" # 留空时自动显示正文开头；填写后使用这里的内容
    categories: [游戏]
    tags: [游戏, vorkuta, z.a.t.o]

media:
  featured: chuncai-radio-s03e08
  items:
    - id: chuncai-radio-s03e08
      type: radio
      title: 蠢材呓事 · S3E08
      url: ""
```

`homepage.featured_article` 控制首页第一张 `FEATURED DISPATCH` 卡片。它与文章一样使用源文档文件名（不含扩展名）关联；留空、键名错误或文章尚未生成时，首页自动回退到最新文章。

可配置字段：

- `title`：博客显示标题，优先级高于 DOCX 第一行
- `description`：首页文章简介；默认为空并自动显示正文开头，填写后覆盖自动简介
- `author`：作者
- `categories`：分类列表，也兼容单个 `category`
- `tags`：标签列表
- `date`：可选，覆盖文件名中的日期
- `header_image`：可选，覆盖 DOCX 第一张封面图
- `frontmatter`：可选，放置任意额外 Hexo Frontmatter

未填写的字段仍由 DOCX 和转换程序自动生成。运行监听模式时，保存该配置文件会自动重新生成全部文章。
`media.items` 用于维护声像档案，`type` 支持 `radio` 与 `video`。

为新增文档补齐配置条目：

```bash
npm run pipeline:metadata
```

该命令只填补缺失字段，不覆盖已经手工修改的值。

### 1. 启动监听模式（推荐）

自动监视 `example` 文件夹，有新文件时自动处理：

```bash
npm run pipeline
```

### 2. 一次性处理现有文件

处理 `example` 文件夹中所有现有文件：

```bash
npm run pipeline:once
```

### 3. 查看帮助

```bash
node scripts/content-pipeline/cli.js --help
```

## 工作流程

1. **文档放入 example 文件夹**
   - 支持 `.docx` 和 `.md` 格式

2. **自动检测和处理**
   - 提取文档中的图片
   - 上传图片到 R2 存储桶
   - 转换文档为 Markdown 格式

3. **生成 Frontmatter**
   ```yaml
   ---
   title: 文档标题
   date: 2024-01-01T00:00:00.000Z
   author: AikeKo
   categories:
     - 游戏
   tags:
     - galgame
     - review
   description: "" # 默认由正文开头自动生成，也可以手动填写覆盖
   ---
   ```

4. **保存到 content 文件夹**
   - 文件名格式: `YYYY-MM-DD-title.md`

## 图片处理

- 自动提取 Word 文档中的嵌入图片
- 提取 Markdown 文件中的本地图片路径
- 上传到 R2 后自动替换为公开 URL
- 支持格式: JPG, PNG, GIF, WebP, SVG

## 智能分类

系统根据内容自动推断分类：

- **游戏**: 游戏、galgame、RPG、评测、攻略
- **动画**: 动画、anime、番剧、宫崎骏
- **文学**: 小说、文学、书评、读后感
- **技术**: 代码、编程、JavaScript、Python
- **生活**: 日常、随笔、旅行、美食

## 目录结构

```
Blog/
├── example/                    # 放置原始文档
│   ├── article.docx
│   └── post.md
├── content/                    # 处理后的文章
│   └── 2024-01-01-article.md
├── scripts/
│   └── content-pipeline/
│       ├── cli.js             # CLI 入口
│       ├── index.js           # 主控制器
│       ├── lib/
│       │   ├── document-watcher.js    # 文件监听
│       │   ├── word-converter.js      # Word 转换
│       │   ├── markdown-processor.js  # Markdown 处理
│       │   └── r2-uploader.js         # R2 上传
│       └── config/
│           └── r2-config.js   # R2 配置
└── .env                       # 环境变量
```

## 注意事项

1. **文件命名**: 建议使用英文或拼音文件名，避免特殊字符
2. **图片大小**: 单张图片建议不超过 5MB
3. **文档大小**: Word 文档建议不超过 20MB
4. **网络要求**: 需要稳定的网络连接以访问 R2

## 故障排除

### R2 上传失败

检查环境变量是否正确设置：
```bash
echo $R2_ACCOUNT_ID
echo $R2_ACCESS_KEY_ID
```

### 文档转换失败

确保文档格式正确，尝试用 Microsoft Word 重新保存 `.docx` 文件

### 监听不生效

检查 `example` 文件夹是否存在：
```bash
ls -la example/
```

## 扩展开发

可以在 `lib/` 目录下添加新的处理器：

```javascript
// lib/custom-processor.js
class CustomProcessor {
  async process(filePath) {
    // 自定义处理逻辑
  }
}

module.exports = CustomProcessor;
```

## 许可证

MIT
