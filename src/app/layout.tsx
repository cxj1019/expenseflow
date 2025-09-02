import './globals.css'

// 你可以在这里定义应用的元数据，比如浏览器标签页的标题
export const metadata = {
  title: 'ExpenseFlow - 报销审批系统',
  description: '一个现代化的在线报销审批系统',
}

// 这是所有页面的根布局组件
// 我们把它简化到最核心的功能：提供一个基本的 HTML 结构
// 所有和用户登录状态相关的逻辑都已移除，完全交由 middleware.ts 和具体的页面处理
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  )
}
