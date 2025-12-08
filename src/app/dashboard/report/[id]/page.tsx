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

type Report = Database['public']['Tables']['reports']['Row'];
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

    useEffect(() => {
        if (report) {
            setEditableTitle(report.title || '');
            setReportCustomerName(report.customer_name || '');
            setReportBillToCustomer(report.bill_to_customer || false);
            setInvoiceReceived(report.is_invoice_received || false);
            setIsPaid(report.is_paid || false);
        }
    }, [report]);

    // --- 权限逻辑 (核心修改部分) ---
    const isOwner = user?.id === report?.user_id;
    const isDraft = report?.status === 'draft';
    
    // 只有在未完全批准前可以撤回
    const canWithdraw = isOwner && ['submitted', 'pending_partner_approval'].includes(report?.status || '');
    
    const isAdminView = currentUserProfile?.role === 'admin';
    const isApproverView = currentUserProfile && !isOwner && ['manager', 'partner'].includes(currentUserProfile.role || '');

    // 获取提交人的角色和部门 (从 report.profiles 关联数据中获取)
    // @ts-ignore - 假设 useReportData 的查询中包含了 profiles 联表数据
    const submitterRole = report?.profiles?.role;
    // @ts-ignore
    const submitterDept = report?.profiles?.department;
    
    const myRole = currentUserProfile?.role;
    const myDept = currentUserProfile?.department;

    // ✅ 核心：审批按钮显示逻辑
    const canApprove = report && currentUserProfile && !isOwner && (
        // 1. 经理审批: 本部门员工 + 已提交状态
        (
            myRole === 'manager' && 
            report.status === 'submitted' && 
            submitterRole === 'employee' && 
            submitterDept === myDept
        ) ||
        // 2. 合伙人审批
        (
            myRole === 'partner' && (
                // A: 本部门所有下属 (员工或经理) 的待处理单据
                //    包括 submitted (直接审批) 和 pending_partner_approval (二级审批)
                (
                    submitterDept === myDept && 
                    ['employee', 'manager'].includes(submitterRole) &&
                    ['submitted', 'pending_partner_approval'].includes(report.status)
                ) ||
                // B: 其他部门合伙人的单据
                (
                    submitterRole === 'partner' &&
                    submitterDept !== myDept &&
                    report.status === 'submitted'
                )
            )
        )
    );

    const canExportPdf = report?.status === 'approved' && report.bill_to_customer;

    const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 5000);
    };

    // --- 辅助函数 ---
    const compressAndUploadFile = async (file: File): Promise<string> => {
        const options = {
            maxSizeMB: 0.8, maxWidthOrHeight: 1920, useWebWorker: true, fileType: 'image/jpeg'
        };
        
        let fileToUpload = file;
        if (file.type.startsWith('image/')) {
            try {
                fileToUpload = await imageCompression(file, options);
            } catch (err) {
                console.error("压缩失败，使用原图", err);
            }
        }

        const presignResponse = await fetch('/api/upload-r2', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileType: fileToUpload.type }),
        });
        
        if (!presignResponse.ok) throw new Error('获取上传凭证失败');
        const { uploadUrl, accessUrl } = await presignResponse.json();
        
        const uploadResponse = await fetch(uploadUrl, { 
            method: 'PUT', body: fileToUpload, headers: { 'Content-Type': fileToUpload.type }
        });
        
        if (!uploadResponse.ok) throw new Error('上传云存储失败');
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
            const { data, error } = await supabase.from('reports')
                .update({ status: 'submitted', submitted_at: new Date().toISOString(), total_amount: total } as any)
                .eq('id', report.id).select().single();
            if (error) throw error;
            setReport(data); showNotification('已提交审批');
        } catch (err: any) { showNotification(`提交失败: ${err.message}`, 'error'); } 
        finally { setLocalIsProcessing(false); }
    }, [report, expenses, supabase, setReport]);

    const handleWithdrawReport = useCallback(async () => {
        if (!report || !window.confirm('确定撤回吗？')) return;
        setLocalIsProcessing(true);
        const { data, error } = await supabase.from('reports').update({ status: 'draft' } as any).eq('id', report.id).select().single();
        if (error) showNotification(`撤回失败: ${error.message}`, 'error');
        else { setReport(data); showNotification('报销单已撤回'); }
        setLocalIsProcessing(false);
    }, [report, supabase, setReport]);

    const handleApprovalDecision = useCallback(async (decision: 'approved' | 'send_back' | 'forward_to_partner') => {
        if (!report || !currentUserProfile || !window.confirm('确定执行此操作吗？')) return;
        setLocalIsProcessing(true);
        try {
            let nextStatus = '';
            const updates: Partial<Report> = {};
            
            if (decision === 'approved') {
                if(currentUserProfile.role === 'manager') {
                    // 经理批准 -> 进入合伙人审批
                    nextStatus = 'pending_partner_approval'; 
                    updates.primary_approver_id = currentUserProfile.id; 
                    updates.primary_approved_at = new Date().toISOString();
                } else if (currentUserProfile.role === 'partner') {
                    // 合伙人批准 -> 终审通过 (无论是批经理、批员工还是批合伙人)
                    nextStatus = 'approved'; 
                    updates.final_approver_id = currentUserProfile.id; 
                    updates.final_approved_at = new Date().toISOString();
                }
            } else if (decision === 'send_back') {
                nextStatus = 'draft';
            } else if (decision === 'forward_to_partner') {
                nextStatus = 'pending_partner_approval';
            }
            updates.status = nextStatus;

            await supabase.from('approvals').insert({ report_id: report.id, approver_id: currentUserProfile.id, status: decision } as any);
            const { data, error } = await supabase.from('reports').update(updates as any).eq('id', report.id).select().single();
            if (error) throw error;
            setReport(data); showNotification('操作成功'); fetchPageData();
        } catch (err: any) { showNotification(`操作失败: ${err.message}`, 'error'); } 
        finally { setLocalIsProcessing(false); }
    }, [report, currentUserProfile, supabase, setReport, fetchPageData]);
    
    const handleGeneratePdf = useCallback(async () => {
        if (!pdfRef.current || !report) return;
        setLocalIsProcessing(true);
        try {
            const canvas = await html2canvas(pdfRef.current, { scale: 2, useCORS: true });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({ orientation: 'p', unit: 'px', format: [canvas.width, canvas.height] });
            pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
            pdf.save(`报销单-${report.title}.pdf`);
        } catch(err) { console.error(err); showNotification('PDF生成失败', 'error'); } 
        finally { setLocalIsProcessing(false); }
    }, [report]);

    // --- 编辑逻辑 ---
    const handleEditExpense = useCallback((expense: Expense) => {
        setEditingExpenseId(expense.id);
        setEditingExpenseData(expense);
        setEditingNewFiles([]);
    }, []);

    const handleCancelEdit = useCallback(() => {
        setEditingExpenseId(null);
        setEditingExpenseData({});
        setEditingNewFiles([]);
    }, []);
    
    const handleUpdateExpense = useCallback(async () => {
        if (!editingExpenseId || !user) return;
        setLocalIsProcessing(true);

        try {
            const newUploadedUrls: string[] = [];
            if (editingNewFiles.length > 0) {
                for (const file of editingNewFiles) {
                    const url = await compressAndUploadFile(file);
                    newUploadedUrls.push(url);
                }
            }

            const finalUrls = [
                ...(editingExpenseData.receipt_urls || []), 
                ...newUploadedUrls
            ];

            const updates = {
                ...editingExpenseData,
                receipt_urls: finalUrls.length > 0 ? finalUrls : null,
            };

            const { error } = await supabase.from('expenses').update(updates as any).eq('id', editingExpenseId);
            if (error) throw error;
            
            showNotification('费用条目已更新');
            handleCancelEdit();
            fetchPageData();
        } catch (err: any) {
            showNotification(`更新失败: ${err.message}`, 'error');
        } finally {
            setLocalIsProcessing(false);
        }
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
                    <div className="container mx-auto mt-4 px-6">
                        <div className={`p-4 rounded-md text-sm ${notification.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
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
            
            <div className="absolute top-0 -left-[9999px] -z-10">
                 <div ref={pdfRef}>
                    <RequestFormPDF report={report} submitterName={report.profiles?.full_name || ''} />
                </div>
            </div>
            <ReimbursementVoucher report={report} expenses={expenses} ref={null} />
        </>
    );
}