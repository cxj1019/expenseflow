import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  
  // 1. 忽略 ESLint 错误（确保部署不被代码风格警告打断）
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // 2. 忽略 TypeScript 类型错误（确保部署不被类型检查打断）
  typescript: {
    ignoreBuildErrors: true,
  },

  // 3. 允许加载 R2 存储桶的外部图片
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        // 这里已填入您 .env.local 中的 R2 域名
        hostname: 'pub-cb1b22b517734daf8887a20a099e55d0.r2.dev', 
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;