import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'

import type { NextRequest } from 'next/server'
import type { Database } from '@/types/database.types'

export async function middleware(req: NextRequest) {
  // 我们创建了一个响应对象，以便可以修改它的 headers
  const res = NextResponse.next()

  // 使用请求中的 cookies 创建一个 Supabase 客户端。
  // 这是在服务器端（中间件中）与 Supabase 交互的推荐方式。
  const supabase = createMiddlewareClient<Database>({ req, res })

  // 这个函数至关重要！
  // 它会安全地获取用户的会话信息。如果用户的访问令牌（access token）即将过期，
  // 它会自动使用刷新令牌（refresh token）来获取一个新的，并更新到 cookie 中。
  // 这正是解决你问题的核心所在。
  await supabase.auth.getSession()

  // 将更新后的 cookies（可能包含新的访问令牌）返回给浏览器。
  return res
}

// 中间件的配置，确保它在除了 API、_next/static、_next/image 和 favicon.ico 之外的所有请求路径上运行。
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
