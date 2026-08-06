# Aike · Echo 内容管理器

运行：

```bash
npm run manage
```

工具只监听 `127.0.0.1:4173`，不会被 Hexo 发布到线上。它负责维护：

- 文章标题、作者、简介、分类与标签
- 首页置顶文章
- 声像节目的标题、简介、日期、封面、链接与标签
- 声像页置顶节目

文章修改会同时写入 `source/_data/archive.yml` 和对应的 `source/_posts/*.md` Frontmatter；DOCX 重新转换时，持久配置仍以 `archive.yml` 为准。
