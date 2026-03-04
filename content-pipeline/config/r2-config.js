/**
 * Cloudflare R2 配置
 * 
 * 注意：敏感信息应从环境变量读取
 * 配置项：
 * - R2_ACCOUNT_ID: Cloudflare Account ID
 * - R2_ACCESS_KEY_ID: S3 兼容 Access Key
 * - R2_SECRET_ACCESS_KEY: S3 兼容 Secret Key
 * - R2_BUCKET_NAME: 存储桶名称
 * - R2_PUBLIC_URL: 公开访问 URL (如 https://cdn.yoursite.com)
 */

// 加载环境变量
try {
  require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
} catch (e) {
  // dotenv 未安装或 .env 不存在，忽略
}

const config = {
  // R2 账户配置
  accountId: process.env.R2_ACCOUNT_ID || '',
  accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  
  // 存储桶配置
  bucketName: process.env.R2_BUCKET_NAME || 'aikkeko',
  
  // 公开访问 URL（用于替换图片链接）
  // 示例：https://78aeb471b834893423e4e0a7a5499914.r2.cloudflarestorage.com/aikkeko
  publicUrl: process.env.R2_PUBLIC_URL || '',
  
  // 上传路径前缀
  uploadPrefix: process.env.R2_UPLOAD_PREFIX || 'blog',
  
  // R2 S3 兼容端点
  // 支持两种格式：
  // 1. 虚拟主机式：https://<account_id>.r2.cloudflarestorage.com
  // 2. 路径式：https://<account_id>.r2.cloudflarestorage.com/<bucket>
  get endpoint() {
    // 如果提供了完整端点，使用它
    if (process.env.R2_ENDPOINT) {
      return process.env.R2_ENDPOINT;
    }
    // 否则使用标准格式
    return `https://${this.accountId}.r2.cloudflarestorage.com`;
  },
  
  // 检测端点是否包含 bucket 路径
  get isPathStyleEndpoint() {
    const endpoint = this.endpoint;
    // 如果端点 URL 以 bucket 名称结尾，说明是路径式
    return endpoint.endsWith(`/${this.bucketName}`);
  },
  
  // 区域（R2 使用 auto）
  region: 'auto',
  
  // 验证配置完整性
  validate() {
    const required = ['accountId', 'accessKeyId', 'secretAccessKey', 'bucketName'];
    const missing = required.filter(key => !this[key]);
    
    if (missing.length > 0) {
      throw new Error(`R2 配置缺失: ${missing.join(', ')}\n请设置对应的环境变量`);
    }
    
    return true;
  }
};

module.exports = config;
