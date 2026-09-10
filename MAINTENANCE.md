# 本地维护与发布

## 常用命令

| 命令 | 用途 |
| --- | --- |
| `npm run manage` | 打开文章与声像管理器（127.0.0.1:4173） |
| `npm run build` | 同步版本与内容 → 清理构建 → 校验生成结果 |
| `npm test` | 内容保存、冲突、回滚、长文与缓存测试 |
| `npm run visual:check` | Chrome/Edge 的真实视口布局与交互检查 |
| `npm run deploy:check` | 执行发布前构建校验，但不推送 |
| `npm run deploy` | 构建校验后发布静态网站，并检查 Pages 工作流结果 |
| `npm run server -- -p 4002` | 本地 Hexo 预览 |

运行清理构建或部署前，请关闭正在运行的 Hexo 预览服务，避免两个进程同时操作
`public/` 和 Hexo 数据库。构建完成后再启动预览。不要直接运行旧的 `hexo deploy`
来发布未经校验的 `public/`。

## 版本与部署

版本的唯一编辑入口是 `site-version.json`：`version` 使用 `YYYY.MM.DD-NN`；
影响离线缓存的更新同时增加 `cache`。构建会同步 CSS、主题资源版本与 Service Worker。
版本仍不显示在左上角；线上 `/build-info.json` 可用于排查当前版本和构建来源。

部署从远端当前发布分支创建临时检出，提交新生成文件，使用普通快进推送，**不会 force push**。
如果有人同时发布导致非快进，会安全失败；如果推送成功但 Pages 失败/超时，也会明确报错。
`CNAME` 在本地未生成时会保留远端现有值。

`npm run deploy` 只发布 `_config.yml` 中的静态分支（当前为 `main`），不会替你提交源码。
源码仍需要审核后提交并推送到源码分支（当前为 `master`）。备份、测试截图与本地管理器
不会进入生成网站；管理器界面源文件会随源码仓库保存。

## 内容同步与恢复

管理器、构建元数据同步、文档导入和声像封面同步共用 `.content-backups/.lock`。
导入在转换前记录源文档、目标文章和配置，提交时拒绝覆盖期间发生的修改；同一导入进程
中的文档按顺序处理。现有文章的文件名、日期、固定 ID 和 permalink 保持不变。
删除源文档触发的文章删除也会备份。停止监听时等待已排队的文章处理完成。

`pipeline:once` 会处理全部合规文件并汇总失败，存在失败时以非零退出码结束。
图片读取或上传失败时保留原文章。修正文件或网络后重新导入即可。
声像封面同步在联网工作完成后按节目 ID 合并当前配置；如果封面已改动或节目已删除，
本次配置写入会被拒绝，期间保存的其他字段会保留。远端已上传图片可以在重试时复用。

备份目录中的 `manifest.json` 列出了原始文件路径及对应 `.bak` 文件。
恢复前先停止写入进程，再按清单核对和复制所需文件。不要直接删除正在使用的 `.lock`；
若进程异常退出留下锁，应先确认相关进程已结束。备份只保存在本机，不随网站发布。

## 检查范围与边界

视口检查覆盖 320、375、390、430、768、1440px；包含首页、首页下方文章、第二页、
关于、标签、归档、声像和长文。截图与 JSON 结果保存在 `artifacts/visual-regression/`。
可用 `TEST_WIDTHS` 选择宽度，用 `CHROME_PATH` 指定 Chrome/Edge。

这不是实际 iOS Safari 或真机跑分。R2 封面、Bilibili 播放器与 Giscus 的联网表现需要
在可访问这些服务的网络下确认；跨域 iframe 的 load 事件不能证明视频已经成功播放。

长文保留完整 HTML，构建时划分阅读段落，不使用固定高度占位来猜测后续内容，
避免目录锚点和阅读进度因占位高度变化而跳动。图片使用浏览器原生懒加载。

Service Worker 只缓存本站的页面、静态文件与图片；页面网络等待上限 4 秒，缓存上限
分别为 30 页、80 个静态资源、60 张图片。评论、播放器、API、跨域请求不进入这些缓存。
# Mobile acceptance boundary

`TEST_HEIGHT=440` with `TEST_WIDTHS=390,768` exercises compact viewports in the visual test runner; this approximates limited screen space, not an actual software keyboard or Safari toolbar.
Before a production release, confirm on a physical iOS/Android phone: browser toolbar expansion, portrait/landscape rotation, navigation tapping, search focus without unwanted zoom, and Giscus login/comment input with the keyboard open. Third-party iframe input cannot be validated by same-origin DOM checks. Desktop emulation must not be reported as physical-device verification.
