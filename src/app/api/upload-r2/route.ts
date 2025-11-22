//src\app\api\upload-r2\route.ts

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

// 辅助函数：懒加载 S3 Client
// 这样可以避免在构建时因为缺少环境变量而报错
const getS3Client = () => {
  const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
  const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
  const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;

  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    throw new Error("R2 环境变量配置缺失");
  }

  return new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });
};

const generateFileName = (bytes = 32) => crypto.randomBytes(bytes).toString('hex');

export async function POST(request: Request) {
  try {
    // 1. 安全性检查：验证用户是否登录 (修复之前提到的安全漏洞)
    // 在 Route Handler 中，我们需要使用 createRouteHandlerClient
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: '未授权的操作' }, { status: 401 });
    }

    // 2. 初始化 S3 Client (现在即使构建时没有环境变量也不会崩，只有调用时才会检查)
    let s3Client;
    try {
      s3Client = getS3Client();
    } catch (e) {
      console.error("R2 Client Init Error:", e);
      return NextResponse.json({ error: '服务器存储配置错误' }, { status: 500 });
    }

    // 3. 解析请求体
    const body = await request.json();
    const { fileType } = body; 
    // 注意：我们不再从 body 读取 userId，而是直接使用 session 中的 user.id，防止越权！

    if (!fileType || typeof fileType !== 'string') {
      return NextResponse.json({ error: '无效的文件类型' }, { status: 400 });
    }

    const fileExtension = fileType.split('/')[1];
    if (!fileExtension) {
      return NextResponse.json({ error: '无法识别文件扩展名' }, { status: 400 });
    }

    // 使用当前登录用户的 ID 构造路径
    const fileName = `${user.id}/${generateFileName()}.${fileExtension}`;
    
    const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;
    const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL;

    if(!R2_BUCKET_NAME || !R2_PUBLIC_URL) {
         return NextResponse.json({ error: 'Bucket 配置缺失' }, { status: 500 });
    }

    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: fileName,
      ContentType: fileType,
    });

    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 600 });

    return NextResponse.json({ 
      uploadUrl: signedUrl, 
      accessUrl: `${R2_PUBLIC_URL}/${fileName}`
    });

  } catch (error: any) {
    console.error('Upload R2 Error:', error);
    return NextResponse.json({ error: error.message || '内部服务器错误' }, { status: 500 });
  }
}
