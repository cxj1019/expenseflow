// src/app/dashboard/report/[id]/page.tsx

'use client'

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useEffect, useState, FormEvent, ChangeEvent, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { Database } from '@/types/database.types'
import type { User } from '@supabase/supabase-js'
import { pinyin } from 'pinyin-pro';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// --- 类型定义 ---
type Report = Database['public']['Tables']['reports']['Row']
type Expense = Database['public']['Tables']['expenses']['Row']
type Customer = Database['public']['Tables']['customers']['Row']
type Profile = Database['public']['Tables']['profiles']['Row']
type SearchableOption = { id: number | string; name: string | null };

type ReportWithSubmitter = Report & {
  profiles: Profile | null;
};

type ReportDetailPageProps = {
  params: {
    id: string
  }
}

type ExpenseWithCustomerName = Expense & {
  customer_name?: string | null;
};
type ExpenseInsertWithCustomerName = Database['public']['Tables']['expenses']['Insert'] & {
  customer_name?: string | null;
  invoice_number?: string | null;
};


const EXPENSE_CATEGORIES = ['飞机', '火车', '长途汽车', 'Taxi', '餐饮', '住宿', '办公用品', '客户招待', '员工福利', '其他'];
const N8N_WEBHOOK_URL = 'http://n8n.19851019.xyz:5678/webhook-test/7e18e6b7-c328-4e17-899c-3188a9b76083';

// ... (RequestFormPDF, ImagePreview, SearchableSelect 组件代码保持不变, 此处省略以保持简洁)
// RequestFormPDF Component...
const RequestFormPDF = ({ report, submitterName }: { report: ReportWithSubmitter | null, submitterName: string }) => {
  if (!report) return null;
  const formatDate = (dateString: string | null) => {
    if (!dateString) return { year: '', month: '', day: '' };
    const date = new Date(dateString);
    return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() };
  };
  const { year, month, day } = formatDate(report.final_approved_at); // 使用 final_approved_at
  return (
    <div className="p-8 bg-white text-black" style={{ width: '210mm', minHeight: '297mm', fontFamily: "'SimSun', 'STSong'" }}>
      {/* PDF 内容 */}
    </div>
  );
};

// ImagePreview Component...
const ImagePreview = ({ src, children }: { src: string; children: React.ReactNode }) => {
    // ... (组件代码)
    return <div>{children}</div>
};

// SearchableSelect Component...
const SearchableSelect = ({ options, value, onChange, placeholder }: SearchableSelectProps) => {
    // ... (组件代码)
    return <input />
};


