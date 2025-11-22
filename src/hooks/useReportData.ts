import { useState, useEffect, useCallback } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { User } from '@supabase/supabase-js';
import { useParams } from 'next/navigation';
import type { Database } from '@/types/database.types';

// 定义 Hook 返回的数据类型，方便在组件中使用
type Profile = Database['public']['Tables']['profiles']['Row'];
type Report = Database['public']['Tables']['reports']['Row'];
type Expense = Database['public']['Tables']['expenses']['Row'];
type Customer = Database['public']['Tables']['customers']['Row'];

// 为了在报销单上直接显示提交人姓名，我们定义一个包含关联数据的类型
export type ReportWithRelations = Report & {
    profiles: Pick<Profile, 'full_name'> | null;
    primary_approver: Pick<Profile, 'full_name'> | null;
    final_approver: Pick<Profile, 'full_name'> | null;
}

export function useReportData() {
    const supabase = createClientComponentClient<Database>();
    const params = useParams();
    const reportId = params.id as string;

    // --- 状态定义 ---
    const [report, setReport] = useState<ReportWithRelations | null>(null);
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [user, setUser] = useState<User | null>(null);
    const [currentUserProfile, setCurrentUserProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // --- 核心数据获取函数 ---
    const fetchPageData = useCallback(async () => {
        if (!reportId) {
            setError("无效的报销单ID。");
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError(null);

            // 1. 获取当前登录的用户信息
            const { data: { user: authUser }, error: userError } = await supabase.auth.getUser();
            if (userError) throw new Error(`获取用户信息失败: ${userError.message}`);
            if (!authUser) {
                 // 如果没有用户，理论上应该被中间件或页面逻辑重定向，但这里加个保险
                throw new Error("用户未登录。");
            }
            setUser(authUser);

            // 2. 并行获取多项数据，提高效率
            const [profileRes, reportRes, expensesRes, customersRes] = await Promise.all([
                // 获取当前用户的档案（角色等信息）
                supabase.from('profiles').select('*').eq('id', authUser.id).single(),
                
                // 获取报销单详情，并关联查询出提交人、一级审批人、最终审批人的姓名
                // 【关键修复】：显式指定所有关联的外键名称，解决 "more than one relationship" 歧义
                supabase.from('reports')
                    .select(`
                        *, 
                        profiles:profiles!reports_user_id_fkey(full_name), 
                        primary_approver:profiles!reports_primary_approver_id_fkey(full_name), 
                        final_approver:profiles!reports_approver_id_fkey(full_name)
                    `)
                    .eq('id', parseInt(reportId, 10))
                    .single(),

                // 获取该报销单下的所有费用条目
                supabase.from('expenses').select('*').eq('report_id', parseInt(reportId, 10)).order('expense_date', { ascending: true }),
                // 获取所有客户列表，用于表单下拉选择
                supabase.from('customers').select('*').order('name')
            ]);
            
            // 3. 处理和设置状态
            if (profileRes.error) throw new Error(`获取用户档案失败: ${profileRes.error.message}`);
            setCurrentUserProfile(profileRes.data);

            if (reportRes.error) throw new Error(`获取报销单失败: ${reportRes.error.message}`);
            setReport(reportRes.data); 

            if (expensesRes.error) throw new Error(`获取费用列表失败: ${expensesRes.error.message}`);
            setExpenses(expensesRes.data || []);
            
            if (customersRes.error) throw new Error(`获取客户列表失败: ${customersRes.error.message}`);
            setCustomers(customersRes.data || []);

        } catch (err: unknown) {
            console.error("加载报销单页面数据时出错:", err);
            if (err instanceof Error) {
                setError(err.message || "加载数据时发生未知错误。");
            } else {
                setError("加载数据时发生未知错误。");
            }
        } finally {
            setLoading(false);
        }
    }, [reportId, supabase]);

    // --- Effect Hook ---
    // 在组件首次加载时，自动执行数据获取函数
    useEffect(() => {
        fetchPageData();
    }, [fetchPageData]);


    // --- 返回值 ---
    // 将所有需要的数据和方法返回给页面组件
    return {
        report,
        setReport, // 将 setReport 也返回，允许页面在操作后直接更新状态，优化体验
        expenses,
        customers,
        user,
        currentUserProfile,
        loading,
        error,
        fetchPageData // 将 fetch 函数也返回，方便在页面上进行手动刷新
    };
}