#!/usr/bin/env node

/**
 * Content Pipeline CLI
 * 自动化内容管道命令行工具
 * 
 * 使用方法:
 *   node scripts/content-pipeline/cli.js          # 启动监听模式
 *   node scripts/content-pipeline/cli.js --once   # 一次性处理现有文件
 *   node scripts/content-pipeline/cli.js --help   # 显示帮助
 */

const ContentPipeline = require('./index');

const args = process.argv.slice(2);
const isOnce = args.includes('--once') || args.includes('-o');
const isHelp = args.includes('--help') || args.includes('-h');

if (isHelp) {
  console.log(`
🚀 Content Pipeline - 自动化内容处理工具

使用方法:
  node scripts/content-pipeline/cli.js [选项]

选项:
  --once, -o     一次性处理现有文件（不启动监听）
  --help, -h     显示帮助信息

环境变量:
  R2_ACCOUNT_ID         Cloudflare Account ID
  R2_ACCESS_KEY_ID      R2 Access Key ID
  R2_SECRET_ACCESS_KEY  R2 Secret Access Key
  R2_BUCKET_NAME        R2 Bucket 名称 (默认: blog-images)
  R2_PUBLIC_URL         R2 公开访问 URL
  R2_UPLOAD_PREFIX      上传路径前缀 (默认: blog)

文章元数据:
  source/_data/archive.yml
  统一配置文章、首页置顶以及声像档案

示例:
  # 启动监听模式（推荐）
  node scripts/content-pipeline/cli.js

  # 一次性处理 example 文件夹中的所有文件
  node scripts/content-pipeline/cli.js --once
`);
  process.exit(0);
}

const pipeline = new ContentPipeline({
  watchPath: './example',
  outputPath: './source/_posts',
  author: 'AikeKo'
});

if (isOnce) {
  // 一次性处理模式
  pipeline.processExisting().then(() => {
    process.exit(0);
  }).catch((error) => {
    console.error('❌ 处理失败:', error);
    process.exit(1);
  });
} else {
  // 监听模式
  pipeline.start().catch((error) => {
    console.error('❌ 启动失败:', error);
    process.exit(1);
  });
  
  // 优雅退出
  process.on('SIGINT', () => {
    console.log('\n\n👋 正在关闭...');
    pipeline.stop();
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    pipeline.stop();
    process.exit(0);
  });
}
