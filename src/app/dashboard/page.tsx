'use client'

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter } from 'next/navigation'
import { useEffect, useState, FormEvent, useCallback, useMemo } from 'react'
import Link from 'next/link'
import type { Database } from '@/types/database.types'

type Report = Database['public']['Tables']['reports']['Row']
type Profile = Database['public']['Tables']['profiles']['Row']

type TimeFilter = 'all' | 'week' | 'month' | '3months' | '6months' | 'year' | 'custom';

export default function Dashboard() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null);
  const [newReportTitle, setNewReportTitle] = useState('')
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  
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
        if (err instanceof Error) {
          setError(err.message)
        } else {
          setError("未知错误")
        }
      } finally {
        setLoading(false)
      }
    }
    getUserAndReports()
  }, [supabase, router, fetchReports])

  const filteredReports = useMemo(() => {
    if (timeFilter === 'all') return reports;
    const now = new Date();
    let cutoffDate: Date | null = null;
    switch (timeFilter) {
      case 'week': cutoffDate = new Date(now.setDate(now.getDate() - 7)); break;
      case 'month': cutoffDate = new Date(now.setMonth(now.getMonth() - 1)); break;
      case '3months': cutoffDate = new Date(now.setMonth(now.getMonth() - 3)); break;
      case '6months': cutoffDate = new Date(now.setMonth(now.getMonth() - 6)); break;
      case 'year': cutoffDate = new Date(now.setFullYear(now.getFullYear() - 1)); break;
      case 'custom': break;
    }
    return reports.filter(report => {
      if (!report.created_at) return false;
      const reportDate = new Date(report.created_at);
      if (timeFilter === 'custom') {
        if (customStartDate && reportDate < new Date(customStartDate)) return false;
        if (customEndDate) {
            const endDate = new Date(customEndDate);
            endDate.setDate(endDate.getDate() + 1); 
            if (reportDate >= endDate) return false;
        }
        return true;
      }
      return cutoffDate ? reportDate >= cutoffDate : true;
    });
  }, [reports, timeFilter, customStartDate, customEndDate]);

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const handleCreateReport = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!newReportTitle.trim() || !profile) return
    setIsProcessing(true);
    const { data, error } = await supabase.from('reports').insert({ title: newReportTitle.trim(), user_id: profile.id, status: 'draft' } as any).select().single()
    if (error) {
      showNotification('创建失败: ' + error.message, 'error');
    } else if (data) {
      router.push(`/dashboard/report/${(data as any).id}`)
    }
    setIsProcessing(false);
  }

  if (loading) return <div className="flex justify-center items-center min-h-screen text-gray-500">加载中...</div>
  if (error) return <div className="p-8 text-center text-red-500">{error}</div>

  return (
    <div className="min-h-screen bg-gray-100 pb-10">
      {/* 适配移动端的 Header */}
      <header className="bg-white shadow sticky top-0 z-10">
        <nav className="container mx-auto px-4 py-3 flex flex-col md:flex-row justify-between items-center gap-3">
          <div className="flex justify-between w-full md:w-auto items-center">
             <h1 className="text-xl font-bold text-gray-800">ExpenseFlow</h1>
             {/* 移动端显示的简单用户信息 */}
             <span className="text-xs text-gray-500 md:hidden">{profile?.full_name}</span>
          </div>
          
          <div className="flex items-center gap-2 md:gap-4 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
            {profile && ['manager', 'partner'].includes(profile.role) && (
              <Link href="/approval" className="whitespace-nowrap px-3 py-1.5 text-sm text-white bg-purple-600 rounded-md hover:bg-purple-700">审批</Link>
            )}
            {profile && profile.role === 'admin' && (
              <Link href="/finance" className="whitespace-nowrap px-3 py-1.5 text-sm text-white bg-green-600 rounded-md hover:bg-green-700">财务</Link>
            )}
            <span className="hidden md:inline text-sm text-gray-600">{profile?.full_name}</span>
            <button onClick={handleLogout} className="whitespace-nowrap px-3 py-1.5 text-sm text-white bg-gray-500 rounded-md hover:bg-gray-600">退出</button>
          </div>
        </nav>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-5xl">
        {notification && (
            <div className={`mb-4 p-3 rounded-md text-sm animate-fade-in ${notification.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                {notification.message}
            </div>
        )}

        {/* 创建卡片 - 移动端优化 */}
        <div className="bg-white p-5 rounded-xl shadow-sm mb-6 border border-gray-100">
          <h2 className="text-xl font-bold mb-3 text-gray-800">🚀 发起报销</h2>
          <form onSubmit={handleCreateReport} className="flex flex-col md:flex-row gap-3">
            <input 
                type="text" 
                value={newReportTitle} 
                onChange={(e) => setNewReportTitle(e.target.value)} 
                className="flex-grow px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all" 
                placeholder="输入事由 (如: 5月上海出差)" 
                required
            />
            <button type="submit" disabled={isProcessing} className="w-full md:w-auto px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-md shadow-blue-200">
              {isProcessing ? '创建中...' : '开始报销'}
            </button>
          </form>
        </div>

        {/* 报销单列表卡片 */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 border-b pb-4 border-gray-100">
            <h2 className="text-xl font-bold text-gray-800">📄 我的单据</h2>
            
            {/* 筛选控件 - 移动端全宽 */}
            <div className="flex flex-col sm:flex-row w-full md:w-auto gap-2">
                <select 
                    value={timeFilter} 
                    onChange={(e) => setTimeFilter(e.target.value as TimeFilter)}
                    className="w-full sm:w-auto border border-gray-300 rounded-lg px-3 py-2 text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                >
                    <option value="all">📅 全部时间</option>
                    <option value="week">最近1周</option>
                    <option value="month">最近1个月</option>
                    <option value="3months">最近3个月</option>
                    <option value="6months">最近半年</option>
                    <option value="year">最近1年</option>
                    <option value="custom">自定义时间...</option>
                </select>

                {timeFilter === 'custom' && (
                    <div className="flex gap-2 w-full sm:w-auto animate-fade-in">
                        <input type="date" value={customStartDate} onChange={(e) => setCustomStartDate(e.target.value)} className="w-1/2 sm:w-auto border rounded-lg px-2 py-2 text-sm bg-gray-50"/>
                        <input type="date" value={customEndDate} onChange={(e) => setCustomEndDate(e.target.value)} className="w-1/2 sm:w-auto border rounded-lg px-2 py-2 text-sm bg-gray-50"/>
                    </div>
                )}
            </div>
          </div>

          {filteredReports.length > 0 ? (
            <div className="grid grid-cols-1 gap-3">
              {filteredReports.map((report) => (
                <Link key={report.id} href={`/dashboard/report/${report.id}`} className="block">
                  <div className="p-4 border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-md transition-all bg-white group active:scale-[0.99]">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-bold text-gray-800 text-lg group-hover:text-blue-600 line-clamp-1">{report.title}</h3>
                      <span className={`flex-shrink-0 px-2.5 py-1 text-xs font-medium rounded-full ${ 
                          report.status === 'approved' ? 'bg-green-100 text-green-700' : 
                          report.status === 'rejected' ? 'bg-red-100 text-red-700' : 
                          report.status === 'submitted' ? 'bg-blue-100 text-blue-700' :
                          report.status === 'pending_partner_approval' ? 'bg-purple-100 text-purple-700' : 
                          'bg-gray-100 text-gray-600'
                      }`}>
                        {report.status === 'pending_partner_approval' ? '待合伙人审' : 
                         report.status === 'submitted' ? '待经理审' :
                         report.status === 'draft' ? '草稿' :
                         report.status === 'approved' ? '已通过' : '已驳回'}
                      </span>
                    </div>
                    <div className="flex justify-between items-end">
                        <p className="text-xs text-gray-400">
                           {new Date(report.created_at!).toLocaleDateString()}
                        </p>
                        <p className="font-mono font-medium text-gray-900">
                            ¥{report.total_amount?.toLocaleString() || '0.00'}
                        </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                <span className="text-4xl mb-2">📭</span>
                <p>暂无相关报销记录</p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}