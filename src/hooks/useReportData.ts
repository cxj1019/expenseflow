// src/hooks/useReportData.ts

import { useState, useEffect, useCallback } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { User } from '@supabase/supabase-js';
import { useParams, useRouter } from 'next/navigation';
import type { Database } from '@/types/database.types';

type Profile = Database['public']['Tables']['profiles']['Row'];
type Report = Database['public']['Tables']['reports']['Row'];
type Expense = Database['public']['Tables']['expenses']['Row'];
type Customer = Database['public']['Tables']['customers']['Row'];

// ✅ 修改 1: 更新类型定义，包含 department 等更多字段
export type ReportWithRelations = Report & {
    profiles: Pick<Profile, 'full_name' | 'department' | 'role' | 'email' | 'avatar_url'> | null;
    primary_approver: Pick<Profile, 'full_name'> | null;
    final_approver: Pick<Profile, 'full_name'> | null;
}

export function useReportData() {
    const supabase = createClientComponentClient<Database>();
    const params = useParams();
    const router = useRouter();
    const reportId = params.id as string;

    const [report, setReport] = useState<ReportWithRelations | null>(null);
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [user, setUser] = useState<User | null>(null);
    const [currentUserProfile, setCurrentUserProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    const fetchPageData = useCallback(async () => {
        if (!reportId) {
            setError("无效的报销单ID。");
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError(null);

            const { data: { user: authUser }, error: userError } = await supabase.auth.getUser();
            if (userError) throw new Error(`获取用户信息失败: ${userError.message}`);
            if (!authUser) throw new Error("用户未登录。");
            setUser(authUser);

            // ✅ 修改 2: 在查询中明确请求 department, role, email, avatar_url
            const [profileRes, reportRes, expensesRes, customersRes] = await Promise.all([
                supabase.from('profiles').select('*').eq('id', authUser.id).single(),
                supabase.from('reports')
                    .select(`
                        *, 
                        profiles:profiles!reports_user_id_fkey(full_name, department, role, email, avatar_url), 
                        primary_approver:profiles!reports_primary_approver_id_fkey(full_name), 
                        final_approver:profiles!reports_approver_id_fkey(full_name)
                    `)
                    .eq('id', parseInt(reportId, 10))
                    .single(),
                supabase.from('expenses').select('*').eq('report_id', parseInt(reportId, 10)).order('expense_date', { ascending: true }),
                supabase.from('customers').select('*').order('name')
            ]);
            
            if (profileRes.error) throw new Error(profileRes.error.message);
            setCurrentUserProfile(profileRes.data);

            if (reportRes.error) throw new Error(reportRes.error.message);
            // 这里使用了断言，因为 Supabase 的类型推断可能还没有更新关联字段
            setReport(reportRes.data as unknown as ReportWithRelations); 

            if (expensesRes.error) throw new Error(expensesRes.error.message);
            setExpenses(expensesRes.data || []);
            
            if (customersRes.error) throw new Error(customersRes.error.message);
            setCustomers(customersRes.data || []);

        } catch (err: any) {
            console.error("Error:", err);
            setError(err.message || "加载失败");
        } finally {
            setLoading(false);
        }
    }, [reportId, supabase]);

    useEffect(() => {
        fetchPageData();
    }, [fetchPageData]);

    // --- 删除整个报销单逻辑 ---
    const deleteReport = async () => {
        if (!report || !window.confirm('⚠️ 警告：确定永久删除此报销单吗？\n\n关联的所有费用明细和发票文件都将被永久删除，且无法恢复！')) return;
        
        setIsProcessing(true);
        try {
            const response = await fetch('/api/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'report', id: report.id }),
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.error || '删除失败');

            alert('报销单已删除');
            router.push('/dashboard'); 
        } catch (err: any) {
            alert(`删除失败: ${err.message}`);
            setIsProcessing(false);
        }
    };

    // --- 删除单笔费用逻辑 ---
    const deleteExpense = async (expenseId: number) => {
        if (!window.confirm('确定删除这笔费用吗？关联的发票图片也将被同步删除。')) return;

        setIsProcessing(true); 
        try {
            const response = await fetch('/api/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'expense', id: expenseId }),
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.error || '删除失败');

            await fetchPageData(); 
        } catch (err: any) {
            alert(`删除费用失败: ${err.message}`);
        } finally {
            setIsProcessing(false);
        }
    };

    return {
        report,
        setReport,
        expenses,
        customers,
        user,
        currentUserProfile,
        loading,
        error,
        isProcessing,
        fetchPageData,
        deleteReport,
        deleteExpense
    };
}