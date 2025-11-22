ExpenseFlow 报销审批系统 - 项目开发总结
本文档旨在全面总结 ExpenseFlow 在线报销审批系统的开发历程、技术架构、核心功能及关键决策点，以便于后续的维护、交接和二次开发。

1. 项目概述
ExpenseFlow 是一个功能完善的在线报销审批Web应用。它允许员工创建、提交和管理报销单，同时支持多级、基于规则的审批流程，并为管理员提供了全局监控和财务操作的能力。

核心技术栈
前端:

框架: Next.js 15+ (使用 App Router)

语言: TypeScript

UI库: React 18+

样式: Tailwind CSS

后端 & 数据库:

服务: Supabase

数据库: PostgreSQL

认证: Supabase Auth

文件存储:

服务: Cloudflare R2 (对象存储)

辅助库:

xlsx: 用于将报表数据导出为 Excel 文件。

jspdf & html2canvas: 用于将前端React组件渲染并导出为 PDF 文件。

pinyin-pro: 用于在搜索框中实现汉字拼音搜索功能。

2. 功能模块与实现亮点
2.1 用户与权限管理 (/admin)
功能: 管理员可以统一管理系统中的所有用户、客户及成本中心。

实现:

角色系统: profiles 表中的 role 字段定义了四种角色：employee (员工), manager (经理), partner (合伙人), admin (管理员)。

部门管理: 管理员可以为每个用户从预设的部门列表（如 G1, G2, 支持部门等）中分配部门。

2.2 报销单生命周期 (/dashboard & /dashboard/report/[id])
这是应用的核心，覆盖了从创建到支付的完整流程。

创建与编辑:

用户在仪表盘 (/dashboard) 创建报销单，系统会自动跳转到详情页 (/dashboard/report/[id])。

在“草稿”(draft)状态下，用户可以自由编辑报销单标题、添加/修改/删除费用明细、上传发票（支持图片和PDF）。

文件上传:

安全机制: 采用 Pre-signed URL 模式。前端先向后端API (/api/upload-r2) 请求一个有时效性的上传许可，然后直接将文件上传到 Cloudflare R2，不占用服务器带宽。

文件类型: 支持图片 (image/*) 和 PDF (application/pdf) 文件。

提交与审批:

提交后，报销单进入审批流。用户可以“撤回”(withdraw)进行修改。

审批人可以在详情页进行“批准”(approve)或“退回修改”(send_back)的操作。

财务操作:

管理员专属: 管理员可以在任何状态的报销单详情页看到专属的“管理员操作”面板。

功能: 标记“已收到发票”(is_invoice_received)和“已付款”(is_paid)。

业务约束: 实现了“只有在收到发票后才能标记为已付款”的硬性逻辑，通过数据库约束和前端UI禁用联动来保证。

2.3 复杂的审批流程 (/approval)
审批逻辑是本项目的核心与难点，最终通过 Supabase 数据库函数 (RPC) get_reports_for_approval 来实现，保证了逻辑的集中、高效与安全。

核心审批规则:

经理: 审批自己部门下属员工的报销单。

合伙人: 审批所有经理、其他合伙人、以及支持部门员工的报销单。

二级审批: 金额 > 5000 或经理手动选择“批准并转交”的报销单，在经理批准后会进入 pending_partner_approval 状态，等待合伙人终审。

管理员: 无审批权，但在审批中心拥有全局只读视角，可以看到所有待处理和已处理的单据。

数据记录:

reports 表中通过 primary_approver_id 和 final_approver_id 两个字段，分别记录一级和最终审批人的信息及时间。

2.4 数据分析与导出 (/analytics)
功能: 拥有权限的角色（经理、合伙人、管理员）可以根据日期、客户等条件筛选所有费用明细，并将结果导出为 Excel 文件。

实现:

复杂查询: 通过 Supabase 的 PostgREST 语法，一条查询语句即可关联 expenses, reports, profiles (作为提交人), profiles (作为一级审批人), profiles (作为最终审批人) 五次，高效获取所有需要的数据。

前端导出: 使用 xlsx 库在浏览器端直接生成和下载 .xlsx 文件。

2.5 界面与交互
UI设计: 整体采用简洁、专业的卡片式布局，并通过颜色和图标（如审批状态标签、操作按钮）提供清晰的视觉反馈。

高级组件:

图片预览: 实现了功能强大的悬浮式图片预览组件，支持拖动、缩放、旋转。

PDF导出: 实现了将 React 组件（请求书模板）动态渲染并导出为 PDF 的功能。

3. 开发过程中的关键问题与解决方案
在开发过程中，我们遇到了几个棘手的环境和代码问题，以下是其总结，对未来排查类似问题非常有帮助：

问题: Supabase CLI (supabase gen types) 在 Windows 环境下反复卡死或报权限错误 (EPERM)。

排查: 尝试了 npx、管理员模式、清理缓存、全局安装等多种方式，最终定位到是本地网络环境（防火墙或代理）阻止了 CLI 对数据库端口的直接访问。

最终解决方案: 完全绕过 CLI，直接从 Supabase 网站后台的 API Docs -> [选择任一表格] -> TypeScript 区域生成并复制最新的类型定义。这是未来更新类型时最稳定可靠的方法。

问题: 登录时频繁触发 "Request rate limit reached" 错误。

排查: Supabase 后台日志显示海量的 /auth/v1/token 请求。

最终解决方案: 原因是 middleware.ts 与 layout.tsx 中存在重复的会话刷新逻辑。通过简化 layout.tsx，使其只负责布局，将所有会话管理完全交给 middleware.ts，彻底解决了问题。

问题: 报销单详情页出现空白页或各种运行时错误。

排查: 包括 Next.js 版本升级导致的 params 对象变为 Promise、数据库查询外键名写错、条件渲染导致布局崩溃等。

最终解决方案:

使用 useParams hook 代替直接访问 params 属性。

仔细核对了所有 Supabase 的关联查询语句，确保外键名称正确。

重构了数据加载函数 fetchPageData，使用 try...catch...finally 结构，确保任何情况下都能正确处理加载和错误状态。

4. 后续开发建议
UI/UX优化: 将所有的 alert() 替换为更现代化的 Toast 通知组件（如 react-hot-toast 或 sonner），以提供非阻塞式的用户反馈。

代码重构: report/[id]/page.tsx 文件虽然功能完整，但体积过大。可以考虑将其拆分为更小的子组件，并将复杂的逻辑提取到自定义 Hooks 中，以提高可维护性。

部署: 项目已准备好部署。推荐使用 Vercel，只需关联 GitHub 仓库，并在 Vercel 的项目设置中配置好所有  .env.local 中的环境变量即可一键部署。

这份总结应该能帮助任何开发者快速理解项目的现状。祝后续开发顺利！