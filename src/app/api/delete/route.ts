import { S3Client, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

// 复用之前的 S3 Client 初始化逻辑
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

// 辅助函数：从完整 URL 中提取 R2 的 Key
// 例如：https://img.example.com/user123/abc.jpg -> user123/abc.jpg
const extractKeyFromUrl = (url: string) => {
  try {
    const publicUrl = process.env.R2_PUBLIC_URL || '';
    // 如果 URL 包含我们的公共域名，将其替换为空，剩下的就是 Key
    // 注意：这里要处理可能存在的末尾斜杠
    const cleanPublicUrl = publicUrl.endsWith('/') ? publicUrl : `${publicUrl}/`;
    if (url.startsWith(cleanPublicUrl)) {
      return url.replace(cleanPublicUrl, '');
    }
    // 如果 URL 格式不匹配，尝试用 new URL 解析 pathname
    const urlObj = new URL(url);
    return urlObj.pathname.startsWith('/') ? urlObj.pathname.slice(1) : urlObj.pathname;
  } catch (e) {
    console.error("Key 解析失败:", url);
    return null;
  }
};

export async function POST(request: Request) {
  try {
    // 1. 权限验证
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    // 2. 解析请求：我们要删的是 'report' (整单) 还是 'expense' (单笔)？
    const body = await request.json();
    const { type, id } = body; // type: 'report' | 'expense', id: number

    if (!id || !['report', 'expense'].includes(type)) {
      return NextResponse.json({ error: '参数无效' }, { status: 400 });
    }

    // 3. 收集需要删除的文件 URL
    let urlsToDelete: string[] = [];
    
    if (type === 'expense') {
      // --- 情况 A: 删除单笔费用 ---
      const { data: expense } = await supabase
        .from('expenses')
        .select('receipt_urls')
        .eq('id', id)
        .single();
      
      if (expense?.receipt_urls) {
        urlsToDelete = expense.receipt_urls;
      }

      // 执行数据库删除
      const { error: delError } = await supabase.from('expenses').delete().eq('id', id);
      if (delError) throw delError;

    } else if (type === 'report') {
      // --- 情况 B: 删除整个报销单 ---
      // 先找出该报销单下所有的费用，收集它们的文件链接
      const { data: expenses } = await supabase
        .from('expenses')
        .select('receipt_urls')
        .eq('report_id', id);

      if (expenses) {
        expenses.forEach(exp => {
          if (exp.receipt_urls) {
            urlsToDelete.push(...exp.receipt_urls);
          }
        });
      }

      // 执行数据库删除 (因为设置了外键级联删除，删 report 会自动删 expenses，但为了稳妥先删 expenses 也可以)
      // 这里假设您的数据库设置了 ON DELETE CASCADE，直接删 report 即可
      // 如果没有级联，需要先 supabase.from('expenses').delete().eq('report_id', id)
      const { error: delError } = await supabase.from('reports').delete().eq('id', id);
      if (delError) throw delError;
    }

    // 4. 执行 R2 文件删除 (如果有文件的话)
    if (urlsToDelete.length > 0) {
      const s3Client = getS3Client();
      const keys = urlsToDelete
        .map(extractKeyFromUrl)
        .filter(key => key !== null) as string[];

      if (keys.length > 0) {
        console.log("正在从 R2 删除文件:", keys);
        // R2 支持批量删除
        const deleteCommand = new DeleteObjectsCommand({
          Bucket: process.env.R2_BUCKET_NAME,
          Delete: {
            Objects: keys.map(key => ({ Key: key })),
            Quiet: true, // 静默模式，不报错即可
          },
        });
        await s3Client.send(deleteCommand);
      }
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Delete Error:', error);
    return NextResponse.json({ error: error.message || '删除失败' }, { status: 500 });
  }
}