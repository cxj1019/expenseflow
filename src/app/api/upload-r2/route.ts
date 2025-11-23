// src/app/api/upload-r2/route.ts

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers'; // 引入 cookies

// 辅助函数：懒加载 S3 Client
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
    // --- 修复开始：适配 Next.js 15 的 Cookie 处理 ---
    const cookieStore = await cookies(); 
    
    // 这里我们手动传入 cookies 对象，解决 await 问题
    const supabase = createRouteHandlerClient({ 
        cookies: () => cookieStore 
    });
    // --- 修复结束 ---

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: '未授权的操作' }, { status: 401 });
    }

    let s3Client;
    try {
      s3Client = getS3Client();
    } catch (e) {
      console.error("R2 Client Init Error:", e);
      return NextResponse.json({ error: '服务器存储配置错误' }, { status: 500 });
    }

    const body = await request.json();
    const { fileType } = body; 

    if (!fileType || typeof fileType !== 'string') {
      return NextResponse.json({ error: '无效的文件类型' }, { status: 400 });
    }

    const fileExtension = fileType.split('/')[1] || 'bin';
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