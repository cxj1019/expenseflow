// src/hooks/useApprovalData.ts
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import type { Database } from '@/types/database.types';

// 类型定义
type Profile = Database['public']['Tables']['profiles']['Row'];
type Report = Database['public']['Tables']['reports']['Row'];
export type ReportWithProfile = Report & { profiles: Profile | null };

export function useApprovalData() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [pendingReports, setPendingReports] = useState<ReportWithProfile[]>([]);
  const [processedReports, setProcessedReports] = useState<ReportWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClientComponentClient<Database>();

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/');
        return;
      }

      const { data: profileData, error: profileError } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      
      // ** 关键修改点：将 throw new Error 改为更明确的 return **
      // 这能帮助 TypeScript 正确地进行类型收窄
      if (profileError || !profileData) {
          setError("无法获取用户信息。");
          setLoading(false); // 在退出前确保 loading 状态被更新
          return;          // 使用 return 明确地退出函数
      }

      // 经过上面的 return 判断后，TypeScript 在这里就能确定 profileData 是有值的
      setProfile(profileData);
      
      // 检查权限
      if (!['manager', 'partner'].includes(profileData.role)) {
        setLoading(false);
        return; // 没有权限，同样明确退出
      }

      // 使用 Promise.all 并行获取数据，速度更快
      const [pendingRes, processedRes] = await Promise.all([
        supabase.rpc('get_reports_for_approval').select('*, profiles!user_id(*)'),
        (() => {
            let query = supabase
                .from('reports')
                .select('*, profiles!user_id(*)')
                .in('status', ['approved', 'rejected', 'send_back'])
                .order('final_approved_at', { ascending: false, nullsFirst: false })
                .limit(50);
            if (profileData && profileData.role !== 'admin') {
                // 非 admin 用户可以看到他们作为一级或最终审批人的所有单据
                query = query.or(`primary_approver_id.eq.${user.id},final_approver_id.eq.${user.id}`);
            }
            return query;
        })()
      ]);

      if (pendingRes.error) {
        console.error('获取待审批列表失败:', pendingRes.error);
        // 即使失败，也设置为空数组，避免UI崩溃
        setPendingReports([]); 
      } else {
        setPendingReports(pendingRes.data as ReportWithProfile[]);
      }

      if (processedRes.error) {
        console.error('获取已审批列表失败:', processedRes.error);
        setProcessedReports([]);
      } else {
        setProcessedReports(processedRes.data as ReportWithProfile[]);
      }

    } catch (e: unknown) {
        // 这个 catch 用于捕获 Promise.all 中可能出现的其他意外错误
        if (e instanceof Error) {
            setError(e.message);
        } else {
            setError('An unknown error occurred');
        }
    } finally {
        setLoading(false);
    }
  }, [supabase, router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { profile, pendingReports, processedReports, loading, error };
}