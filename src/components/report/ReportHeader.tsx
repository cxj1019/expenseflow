// src/components/report/ReportHeader.tsx

'use client';

import Link from 'next/link';
import { FaPrint } from 'react-icons/fa';
import type { Database } from '@/types/database.types';
import type { ReportWithRelations } from '@/hooks/useReportData';

type Profile = Database['public']['Tables']['profiles']['Row'];

// 1. 更新 StatusBadge，增加 'client' 类型支持
const StatusBadge = ({ text, type }: { text: string | undefined, type: 'status' | 'financial' | 'client' | 'default' }) => {
    const baseClasses = "px-2 py-0.5 text-xs font-semibold rounded-full border"; // 增加 border 让标签更精致
    let typeClasses = "";

    if (type === 'status') {
        switch (text) {
            case 'draft': typeClasses = 'bg-gray-100 text-gray-700 border-gray-200'; break;
            case 'submitted': typeClasses = 'bg-yellow-50 text-yellow-700 border-yellow-200'; break;
            case 'pending_partner_approval': typeClasses = 'bg-purple-50 text-purple-700 border-purple-200'; break;
            case 'approved': typeClasses = 'bg-green-50 text-green-700 border-green-200'; break;
            default: typeClasses = 'bg-gray-100 text-gray-700 border-gray-200';
        }
    } else if (type === 'financial') {
        typeClasses = text?.includes('已') 
            ? 'bg-blue-50 text-blue-700 border-blue-200' 
            : 'bg-gray-100 text-gray-500 border-gray-200';
    } else if (type === 'client') {
        // ✅ 新增：客户请款标签样式 (靛蓝色)
        typeClasses = 'bg-indigo-50 text-indigo-700 border-indigo-200';
    } else {
        typeClasses = 'bg-gray-100 text-gray-800 border-gray-200';
    }

    return <span className={`${baseClasses} ${typeClasses}`}>{text}</span>;
}

interface ReportHeaderProps {
    report: ReportWithRelations | null;
    currentUserProfile: Profile | null;
    isOwner: boolean;
    isDraft: boolean;
    canWithdraw: boolean;
    canApprove: boolean;
    canExportPdf: boolean;
    isAdminView: boolean;
    isApproverView: boolean;
    isProcessing: boolean;
    editableTitle: string;
    onTitleChange: (newTitle: string) => void;
    onTitleUpdate: () => void;
    onGeneratePdf: () => void;
    onPrint?: () => void;
    onApprovalDecision: (decision: 'approved' | 'send_back' | 'forward_to_partner') => void;
    onWithdraw: () => void;
    onSubmit: () => void;
    onDelete: () => void;
}

