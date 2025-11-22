//src\app\dashboard\report\[id]\page.tsx

'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import Link from 'next/link';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// 导入所有子组件和Hooks
import type { Database } from '@/types/database.types';
import { useReportData } from '@/hooks/useReportData';
import { ReportHeader } from '@/components/report/ReportHeader';
import { AdminPanel } from '@/components/report/AdminPanel';
import { ReportMetadataForm } from '@/components/report/ReportMetadataForm';
import { AddExpenseForm } from '@/components/report/AddExpenseForm';
import { ExpenseList } from '@/components/report/ExpenseList';
import { RequestFormPDF } from '@/components/report/RequestFormPDF';

// 从数据库类型中获取具体类型
type Report = Database['public']['Tables']['reports']['Row'];
type Expense = Database['public']['Tables']['expenses']['Row'];

export default function ReportDetailPage() {
    const supabase = createClientComponentClient<Database>();
    const router = useRouter();
    const { report, setReport, expenses, customers, user, currentUserProfile, loading, error, fetchPageData } = useReportData();
    
    // --- 页面级状态 ---
    const [isProcessing, setIsProcessing] = useState(false);
    // 新增：用于替代 alert 的通知状态
    const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);

    // 用于表单编辑的状态
    const [editableTitle, setEditableTitle] = useState('');
    const [reportCustomerName, setReportCustomerName] = useState('');
    const [reportBillToCustomer, setReportBillToCustomer] = useState(false);
    const [invoiceReceived, setInvoiceReceived] = useState(false);
    const [isPaid, setIsPaid] = useState(false);
    const [editingExpenseId, setEditingExpenseId] = useState<number | null>(null);
    const [editingExpenseData, setEditingExpenseData] = useState<Partial<Expense>>({});
    const [editingReceiptFiles, setEditingReceiptFiles] = useState<FileList | null>(null);
    const pdfRef = useRef<HTMLDivElement>(null);

    // 当 report 数据加载或更新后，同步本地的编辑状态
    useEffect(() => {
        if (report) {
            setEditableTitle(report.title || '');
            setReportCustomerName(report.customer_name || '');
            setReportBillToCustomer(report.bill_to_customer || false);
            setInvoiceReceived(report.is_invoice_received || false);
            setIsPaid(report.is_paid || false);
        }
    }, [report]);

    // --- 权限控制逻辑 ---
    const isOwner = user?.id === report?.user_id;
    const isDraft = report?.status === 'draft';
    const canWithdraw = isOwner && ['submitted', 'pending_partner_approval'].includes(report?.status || '');
    const isAdminView = currentUserProfile?.role === 'admin';
    const isApproverView = currentUserProfile && !isOwner && ['manager', 'partner'].includes(currentUserProfile.role || '');
    const canApprove = report && isApproverView && (
        (currentUserProfile?.role === 'manager' && report.status === 'submitted') ||
        (currentUserProfile?.role === 'partner' && ['submitted', 'pending_partner_approval'].includes(report.status))
    );
    const canExportPdf = report?.status === 'approved' && report.bill_to_customer;

    // --- 通知处理函数 ---
    const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 5000); // 5秒后自动消失
    };

    // --- 所有事件处理函数的完整实现 ---
    const handleExpenseAdded = useCallback(() => { 
        showNotification('费用条目已成功添加！');
        fetchPageData(); 
    }, [fetchPageData]);
    
    // 更新报销单标题
    const handleTitleUpdate = useCallback(async () => {
        if (!report || !editableTitle.trim()) return;
        setIsProcessing(true);
        const { error } = await supabase.from('reports').update({ title: editableTitle.trim() } as any).eq('id', report.id);
        if (error) {
            showNotification(`标题更新失败: ${error.message}`, 'error');
        } else {
            showNotification('标题已更新。');
            fetchPageData();
        }
        setIsProcessing(false);
    }, [report, editableTitle, supabase, fetchPageData]);

    // 更新客户相关信息
    const handleUpdateReportCustomerInfo = useCallback(async () => {
        if (!report) return;
        setIsProcessing(true);
        const { error } = await supabase.from('reports').update({
            customer_name: reportCustomerName,
            bill_to_customer: reportBillToCustomer
        } as any).eq('id', report.id);
        
        if (error) {
            showNotification(`客户信息更新失败: ${error.message}`, 'error');
        } else {
            showNotification('客户信息已保存。');
            fetchPageData();
        }
        setIsProcessing(false);
    }, [report, reportCustomerName, reportBillToCustomer, supabase, fetchPageData]);

    // 提交审批
    const handleSubmitForApproval = useCallback(async () => {
        if (!report || expenses.length === 0) {
            showNotification('报销单中还没有任何费用条目，无法提交。', 'error');
            return;
        }
        if (!window.confirm('您确定要提交这张报销单进行审批吗？提交后将无法修改。')) {
            return;
        }
        setIsProcessing(true);
        try {
            const total_amount = expenses.reduce((sum, exp) => sum + exp.amount, 0);
            const { data: updatedReport, error: updateError } = await supabase
                .from('reports')
                .update({ status: 'submitted', submitted_at: new Date().toISOString(), total_amount: total_amount } as any)
                .eq('id', report.id).select().single();
            
            if (updateError) throw updateError;
            setReport(updatedReport); // 立即更新UI
            showNotification('报销单已成功提交！');
        } catch (err: unknown) {
            if (err instanceof Error) {
                showNotification(`提交失败: ${err.message}`, 'error');
            } else {
                showNotification('提交失败: 发生未知错误', 'error');
            }
        } finally {
            setIsProcessing(false);
        }
    }, [report, expenses, supabase, setReport]);

    // 删除报销单
    const handleDeleteReport = useCallback(async () => {
        if (!report || !user) return;
        if (!window.confirm('危险操作！您确定要永久删除这张报销单及其所有费用条目吗？')) {
            return;
        }
        setIsProcessing(true);
        try {
            // 安全起见，先删除所有关联的费用条目
            const { error: expenseError } = await supabase.from('expenses').delete().eq('report_id', report.id);
            if (expenseError) throw expenseError;

            // 然后删除报销单本身
            const { error: reportError } = await supabase.from('reports').delete().eq('id', report.id);
            if (reportError) throw reportError;

            showNotification('报销单已删除。');
            router.push('/dashboard');
        } catch (err: unknown) {
            if (err instanceof Error) {
                showNotification(`删除失败: ${err.message}`, 'error');
            } else {
                showNotification('删除失败: 发生未知错误', 'error');
            }
            setIsProcessing(false);
        }
    }, [report, user, supabase, router]);

    // 撤回已提交的报销单
    const handleWithdrawReport = useCallback(async () => {
        if (!report || !user) return;
        if (!window.confirm('您确定要撤回这张报销单吗？撤回后可以重新编辑。')) {
            return;
        }
        setIsProcessing(true);
        const { data, error } = await supabase.from('reports').update({ status: 'draft' } as any).eq('id', report.id).select().single();
        if (error) {
            showNotification(`撤回失败: ${error.message}`, 'error');
        } else {
            setReport(data);
            showNotification('报销单已撤回。');
        }
        setIsProcessing(false);
    }, [report, user, supabase, setReport]);

    // 审批决策 (批准/退回/转交)
    const handleApprovalDecision = useCallback(async (decision: 'approved' | 'send_back' | 'forward_to_partner') => {
        if (!report || !currentUserProfile) return;
        
        let confirmMessage = '';
        if (decision === 'approved') confirmMessage = '您确定要批准这张报销单吗？';
        if (decision === 'send_back') confirmMessage = '您确定要将这张报销单退回给提交人修改吗？';
        if (decision === 'forward_to_partner') confirmMessage = '您确定要将这张报销单转交给合伙人进行最终审批吗？';

        if (!window.confirm(confirmMessage)) return;

        setIsProcessing(true);
        try {
            let nextStatus = '';
            const updates: Partial<Report> = {};

            if (decision === 'approved') {
                if(currentUserProfile.role === 'manager') {
                    // 如果公司流程需要两级审批，经理批准后进入下一级
                    nextStatus = 'pending_partner_approval';
                    updates.primary_approver_id = currentUserProfile.id;
                    updates.primary_approved_at = new Date().toISOString();
                } else if (currentUserProfile.role === 'partner') {
                    // 合伙人批准后，流程结束
                    nextStatus = 'approved';
                    updates.final_approver_id = currentUserProfile.id;
                    updates.final_approved_at = new Date().toISOString();
                }
            } else if (decision === 'send_back') {
                nextStatus = 'draft'; // 退回草稿状态
            } else if (decision === 'forward_to_partner') {
                nextStatus = 'pending_partner_approval';
            }

            updates.status = nextStatus;

            // 记录审批历史
            const { error: approvalError } = await supabase.from('approvals').insert({
                report_id: report.id,
                approver_id: currentUserProfile.id,
                status: decision,
                // comments: '可以增加一个输入框来填写审批意见'
            } as any);
            if (approvalError) throw approvalError;
            
            // 更新报销单状态
            const { data, error: reportError } = await supabase.from('reports').update(updates as any).eq('id', report.id).select().single();
            if (reportError) throw reportError;
            
            setReport(data);
            showNotification('操作成功！');
            fetchPageData();

        } catch (err: unknown) {
            if (err instanceof Error) {
                showNotification(`操作失败: ${err.message}`, 'error');
            } else {
                showNotification('操作失败: 发生未知错误', 'error');
            }
        } finally {
            setIsProcessing(false);
        }
    }, [report, currentUserProfile, supabase, setReport, fetchPageData]);
    
    // 生成PDF
    const handleGeneratePdf = useCallback(async () => {
        if (!pdfRef.current || !report) return;
        setIsProcessing(true);
        try {
            const canvas = await html2canvas(pdfRef.current, { scale: 2, useCORS: true });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({ orientation: 'p', unit: 'px', format: [canvas.width, canvas.height] });
            pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
            pdf.save(`报销单-${report.title || report.id}.pdf`);
        } catch(err) {
            showNotification('PDF 生成失败，请重试。', 'error');
            console.error(err);
        } finally {
            setIsProcessing(false);
        }
    }, [report]);

    // 删除单条费用
    const handleDeleteExpense = useCallback(async (expenseId: number) => {
        if (!window.confirm('确定要删除这条费用吗？')) return;
        setIsProcessing(true);
        // 注意：这里也需要处理删除存储桶中的文件，为简化暂不实现
        const { error } = await supabase.from('expenses').delete().eq('id', expenseId);
        if (error) {
            showNotification(`删除失败: ${error.message}`, 'error');
        } else {
            showNotification('费用已删除。');
            fetchPageData(); // 重新加载数据以更新列表和总金额
        }
        setIsProcessing(false);
    }, [fetchPageData, supabase]);
    
    // 进入费用编辑模式
    const handleEditExpense = useCallback((expense: Expense) => {
        setEditingExpenseId(expense.id);
        setEditingExpenseData(expense);
    }, []);

    // 取消编辑
    const handleCancelEdit = useCallback(() => {
        setEditingExpenseId(null);
        setEditingExpenseData({});
        setEditingReceiptFiles(null);
    }, []);
    
    // 更新费用条目
    const handleUpdateExpense = useCallback(async () => {
        if (!editingExpenseId || !user) return;

        setIsProcessing(true);

        try {
            // 如果有新文件上传，需要先处理文件
            if (editingReceiptFiles && editingReceiptFiles.length > 0) {
                // 此处应包含文件上传到R2/S3的逻辑，并获取新的URLs
                // 为简化，我们假设此逻辑已完成，并将新URL合并
                // const newUrls = await uploadFiles(editingReceiptFiles);
                // editingExpenseData.receipt_urls = [...(editingExpenseData.receipt_urls || []), ...newUrls];
                showNotification('包含文件更新的逻辑比较复杂，此处为简化版。', 'error');
            }

            const { error } = await supabase
                .from('expenses')
                .update(editingExpenseData as any)
                .eq('id', editingExpenseId);

            if (error) throw error;
            
            showNotification('费用条目已更新！');
            handleCancelEdit(); // 退出编辑模式
            fetchPageData();

        } catch (err: unknown) {
            if (err instanceof Error) {
                showNotification(`更新失败: ${err.message}`, 'error');
            } else {
                showNotification('更新失败: 发生未知错误', 'error');
            }
        } finally {
            setIsProcessing(false);
        }
    }, [editingExpenseId, user, editingReceiptFiles, editingExpenseData, supabase, fetchPageData, handleCancelEdit]);

    // 财务人员更新状态
    const handleAdminStatusUpdate = async () => {
        if (!report) return;
        setIsProcessing(true);
        const updates = { is_invoice_received: invoiceReceived, is_paid: isPaid };
        const { error } = await supabase.from('reports').update(updates as any).eq('id', report.id);
        if (error) {
            showNotification('更新财务状态失败: ' + error.message, 'error');
        } else {
            showNotification('财务状态已成功更新！');
            fetchPageData();
        }
        setIsProcessing(false);
    };

    // --- 页面渲染 ---
    if (loading) return <div className="flex justify-center items-center min-h-screen">正在加载详情...</div>;
    if (error) return ( <div className="text-center p-4">加载失败: {error} <Link href="/dashboard">返回</Link></div> ); 
    if (!report || !user || !currentUserProfile) return ( <div className="text-center p-4">未找到报销单或用户数据。</div> );
    
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
                    onDelete={handleDeleteReport}
                />
                
                {/* 新增：通知组件 */}
                {notification && (
                    <div className="container mx-auto mt-4 px-6">
                        <div 
                            className={`p-4 rounded-md text-sm ${
                                notification.type === 'success' 
                                ? 'bg-green-100 text-green-800 border border-green-200' 
                                : 'bg-red-100 text-red-800 border border-red-200'
                            }`}
                        >
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
                                    invoiceReceived={invoiceReceived || false}
                                    onInvoiceReceivedChange={(e) => {
                                        setInvoiceReceived(e.target.checked);
                                        if (!e.target.checked) setIsPaid(false);
                                    }}
                                    isPaid={isPaid || false}
                                    onIsPaidChange={(e) => setIsPaid(e.target.checked)}
                                    canMarkAsPaid={invoiceReceived || false}
                                    onSave={handleAdminStatusUpdate}
                                    isProcessing={isProcessing}
                                />
                            )}
                            <ExpenseList
                                report={report} expenses={expenses} isOwner={isOwner}
                                isDraft={isDraft} isProcessing={isProcessing}
                                editingExpenseId={editingExpenseId} editingExpenseData={editingExpenseData}
                                setEditingExpenseData={setEditingExpenseData} onEditExpense={handleEditExpense}
                                onCancelEdit={handleCancelEdit} onUpdateExpense={handleUpdateExpense}
                                onDeleteExpense={(expense) => handleDeleteExpense(expense.id)} customers={customers}
                                editingReceiptFiles={editingReceiptFiles} setEditingReceiptFiles={setEditingReceiptFiles}
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
        </>
    );
}
