'use client'

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter } from 'next/navigation'
import { useEffect, useState, FormEvent, useCallback, useMemo } from 'react'
import Link from 'next/link'
import type { Database } from '@/types/database.types'

type Report = Database['public']['Tables']['reports']['Row']
type Profile = Database['public']['Tables']['profiles']['Row']

// 筛选类型定义
type TimeFilter = 'all' | 'week' | 'month' | '3months' | '6months' | 'year' | 'custom';

export default function Dashboard() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null);
  const [newReportTitle, setNewReportTitle] = useState('')
  const [isProcessing, setIsProcessing] = useState(false);
  
  // --- 新增：筛选相关的状态 ---
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  // ---------------------------
  
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  const router = useRouter()
  const supabase = createClientComponentClient<Database>()

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
      setNotification({ message, type });
      setTimeout(() => setNotification(null), 5000);
  };

  const fetchReports = useCallback(async (userId: string) => {
    const { data, error } = await supabase.from('reports').select('*').eq('user_id', userId).order('created_at', { ascending: false })
    if (error) {
      console.error('获取报销单列表失败:', error)
      throw new Error('获取报销单列表失败: ' + error.message)
    } else {
      setReports(data || [])
    }
  }, [supabase])

  useEffect(() => {
    const getUserAndReports = async () => {
      try {
        setLoading(true)
        setError(null)
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError) throw userError
        if (user) {
          const { data: profileData, error: profileError } = await supabase.from('profiles').select('*').eq('id', user.id).single()
          if (profileError) throw profileError
          setProfile(profileData)
          await fetchReports(user.id)
        } else {
          router.push('/')
        }
      } catch (err: unknown) {
        console.error("加载数据时出错:", err)
        if (err instanceof Error) {
          setError(err.message || "加载数据时发生未知错误。")
        } else {
          setError("加载数据时发生未知错误。")
        }
      } finally {
        setLoading(false)
      }
    }
    getUserAndReports()
  }, [supabase, router, fetchReports])

  // --- 新增：前端筛选过滤逻辑 ---
  const filteredReports = useMemo(() => {
    if (timeFilter === 'all') return reports;

    const now = new Date();
    let cutoffDate: Date | null = null;

    // 设置截止时间（对于非自定义选项）
    switch (timeFilter) {
      case 'week':
        cutoffDate = new Date(now.setDate(now.getDate() - 7));
        break;
      case 'month':
        cutoffDate = new Date(now.setMonth(now.getMonth() - 1));
        break;
      case '3months':
        cutoffDate = new Date(now.setMonth(now.getMonth() - 3));
        break;
      case '6months':
        cutoffDate = new Date(now.setMonth(now.getMonth() - 6));
        break;
      case 'year':
        cutoffDate = new Date(now.setFullYear(now.getFullYear() - 1));
        break;
      case 'custom':
        // 自定义筛选逻辑在下方单独处理
        break;
    }

    return reports.filter(report => {
      if (!report.created_at) return false;
      const reportDate = new Date(report.created_at);

      if (timeFilter === 'custom') {
        // 检查自定义开始和结束日期
        if (customStartDate && reportDate < new Date(customStartDate)) return false;
        // 结束日期加一天以包含当天（因为日期选择器通常是 00:00:00）
        if (customEndDate) {
            const endDate = new Date(customEndDate);
            endDate.setDate(endDate.getDate() + 1); 
            if (reportDate >= endDate) return false;
        }
        return true;
      }

      // 标准时间段筛选
      return cutoffDate ? reportDate >= cutoffDate : true;
    });
  }, [reports, timeFilter, customStartDate, customEndDate]);
  // ----------------------------------

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const handleCreateReport = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!newReportTitle.trim() || !profile) return

    setIsProcessing(true);
    const { data, error } = await supabase
      .from('reports')
      .insert({ title: newReportTitle.trim(), user_id: profile.id, status: 'draft' } as any)
      .select()
      .single()

    if (error) {
      showNotification('创建报销单失败: ' + error.message, 'error');
    } else if (data) {
      router.push(`/dashboard/report/${(data as any).id}`)
    }
    setIsProcessing(false);
  }

  if (loading) return <div className="flex justify-center items-center min-h-screen">正在加载...</div>
  if (error) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen text-center p-4">
        <h2 className="text-2xl font-bold text-red-600 mb-4">加载失败</h2>
        <p className="text-gray-700 mb-6">{error}</p>
        <button onClick={() => window.location.reload()} className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
          重试
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow">
        <nav className="container mx-auto px-6 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-800">ExpenseFlow 仪表盘</h1>
          <div className="flex items-center space-x-4">
            {profile && ['manager', 'partner'].includes(profile.role) && (
              <>
                <Link href="/approval" className="px-4 py-2 text-white bg-purple-600 rounded-md hover:bg-purple-700">审批中心</Link>
                <Link href="/analytics" className="px-4 py-2 text-white bg-indigo-600 rounded-md hover:bg-indigo-700">费用分析</Link>
              </>
            )}
            {profile && profile.role === 'admin' && (
              <>
                <Link href="/finance" className="px-4 py-2 text-white bg-green-600 rounded-md hover:bg-green-700">财务中心</Link>
                <Link href="/admin" className="px-4 py-2 text-white bg-gray-700 rounded-md hover:bg-gray-800">系统管理</Link>
              </>
            )}
            <span className="text-gray-600">{profile?.full_name || ''}</span>
            <button onClick={handleLogout} className="px-4 py-2 text-white bg-red-500 rounded-md hover:bg-red-600">退出登录</button>
          </div>
        </nav>
      </header>
      <main className="container mx-auto p-6">
        
        {notification && (
            <div className="mb-6">
                <div 
                    className={`p-4 rounded-md text-sm ${
                        notification.type === 'success' 
                        ? 'bg-green-100 text-green-800 border border-green-200' 
                        : 'bg-red-100 text-red-800 border border-red-200'
                    }`}
                >
                    {notification.message}
                </div>
            </div>
        )}

        <div className="bg-white p-6 rounded-lg shadow-md mb-8">
          <h2 className="text-2xl font-bold mb-4">创建新的报销单</h2>
          <form onSubmit={handleCreateReport}>
            <div className="mb-4">
              <label htmlFor="reportTitle" className="block text-gray-700 font-bold mb-2">报销事由</label>
              <input id="reportTitle" type="text" value={newReportTitle} onChange={(e) => setNewReportTitle(e.target.value)} className="w-full px-3 py-2 border rounded-lg" placeholder="例如: 5月北京出差" required/>
            </div>
            <button type="submit" disabled={isProcessing} className="w-full px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-400">
              {isProcessing ? '创建中...' : '创建并开始填写'}
            </button>
          </form>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
            <h2 className="text-2xl font-bold">我的报销单</h2>
            
            {/* --- 新增：筛选控件区域 --- */}
            <div className="flex flex-wrap items-center gap-2">
                <select 
                    value={timeFilter} 
                    onChange={(e) => setTimeFilter(e.target.value as TimeFilter)}
                    className="border rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <option value="all">全部时间</option>
                    <option value="week">最近1周</option>
                    <option value="month">最近1个月</option>
                    <option value="3months">最近3个月</option>
                    <option value="6months">最近半年</option>
                    <option value="year">最近1年</option>
                    <option value="custom">自定义...</option>
                </select>

                {/* 自定义日期输入框 (仅在选择自定义时显示) */}
                {timeFilter === 'custom' && (
                    <div className="flex items-center gap-2 animate-fade-in">
                        <input 
                            type="date" 
                            value={customStartDate} 
                            onChange={(e) => setCustomStartDate(e.target.value)}
                            className="border rounded-md px-2 py-1 text-sm"
                            aria-label="开始日期"
                        />
                        <span className="text-gray-500">-</span>
                        <input 
                            type="date" 
                            value={customEndDate} 
                            onChange={(e) => setCustomEndDate(e.target.value)}
                            className="border rounded-md px-2 py-1 text-sm"
                            aria-label="结束日期"
                        />
                    </div>
                )}
            </div>
            {/* ------------------------- */}
          </div>

          {filteredReports.length > 0 ? (
            <ul className="space-y-4">
              {filteredReports.map((report) => (
                <Link key={report.id} href={`/dashboard/report/${report.id}`}>
                  <li className="p-4 border rounded-lg flex justify-between items-center hover:bg-gray-50 cursor-pointer transition-colors">
                    <div>
                      <p className="font-bold text-lg">{report.title}</p>
                      <p className="text-sm text-gray-500">创建于: {new Date(report.created_at!).toLocaleString()}</p>
                    </div>
                    <span className={`px-3 py-1 text-sm font-semibold rounded-full ${ 
                        report.status === 'approved' ? 'bg-green-100 text-green-800' : 
                        report.status === 'rejected' ? 'bg-red-100 text-red-800' : 
                        report.status === 'submitted' || report.status === 'pending_partner_approval' ? 'bg-yellow-100 text-yellow-800' : 
                        'bg-gray-100 text-gray-800'
                    }`}>
                      {report.status === 'pending_partner_approval' ? '等待合伙人审批' : report.status}
                    </span>
                  </li>
                </Link>
              ))}
            </ul>
          ) : (
            <div className="text-center py-10 text-gray-500 bg-gray-50 rounded-lg border border-dashed">
                {reports.length === 0 ? "您还没有创建任何报销单。" : "该时间段内没有报销单。"}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}