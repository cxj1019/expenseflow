// src/app/approval/page.tsx


'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useApprovalData } from '@/hooks/useApprovalData';
import { ApprovalReportCard } from '@/components/approval/ApprovalReportCard';

// 骨架屏组件
const SkeletonCard = () => (
    <div className="bg-white p-4 border rounded-lg h-full animate-pulse">
        <div className="h-5 bg-gray-200 rounded w-3/4 mb-3"></div>
        <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
        <div className="flex justify-between items-end mt-2 pt-2 border-t border-gray-100">
            <div className="h-4 bg-gray-200 rounded w-1/3"></div>
            <div className="h-6 bg-gray-300 rounded w-1/4"></div>
        </div>
    </div>
);

export default function ApprovalPage() {
    const { profile, pendingReports, processedReports, loading, error } = useApprovalData();
    const [activeTab, setActiveTab] = useState('pending');
    const [searchTerm, setSearchTerm] = useState('');

    const filteredProcessedReports = processedReports.filter(report => 
        report.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        report.profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (error) {
        return (
            <div className="flex flex-col justify-center items-center min-h-screen text-center">
                <h1 className="text-3xl font-bold text-red-600">加载失败</h1>
                <p className="text-gray-600 mt-2">{error}</p>
                <Link href="/dashboard" className="mt-6 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">返回仪表盘</Link>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-100">
                <header className="bg-white shadow-sm"><div className="container mx-auto px-6 py-4 h-16"></div></header>
                <main className="container mx-auto p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
                    </div>
                </main>
            </div>
        );
    }
    
    if (!profile || !['manager', 'partner', 'admin'].includes(profile.role)) {
        return (
            <div className="flex flex-col justify-center items-center min-h-screen text-center">
                <h1 className="text-3xl font-bold text-red-600">访问被拒绝</h1>
                <p className="text-gray-600 mt-2">您没有权限访问此页面。</p>
                <Link href="/dashboard" className="mt-6 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">返回仪表盘</Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100">
            <header className="bg-white shadow-sm sticky top-0 z-10">
                <nav className="container mx-auto px-6 py-4 flex justify-between items-center">
                    <h1 className="text-xl font-bold text-gray-800">审批中心 <span className="text-sm font-normal text-gray-500">({profile.role})</span></h1>
                    <Link href="/dashboard" className="text-blue-600 hover:underline">返回仪表盘</Link>
                </nav>
                 {/* Tab 切换 */}
                <div className="container mx-auto px-6 border-b border-gray-200">
                    <div className="flex space-x-4">
                        <button onClick={() => setActiveTab('pending')} className={`py-3 px-1 font-semibold transition-colors duration-200 ${activeTab === 'pending' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-blue-600'}`}>
                            待处理 ({pendingReports.length})
                        </button>
                        <button onClick={() => setActiveTab('processed')} className={`py-3 px-1 font-semibold transition-colors duration-200 ${activeTab === 'processed' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-blue-600'}`}>
                            已处理
                        </button>
                    </div>
                </div>
            </header>
            
            <main className="container mx-auto p-6">
                {activeTab === 'pending' ? (
                    <div>
                        {pendingReports.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {pendingReports.map(report => <ApprovalReportCard key={report.id} report={report} />)}
                            </div>
                        ) : <div className="text-center py-16 bg-white rounded-lg shadow-sm"><p className="text-gray-500">太棒了，所有报销单都处理完了！</p></div>}
                    </div>
                ) : (
                    <div>
                        <div className="mb-4">
                            <input
                                type="text"
                                placeholder="搜索标题或提交人..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full max-w-sm px-4 py-2 border rounded-lg shadow-sm"
                            />
                        </div>
                        {filteredProcessedReports.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {filteredProcessedReports.map(report => <ApprovalReportCard key={report.id} report={report} />)}
                            </div>
                        ) : <div className="text-center py-16 bg-white rounded-lg shadow-sm"><p className="text-gray-500">没有找到匹配的已处理报销单。</p></div>}
                    </div>
                )}
            </main>
        </div>
    );
}