export const ReportHeader = ({
    report,
    currentUserProfile,
    isOwner,
    isDraft,
    canWithdraw,
    canApprove,
    canExportPdf,
    isAdminView,
    isApproverView,
    isProcessing,
    editableTitle,
    onTitleChange,
    onTitleUpdate,
    onGeneratePdf,
    onPrint,
    onApprovalDecision,
    onWithdraw,
    onSubmit,
    onDelete
}: ReportHeaderProps) => {

    if (!report) {
        return (
            <header className="bg-white shadow-sm animate-pulse">
                <div className="container mx-auto px-6 py-4">
                    <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
                    <div className="h-8 bg-gray-300 rounded w-1/2 mb-3"></div>
                    <div className="flex gap-4">
                        <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                        <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                    </div>
                </div>
            </header>
        );
    }

    let backLinkHref = "/dashboard";
    let backLinkText = "返回仪表盘";
    if (isAdminView) {
        backLinkHref = "/finance";
        backLinkText = "返回财务中心";
    } else if (isApproverView) {
        backLinkHref = "/approval";
        backLinkText = "返回审批中心";
    }
    
    return (
        <header className="bg-white shadow-sm">
            <div className="container mx-auto px-6 py-4 flex justify-between items-start flex-wrap gap-4">
                <div className="flex-grow min-w-[300px]">
                    <Link href={backLinkHref} className="text-sm text-blue-600 hover:underline">
                        &larr; {backLinkText}
                    </Link>
                    
                    {isOwner && isDraft ? (
                        <div className="mt-2">
                            <input
                                type="text"
                                value={editableTitle}
                                onChange={(e) => onTitleChange(e.target.value)}
                                onBlur={onTitleUpdate}
                                className="text-3xl font-bold text-gray-800 p-1 border-b-2 border-transparent focus:border-blue-500 outline-none w-full transition-colors"
                                disabled={isProcessing}
                                placeholder="请输入报销单标题"
                            />
                        </div>
                    ) : (
                        <h1 className="text-3xl font-bold text-gray-800 mt-2">{report.title}</h1>
                    )}

                    <div className="text-gray-500 mt-3 space-y-2 text-sm">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                            <span>状态: <StatusBadge text={report.status} type="status" /></span>
                            
                            {/* ✅ 2. 新增：显示客户请款标记 */}
                            {report.bill_to_customer && (
                                <StatusBadge 
                                    text={`向客户请款: ${report.customer_name || '未填写'}`} 
                                    type="client" 
                                />
                            )}
                            
                            <span className="text-gray-300">|</span>
                            <span>提交人: <span className="font-semibold text-gray-700">{report.profiles?.full_name || 'N/A'}</span></span>
                        </div>
                        
                        {report.primary_approver_id && (
                            <p>一级审批: <span className="font-semibold text-gray-700">{report.primary_approver?.full_name}</span> 于 {new Date(report.primary_approved_at!).toLocaleString()}</p>
                        )}
                        {report.final_approver_id && report.status === 'approved' && (
                            <p>最终批准: <span className="font-semibold text-gray-700">{report.final_approver?.full_name}</span> 于 {new Date(report.final_approved_at!).toLocaleString()}</p>
                        )}
                        {report.status === 'approved' && (
                            <div className="flex items-center gap-x-4 gap-y-1">
                                <StatusBadge text={`发票: ${report.is_invoice_received ? '已收到' : '未收到'}`} type="financial" />
                                <StatusBadge text={`付款: ${report.is_paid ? '已支付' : '未支付'}`} type="financial" />
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-start space-x-2 flex-wrap gap-y-2 pt-2">
                    <button 
                        onClick={onPrint}
                        className="flex items-center gap-1 px-4 py-2 font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
                    >
                        <FaPrint /> 打印凭单
                    </button>

                    {canExportPdf && (<button onClick={onGeneratePdf} className="px-4 py-2 font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700">导出请求书</button>)}
                    
                    {canApprove && !isAdminView && (
                        <>
                            <button onClick={() => onApprovalDecision('approved')} disabled={isProcessing} className="px-4 py-2 font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:bg-gray-400">批准</button>
                            {currentUserProfile?.role === 'manager' && report.status === 'submitted' && (
                                <button onClick={() => onApprovalDecision('forward_to_partner')} disabled={isProcessing} className="px-4 py-2 font-semibold text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:bg-gray-400">批准并转交</button>
                            )}
                            <button onClick={() => onApprovalDecision('send_back')} disabled={isProcessing} className="px-4 py-2 font-semibold text-white bg-gray-600 rounded-lg hover:bg-gray-700 disabled:bg-gray-400">退回修改</button>
                        </>
                    )}

                    {canWithdraw && (<button onClick={onWithdraw} disabled={isProcessing} className="px-4 py-2 font-semibold text-white bg-yellow-600 rounded-lg hover:bg-yellow-700 disabled:bg-gray-400">{isProcessing ? '处理中...' : '撤回'}</button>)}
                    
                    {isOwner && isDraft && (
                        <>
                            <button onClick={onSubmit} disabled={isProcessing} className="px-4 py-2 font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:bg-gray-400">提交审批</button>
                            <button onClick={onDelete} disabled={isProcessing} className="px-4 py-2 font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:bg-gray-400">删除</button>
                        </>
                    )}
                </div>
            </div>
        </header>
    );
};