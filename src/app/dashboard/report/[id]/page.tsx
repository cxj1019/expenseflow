// src/app/dashboard/report/[id]/page.tsx

'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import Link from 'next/link';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import imageCompression from 'browser-image-compression';

import type { Database } from '@/types/database.types';
import { useReportData } from '@/hooks/useReportData';
import { ReportHeader } from '@/components/report/ReportHeader';
import { AdminPanel } from '@/components/report/AdminPanel';
import { ReportMetadataForm } from '@/components/report/ReportMetadataForm';
import { AddExpenseForm } from '@/components/report/AddExpenseForm';
import { ExpenseList } from '@/components/report/ExpenseList';
import { RequestFormPDF } from '@/components/report/RequestFormPDF';
import { ReimbursementVoucher } from '@/components/report/ReimbursementVoucher';

// 定义包含 Profile 信息的扩展报表类型
type ReportWithProfile = Database['public']['Tables']['reports']['Row'] & {
  profiles: {
    full_name: string | null;
    department: string | null;
    role: string | null;
  } | null;
};

type Expense = Database['public']['Tables']['expenses']['Row'];

export default function ReportDetailPage() {
    const supabase = createClientComponentClient<Database>();
    const router = useRouter();
    
    const { 
        report, setReport, expenses, customers, user, currentUserProfile, 
        loading, error, fetchPageData,
        deleteReport, deleteExpense, isProcessing: hookIsProcessing 
    } = useReportData();
    
    const [localIsProcessing, setLocalIsProcessing] = useState(false);
    const isProcessing = localIsProcessing || hookIsProcessing;
    const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);

    const [editableTitle, setEditableTitle] = useState('');
    const [reportCustomerName, setReportCustomerName] = useState('');
    const [reportBillToCustomer, setReportBillToCustomer] = useState(false);
    const [invoiceReceived, setInvoiceReceived] = useState(false);
    const [isPaid, setIsPaid] = useState(false);
    
    const [editingExpenseId, setEditingExpenseId] = useState<number | null>(null);
    const [editingExpenseData, setEditingExpenseData] = useState<Partial<Expense>>({});
    const [editingNewFiles, setEditingNewFiles] = useState<File[]>([]);
    
    const pdfRef = useRef<HTMLDivElement>(null);

    const fullReport = report as unknown as ReportWithProfile | null;

    useEffect(() => {
        if (report) {
            setEditableTitle(report.title || '');
            setReportCustomerName(report.customer_name || '');
            setReportBillToCustomer(report.bill_to_customer || false);
            setInvoiceReceived(report.is_invoice_received || false);
            setIsPaid(report.is_paid || false);
        }
    }, [report]);

    // --- 权限逻辑 ---
    const isOwner = user?.id === report?.user_id;
    const isDraft = report?.status === 'draft';
    const canWithdraw = isOwner && ['submitted', 'pending_partner_approval'].includes(report?.status || '');
    const isAdminView = currentUserProfile?.role === 'admin';
    const isApproverView = currentUserProfile && !isOwner && ['manager', 'partner'].includes(currentUserProfile.role || '');

    const submitterRole = fullReport?.profiles?.role;
    const submitterDept = fullReport?.profiles?.department;
    const myRole = currentUserProfile?.role;
    const myDept = currentUserProfile?.department;

    const canApprove = report && currentUserProfile && !isOwner && (
        (myRole === 'manager' && report.status === 'submitted' && submitterRole === 'employee' && submitterDept === myDept) ||
        (myRole === 'partner' && (
            (submitterDept === myDept && ['employee', 'manager'].includes(submitterRole || '') && ['submitted', 'pending_partner_approval'].includes(report.status)) ||
            (submitterRole === 'partner' && submitterDept !== myDept && report.status === 'submitted')
        ))
    );

    const canExportPdf = report?.status === 'approved' && report.bill_to_customer;

    const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
        setNotification({ message, type });
        const duration = type === 'error' ? 10000 : 3000;
        setTimeout(() => setNotification(null), duration);
    };

    const compressAndUploadFile = async (file: File): Promise<string> => {
        const options = { maxSizeMB: 0.8, maxWidthOrHeight: 1920, useWebWorker: true, fileType: 'image/jpeg' };
        let fileToUpload = file;
        if (file.type.startsWith('image/')) {
            try { fileToUpload = await imageCompression(file, options); } catch (e) {}
        }
        const presignRes = await fetch('/api/upload-r2', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileType: fileToUpload.type }),
        });
        if (!presignRes.ok) throw new Error('获取上传凭证失败');
        const { uploadUrl, accessUrl } = await presignRes.json();
        const uploadRes = await fetch(uploadUrl, { method: 'PUT', body: fileToUpload, headers: { 'Content-Type': fileToUpload.type } });
        if (!uploadRes.ok) throw new Error('上传云存储失败');
        return accessUrl;
    };

    // --- Event Handlers ---
    const handlePrint = useCallback(() => { window.print(); }, []);
    const handleExpenseAdded = useCallback(() => { showNotification('费用添加成功'); fetchPageData(); }, [fetchPageData]);
    
    const handleTitleUpdate = useCallback(async () => {
        if (!report || !editableTitle.trim()) return;
        setLocalIsProcessing(true);
        const { error } = await supabase.from('reports').update({ title: editableTitle.trim() } as any).eq('id', report.id);
        if (error) showNotification(`标题更新失败: ${error.message}`, 'error');
        else { showNotification('标题已更新'); fetchPageData(); }
        setLocalIsProcessing(false);
    }, [report, editableTitle, supabase, fetchPageData]);

    const handleUpdateReportCustomerInfo = useCallback(async () => {
        if (!report) return;
        setLocalIsProcessing(true);
        const { error } = await supabase.from('reports').update({
            customer_name: reportCustomerName, bill_to_customer: reportBillToCustomer
        } as any).eq('id', report.id);
        if (error) showNotification(`更新失败: ${error.message}`, 'error');
        else { showNotification('客户信息已保存'); fetchPageData(); }
        setLocalIsProcessing(false);
    }, [report, reportCustomerName, reportBillToCustomer, supabase, fetchPageData]);

    const handleSubmitForApproval = useCallback(async () => {
        if (!report || expenses.length === 0) return showNotification('无费用条目，无法提交', 'error');
        if (!window.confirm('确定提交审批吗？提交后无法修改。')) return;
        setLocalIsProcessing(true);
        try {
            const total = expenses.reduce((sum, exp) => sum + exp.amount, 0);
            const { data, error } = await supabase.from('reports').update({ status: 'submitted', submitted_at: new Date().toISOString(), total_amount: total } as any).eq('id', report.id).select().single();
            if (error) throw error;
            setReport(data); showNotification('已提交审批');
        } catch (err: any) { showNotification(`提交失败: ${err.message}`, 'error'); } 
        finally { setLocalIsProcessing(false); }
    }, [report, expenses, supabase, setReport]);

    // ✅【已修复】撤回时同时清空提交时间和审批信息
    const handleWithdrawReport = useCallback(async () => {
        if (!report || !window.confirm('确定撤回吗？')) return;
        setLocalIsProcessing(true);
        
        const { data, error } = await supabase.from('reports').update({ 
            status: 'draft',
            submitted_at: null,          // 清空提交时间
            primary_approved_at: null,   // 清空一级审批时间
            final_approved_at: null,     // 清空二级审批时间
            primary_approver_id: null,   // 清空一级审批人
            final_approver_id: null      // 清空二级审批人
        } as any).eq('id', report.id).select().single();

        if (error) showNotification(`撤回失败: ${error.message}`, 'error');
        else { setReport(data); showNotification('报销单已撤回'); }
        setLocalIsProcessing(false);
    }, [report, supabase, setReport]);

    const handleApprovalDecision = useCallback(async (decision: 'approved' | 'send_back' | 'forward_to_partner') => {
        if (!report || !currentUserProfile || !window.confirm('确定执行此操作吗？')) return;
        setLocalIsProcessing(true);
        try {
            let nextStatus = '';
            const updates: Partial<Database['public']['Tables']['reports']['Row']> = {};
            if (decision === 'approved') {
                if(currentUserProfile.role === 'manager') {
                    nextStatus = 'pending_partner_approval'; updates.primary_approver_id = currentUserProfile.id; updates.primary_approved_at = new Date().toISOString();
                } else if (currentUserProfile.role === 'partner') {
                    nextStatus = 'approved'; updates.final_approver_id = currentUserProfile.id; updates.final_approved_at = new Date().toISOString();
                }
            } else if (decision === 'send_back') nextStatus = 'draft';
            else if (decision === 'forward_to_partner') nextStatus = 'pending_partner_approval';
            updates.status = nextStatus;
            await supabase.from('approvals').insert({ report_id: report.id, approver_id: currentUserProfile.id, status: decision } as any);
            const { data, error } = await supabase.from('reports').update(updates as any).eq('id', report.id).select().single();
            if (error) throw error;
            setReport(data); showNotification('操作成功'); fetchPageData();
        } catch (err: any) { showNotification(`操作失败: ${err.message}`, 'error'); } 
        finally { setLocalIsProcessing(false); }
    }, [report, currentUserProfile, supabase, setReport, fetchPageData]);
    
    const handleGeneratePdf = useCallback(async () => {
        if (!pdfRef.current || !report) {
            console.error("PDF生成失败: 元素未挂载或数据缺失");
            showNotification("PDF生成失败: 页面元素未就绪", 'error');
            return;
        }
        setLocalIsProcessing(true);
        try {
            console.log("开始生成 PDF...");
            const canvas = await html2canvas(pdfRef.current, { 
                scale: 2, 
                useCORS: true, 
                logging: false, 
                allowTaint: false, 
                backgroundColor: '#ffffff' 
            });
            console.log("Canvas 生成成功，转换为图片...");
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({ orientation: 'p', unit: 'px', format: [canvas.width, canvas.height] });
            pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
            pdf.save(`报销单-${report.title}.pdf`);
            showNotification("PDF 导出成功");
        } catch(err: any) { 
            console.error("PDF生成异常:", err); 
            showNotification(`PDF生成失败: ${err.message || '未知错误'}`, 'error'); 
        } 
        finally { setLocalIsProcessing(false); }
    }, [report]);

    const handleEditExpense = useCallback((expense: Expense) => {
        setEditingExpenseId(expense.id); setEditingExpenseData(expense); setEditingNewFiles([]);
    }, []);
    const handleCancelEdit = useCallback(() => {
        setEditingExpenseId(null); setEditingExpenseData({}); setEditingNewFiles([]);
    }, []);
    const handleUpdateExpense = useCallback(async () => {
        if (!editingExpenseId || !user) return;
        setLocalIsProcessing(true);
        try {
            const newUploadedUrls: string[] = [];
            for (const file of editingNewFiles) { newUploadedUrls.push(await compressAndUploadFile(file)); }
            const finalUrls = [...(editingExpenseData.receipt_urls || []), ...newUploadedUrls];
            const updates = { ...editingExpenseData, receipt_urls: finalUrls.length > 0 ? finalUrls : null };
            const { error } = await supabase.from('expenses').update(updates as any).eq('id', editingExpenseId);
            if (error) throw error;
            showNotification('费用条目已更新'); handleCancelEdit(); fetchPageData();
        } catch (err: any) { showNotification(`更新失败: ${err.message}`, 'error'); } 
        finally { setLocalIsProcessing(false); }
    }, [editingExpenseId, user, editingNewFiles, editingExpenseData, supabase, fetchPageData, handleCancelEdit]);

    const handleAdminStatusUpdate = async () => {
        if (!report) return;
        setLocalIsProcessing(true);
        const updates = { is_invoice_received: invoiceReceived, is_paid: isPaid };
        const { error } = await supabase.from('reports').update(updates as any).eq('id', report.id);
        if (error) showNotification('状态更新失败', 'error'); else { showNotification('状态已更新'); fetchPageData(); }
        setLocalIsProcessing(false);
    };

    if (loading) return <div className="flex justify-center items-center min-h-screen">加载中...</div>;
    if (error) return <div className="p-4 text-center">{error} <Link href="/dashboard">返回</Link></div>;
    if (!report || !user || !currentUserProfile) return <div className="p-4 text-center">无数据</div>;
    
    return (
        <>
            <div className="min-h-screen bg-gray-100">
                <ReportHeader
                    report={report} currentUserProfile={currentUserProfile} isOwner={isOwner}
                    isDraft={isDraft} canWithdraw={canWithdraw} canApprove={canApprove}
                    canExportPdf={canExportPdf} isAdminView={isAdminView} isApproverView={isApproverView}
                    isProcessing={isProcessing} editableTitle={editableTitle}
                    onTitleChange={setEditableTitle} onTitleUpdate={handleTitleUpdate}
                    onGeneratePdf={handleGeneratePdf} onApprovalDecision={handleApprovalDecision}
                    onWithdraw={handleWithdrawReport} onSubmit={handleSubmitForApproval}
                    onDelete={deleteReport} onPrint={handlePrint}
                />
                
                {notification && (
                    <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-[100] px-6">
                        <div className={`p-4 rounded-md text-sm shadow-lg border ${notification.type === 'success' ? 'bg-green-100 text-green-800 border-green-200' : 'bg-red-100 text-red-800 border-red-200'}`}>
                            {notification.message}
                        </div>
                    </div>
                )}

                <main className="container mx-auto p-6">
                    <div className={isDraft && isOwner ? "grid grid-cols-1 md:grid-cols-3 gap-8" : ""}>
                        {isDraft && isOwner && (
                            <div className="md:col-span-1 space-y-6">
                                <ReportMetadataForm
                                    customers={customers} reportCustomerName={reportCustomerName}
                                    onCustomerNameChange={setReportCustomerName} billToCustomer={reportBillToCustomer}
                                    onBillToCustomerChange={setReportBillToCustomer} onSave={handleUpdateReportCustomerInfo}
                                    isProcessing={isProcessing}
                                />
                                <AddExpenseForm
                                    reportId={report.id} user={user}
                                    customers={customers} onExpenseAdded={handleExpenseAdded}
                                />
                            </div>
                        )}
                        <div className={isDraft && isOwner ? "md:col-span-2 space-y-6" : "space-y-6"}>
                             {isAdminView && (
                                <AdminPanel
                                    invoiceReceived={invoiceReceived} onInvoiceReceivedChange={(e) => setInvoiceReceived(e.target.checked)}
                                    isPaid={isPaid} onIsPaidChange={(e) => setIsPaid(e.target.checked)}
                                    canMarkAsPaid={invoiceReceived} onSave={handleAdminStatusUpdate} isProcessing={isProcessing}
                                />
                            )}
                            <ExpenseList
                                report={report} expenses={expenses} isOwner={isOwner} isDraft={isDraft} isProcessing={isProcessing}
                                editingExpenseId={editingExpenseId} editingExpenseData={editingExpenseData}
                                setEditingExpenseData={setEditingExpenseData} onEditExpense={handleEditExpense}
                                onCancelEdit={handleCancelEdit} onUpdateExpense={handleUpdateExpense}
                                onDeleteExpense={(expense) => deleteExpense(expense.id)} 
                                customers={customers}
                                editingNewFiles={editingNewFiles} setEditingNewFiles={setEditingNewFiles}
                            />
                        </div>
                    </div>
                </main>
            </div>
            
            <div style={{ position: 'absolute', top: 0, left: '-9999px', width: '210mm', overflow: 'hidden' }}>
                 <div ref={pdfRef}>
                    <RequestFormPDF 
                        report={report} 
                        expenses={expenses || []} 
                        submitterName={fullReport?.profiles?.full_name || user?.email || ''} 
                    />
                </div>
            </div>
            <ReimbursementVoucher report={report} expenses={expenses} ref={null} />
        </>
    );
}