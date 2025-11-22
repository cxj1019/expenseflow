// src/app/finance/page.tsx


'use client'
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useFinanceData } from '@/hooks/useFinanceData';
import { FinanceReportCard } from '@/components/finance/FinanceReportCard';
import type { Database } from '@/types/database.types';

export default function FinancePage() {
    const { profile, reports, loading, error, fetchData } = useFinanceData();
    const [activeTab, setActiveTab] = useState('awaiting-payment');
    const [searchTerm, setSearchTerm] = useState('');
    const supabase = createClientComponentClient<Database>();

    const filteredReports = useMemo(() => {
        return reports
            .filter(r => {
                if (activeTab === 'awaiting-invoice') return !r.is_invoice_received;
                if (activeTab === 'awaiting-payment') return r.is_invoice_received && !r.is_paid;
                if (activeTab === 'completed') return r.is_paid;
                return true;
            })
            .filter(r => 
                r.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                r.profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
            );
    }, [reports, activeTab, searchTerm]);
    
    const handleUpdateReport = async (reportId: number, updates: { is_invoice_received: boolean; is_paid: boolean }) => {
        const { error } = await supabase.from('reports').update(updates as any).eq('id', reportId);
        if (error) alert('更新失败: ' + error.message);
        else await fetchData();
    };

    if (error) {
        return (
            <div className="flex flex-col justify-center items-center min-h-screen text-center p-4">
                <h1 className="text-3xl font-bold text-red-600">加载失败</h1>
                <p className="text-gray-600 mt-2">{error}</p>
                <Link href="/dashboard" className="mt-6 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">返回仪表盘</Link>
            </div>
        );
    }

    if (loading) return <div className="p-6">正在加载财务中心...</div>
    
    if (!profile || profile.role !== 'admin') {
        return (
            <div className="flex flex-col justify-center items-center min-h-screen text-center p-4">
                <h1 className="text-3xl font-bold text-red-600">访问被拒绝</h1>
                <p className="text-gray-600 mt-2">只有管理员才能访问财务中心。</p>
                <Link href="/dashboard" className="mt-6 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">返回仪表盘</Link>
            </div>
        );
    }
    
    const TabButton = ({ tabName, label, count }: { tabName: string, label: string, count: number }) => (
        <button onClick={() => setActiveTab(tabName)} className={`py-3 px-2 sm:px-4 font-semibold transition-colors duration-200 flex items-center gap-2 text-sm sm:text-base ${activeTab === tabName ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500 hover:text-indigo-600'}`}>
            {label}
            <span className={`px-2 py-0.5 rounded-full text-xs ${activeTab === tabName ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-200 text-gray-700'}`}>{count}</span>
        </button>
    );

    return (
        <div className="min-h-screen bg-gray-50">
            <header className="bg-white shadow-sm sticky top-0 z-10">
                <nav className="container mx-auto px-4 sm:px-6 py-4 flex justify-between items-center">
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-800">财务中心</h1>
                    <Link href="/dashboard" className="text-blue-600 hover:underline">返回仪表盘</Link>
                </nav>
                <div className="container mx-auto px-4 sm:px-6 border-b border-gray-200">
                    <div className="flex space-x-2 sm:space-x-4">
                        <TabButton tabName="awaiting-payment" label="待付款" count={reports.filter(r => r.is_invoice_received && !r.is_paid).length} />
                        <TabButton tabName="awaiting-invoice" label="待收发票" count={reports.filter(r => !r.is_invoice_received).length} />
                        <TabButton tabName="completed" label="已完成" count={reports.filter(r => r.is_paid).length} />
                    </div>
                </div>
            </header>

            <main className="container mx-auto p-4 sm:p-6 space-y-6">
                <input
                    type="text"
                    placeholder="按标题或提交人搜索..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full max-w-lg px-4 py-2 border rounded-lg shadow-sm"
                />
                
                <div className="space-y-4">
                    {filteredReports.length > 0 ? (
                        filteredReports.map(report => (
                            <FinanceReportCard key={report.id} report={report} onUpdate={handleUpdateReport} />
                        ))
                    ) : (
                        <div className="text-center py-16 bg-white rounded-lg shadow-sm">
                            <p className="text-gray-500">当前分类下没有报销单。</p>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}