export default function ReportDetailPage({ params }: ReportDetailPageProps) {
  const [report, setReport] = useState<ReportWithSubmitter | null>(null);
  const [expenses, setExpenses] = useState<ExpenseWithCustomerName[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [amount, setAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [selectedExpenseCustomer, setSelectedExpenseCustomer] = useState('');
  const [receiptFiles, setReceiptFiles] = useState<FileList | null>(null);
  const [isVatInvoice, setIsVatInvoice] = useState(false);
  const [taxRate, setTaxRate] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [reportCustomerName, setReportCustomerName] = useState('');
  const [reportBillToCustomer, setReportBillToCustomer] = useState(false);
  const [editableTitle, setEditableTitle] = useState('');
  const pdfRef = useRef<HTMLDivElement>(null);
  const [editingExpenseId, setEditingExpenseId] = useState<number | null>(null);
  const [editingExpenseData, setEditingExpenseData] = useState<Partial<ExpenseWithCustomerName>>({});
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState('');

  const supabase = createClientComponentClient<Database>();
  const router = useRouter();
  const reportId = params.id;

  const fetchPageData = useCallback(async () => {
    // ... (此函数保持不变)
  }, [reportId, supabase, router]);

  useEffect(() => {
    fetchPageData();
  }, [fetchPageData]);

  // ... (其他所有 handle 函数, 如 handleAddExpense, handleDeleteExpense 等都保持不变)
  
  // 【已更新】包含新二级审批逻辑的函数
  const handleApprovalDecision = async (decision: 'approved' | 'send_back' | 'forward_to_partner') => {
    if (!report || !currentUserProfile) return;

    setIsProcessing(true);
    const { data: currentReport, error: fetchError } = await supabase
      .from('reports')
      .select('status')
      .eq('id', report.id)
      .single();

    if (fetchError || !currentReport || !['submitted', 'pending_partner_approval'].includes(currentReport.status)) {
      alert('操作失败：该报销单可能已被提交人撤回或已被他人处理。');
      setIsProcessing(false);
      fetchPageData();
      return;
    }

    const updatePayload: Partial<Report> = {};
    let alertMessage = '';
    const now = new Date().toISOString();
    const userRole = currentUserProfile.role;

    if (decision === 'send_back') {
      updatePayload.status = 'draft';
      // 退回时清空所有审批记录
      updatePayload.primary_approver_id = null;
      updatePayload.primary_approved_at = null;
      updatePayload.final_approver_id = null;
      updatePayload.final_approved_at = null;
      alertMessage = '报销单已退回修改。';
    } else {
      const totalAmount = report.total_amount || 0;
      
      // 场景 A: 当前用户是经理 (一级审批)
      if (userRole === 'manager' && currentReport.status === 'submitted') {
        updatePayload.primary_approver_id = currentUserProfile.id;
        updatePayload.primary_approved_at = now;

        if (decision === 'forward_to_partner' || (decision === 'approved' && totalAmount > 5000)) {
          updatePayload.status = 'pending_partner_approval';
          alertMessage = '已批准并成功转交给合伙人进行最终审批。';
        } else {
          updatePayload.status = 'approved';
          updatePayload.final_approver_id = currentUserProfile.id; // 自己就是最终审批人
          updatePayload.final_approved_at = now;
          alertMessage = '报销单已批准！';
        }
      } 
      // 场景 B: 当前用户是合伙人
      else if (userRole === 'partner') {
        // B1: 作为一级审批人
        if (currentReport.status === 'submitted') {
          updatePayload.primary_approver_id = currentUserProfile.id;
          updatePayload.primary_approved_at = now;
          updatePayload.final_approver_id = currentUserProfile.id;
          updatePayload.final_approved_at = now;
          updatePayload.status = 'approved';
          alertMessage = '报销单已批准！';
        } 
        // B2: 作为二级审批人
        else if (currentReport.status === 'pending_partner_approval') {
          updatePayload.final_approver_id = currentUserProfile.id;
          updatePayload.final_approved_at = now;
          updatePayload.status = 'approved';
          alertMessage = '报销单已最终批准！';
        }
      }
    }

    if (Object.keys(updatePayload).length === 0) {
        alert("无效的操作");
        setIsProcessing(false);
        return;
    }

    const { data, error } = await supabase
      .from('reports')
      .update(updatePayload)
      .eq('id', report.id)
      .select('*, profiles!user_id(*)')
      .single();

    if (error) {
      alert(`操作失败: ${error.message}`);
    } else {
      setReport(data as ReportWithSubmitter);
      alert(alertMessage);
    }
    setIsProcessing(false);
  };

  // ... (其他代码)

  // 【已更新】审批按钮的显示逻辑
  const canApprove =
    report &&
    isApproverView &&
    (
      (currentUserProfile?.role === 'manager' && report.status === 'submitted') ||
      (currentUserProfile?.role === 'partner' && ['submitted', 'pending_partner_approval'].includes(report.status))
    );

  // ... (return JSX 部分)
  
  return (
    // ... (JSX 结构)
    // 【已更新】审批按钮区域的 JSX
    <div className="flex items-center space-x-2 flex-wrap">
      {canExportPdf && (
        <button onClick={handleGeneratePdf} className="px-4 py-2 font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700">
          导出请求书
        </button>
      )}
      {canApprove && (
        <>
          <button onClick={() => handleApprovalDecision('approved')} disabled={isProcessing} className="px-4 py-2 font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:bg-gray-400">批准</button>
          
          {currentUserProfile?.role === 'manager' && report?.status === 'submitted' && (
            <button onClick={() => handleApprovalDecision('forward_to_partner')} disabled={isProcessing} className="px-4 py-2 font-semibold text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:bg-gray-400">
              批准并转交合伙人
            </button>
          )}

          <button onClick={() => handleApprovalDecision('send_back')} disabled={isProcessing} className="px-4 py-2 font-semibold text-white bg-gray-600 rounded-lg hover:bg-gray-700 disabled:bg-gray-400">退回修改</button>
        </>
      )}
      {/* ... 其他按钮 ... */}
    </div>
    // ... (剩余的 JSX)
  );
}
