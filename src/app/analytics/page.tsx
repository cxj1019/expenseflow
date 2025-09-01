// src/app/analytics/page.tsx

'use client'

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import * as XLSX from 'xlsx'
import type { Database } from '@/types/database.types'

type Profile = Database['public']['Tables']['profiles']['Row']

// 【已更新】定义更丰富的类型，包含两级审批人信息
type ExpenseWithDetails = Database['public']['Tables']['expenses']['Row'] & {
  profiles: Pick<Profile, 'full_name'> | null
  reports: {
    title: string | null
    submitted_at: string | null
    customer_name: string | null
    bill_to_customer: boolean | null
    primary_approved_at: string | null
    final_approved_at: string | null
    primary_approver: Pick<Profile, 'full_name'> | null // 一级审批人
    final_approver: Pick<Profile, 'full_name'> | null   // 二级审批人
  } | null
}

export default function AnalyticsPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [filteredExpenses, setFilteredExpenses] = useState<ExpenseWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [isFetching, setIsFetching] = useState(false)
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [customer, setCustomer] = useState('');

  const router = useRouter()
  const supabase = createClientComponentClient<Database>()

  useEffect(() => {
    // ... (useEffect 权限检查部分保持不变)
  }, [supabase, router])

  const handleFetchData = async () => {
    setIsFetching(true);
    // 【已更新】查询语句，关联两次 profiles 表来获取两级审批人的名字
    let query = supabase
      .from('expenses')
      .select(`
        *,
        profiles(full_name),
        reports!inner(
          title,
          submitted_at,
          customer_name,
          bill_to_customer,
          primary_approved_at,
          final_approved_at,
          primary_approver:profiles!reports_primary_approver_id_fkey(full_name),
          final_approver:profiles!reports_final_approver_id_fkey(full_name)
        )
      `)
      .order('expense_date', { ascending: false });

    if (startDate) { query = query.gte('expense_date', startDate); }
    if (endDate) { query = query.lte('expense_date', endDate); }
    if (customer.trim() !== '') {
      query = query.ilike('reports.customer_name', `%${customer.trim()}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('查询费用数据失败: ', error);
      alert('查询费用数据失败: ' + error.message);
    } else {
      setFilteredExpenses(data as ExpenseWithDetails[]);
    }
    setIsFetching(false);
  };

  const handleExportToExcel = () => {
    if (filteredExpenses.length === 0) {
      alert('没有可导出的数据，请先查询。');
      return;
    }

    // 【已更新】导出数据以匹配新的列
    const dataToExport = filteredExpenses.map(exp => ({
      '费用日期': new Date(exp.expense_date!).toLocaleDateString(),
      '费用类型': exp.category,
      '金额': exp.amount,
      '员工': exp.profiles?.full_name || 'N/A',
      '客户': exp.reports?.customer_name || '-',
      '是否向客户请款': exp.reports?.bill_to_customer ? '是' : '否',
      '报销单名称': exp.reports?.title || 'N/A',
      '提交日期': exp.reports?.submitted_at ? new Date(exp.reports.submitted_at).toLocaleDateString() : '-',
      '一级审批时间': exp.reports?.primary_approved_at ? new Date(exp.reports.primary_approved_at).toLocaleDateString() : '-',
      '一级审批人': exp.reports?.primary_approver?.full_name || '-',
      '最终审批时间': exp.reports?.final_approved_at ? new Date(exp.reports.final_approved_at).toLocaleDateString() : '-',
      '最终审批人': exp.reports?.final_approver?.full_name || '-',
      '费用ID': exp.id,
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '费用明细');
    XLSX.writeFile(workbook, `费用报表_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  if (loading) return <div className="flex justify-center items-center min-h-screen">正在加载...</div>;
  if (!profile || !['manager', 'partner'].includes(profile.role)) {
    // ... (访问被拒绝的 JSX)
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow">
        {/* ... (header JSX) */}
      </header>
      <main className="container mx-auto p-6">
        {/* 筛选区域 */}
        <div className="bg-white p-6 rounded-lg shadow-md mb-8">
          {/* ... (筛选表单 JSX) */}
        </div>

        {/* 结果区域 */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">查询结果</h2>
            <button onClick={handleExportToExcel} disabled={filteredExpenses.length === 0} className="bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 disabled:bg-gray-400">
              导出为 Excel
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              {/* 【已更新】表格头部 */}
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">费用日期</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">类型</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">金额</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">员工</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">客户</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">报销单名称</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">提交日期</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">一级审批时间</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">一级审批人</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">最终审批时间</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">最终审批人</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {/* 【已更新】表格内容 */}
                {filteredExpenses.map(exp => (
                  <tr key={exp.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{new Date(exp.expense_date!).toLocaleDateString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{exp.category}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono">¥{exp.amount?.toFixed(2)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{exp.profiles?.full_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{exp.reports?.customer_name || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{exp.reports?.title}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{exp.reports?.submitted_at ? new Date(exp.reports.submitted_at).toLocaleDateString() : '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{exp.reports?.primary_approved_at ? new Date(exp.reports.primary_approved_at).toLocaleDateString() : '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{exp.reports?.primary_approver?.full_name || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{exp.reports?.final_approved_at ? new Date(exp.reports.final_approved_at).toLocaleDateString() : '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{exp.reports?.final_approver?.full_name || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredExpenses.length === 0 && !isFetching && <p className="text-center text-gray-500 py-4">暂无数据，请通过上方条件进行查询。</p>}
          </div>
        </div>
      </main>
    </div>
  )
}
