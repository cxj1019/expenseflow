// src/hooks/useFinanceData.ts
'use client'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import type { Database } from '@/types/database.types';

type Profile = Database['public']['Tables']['profiles']['Row'];
type Report = Database['public']['Tables']['reports']['Row'];
export type ReportWithProfile = Report & { profiles: Profile | null };

export function useFinanceData() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [reports, setReports] = useState<ReportWithProfile[]>([]);
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
      if (profileError || !profileData) {
        setError("无法获取用户信息。");
        setLoading(false);
        return;
      }
      setProfile(profileData);
      
      // ** 权限检查：只允许 admin 访问 **
      if (profileData && profileData.role !== 'admin') {
        setLoading(false);
        return;
      }

      const { data, error: reportsError } = await supabase
        .from('reports')
        .select('*, profiles!user_id(*)')
        .eq('status', 'approved') // 只获取已批准的报销单
        .order('final_approved_at', { ascending: true }); // 按批准时间升序

      if(reportsError) {
        throw reportsError;
      }

      setReports(data as ReportWithProfile[]);

    } catch (e: unknown) {
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
  
  // 暴露 fetchData 函数，以便在更新后手动刷新
  return { profile, reports, loading, error, fetchData };
}