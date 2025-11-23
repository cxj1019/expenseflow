// src/components/report/ExpenseList.tsx

'use client';

import { ChangeEvent } from 'react';
import Image from 'next/image';
import type { Database } from '@/types/database.types';
import { ExpenseListItem } from './ExpenseListItem';
import { SearchableSelect } from '../shared/SearchableSelect';
import type { ReportWithRelations } from '@/hooks/useReportData';
import { FaCamera, FaCloudUploadAlt, FaTimes, FaFilePdf } from 'react-icons/fa';
// 1. 引入 FilePreview 组件
import { FilePreview } from '../shared/FilePreview';

type Expense = Database['public']['Tables']['expenses']['Row'];
type Customer = Database['public']['Tables']['customers']['Row'];

const EXPENSE_CATEGORIES = ['飞机', '火车', '长途汽车', 'Taxi', '餐饮', '住宿', '办公用品', '客户招待', '员工福利', '其他'];

interface ExpenseListProps {
  report: ReportWithRelations | null;
  expenses: Expense[];
  isOwner: boolean;
  isDraft: boolean;
  isProcessing: boolean;
  
  editingExpenseId: number | null;
  editingExpenseData: Partial<Expense>;
  setEditingExpenseData: (data: Partial<Expense>) => void;
  onEditExpense: (expense: Expense) => void;
  onCancelEdit: () => void;
  onUpdateExpense: () => void;
  onDeleteExpense: (expense: Expense) => void;
  customers: Customer[];
  
  editingNewFiles: File[];
  setEditingNewFiles: (files: File[]) => void;
}

export const ExpenseList = ({ 
    report, 
    expenses, 
    isOwner, 
    isDraft, 
    isProcessing, 
    editingExpenseId,
    editingExpenseData,
    setEditingExpenseData,
    onEditExpense,
    onCancelEdit,
    onUpdateExpense,
    onDeleteExpense,
    customers,
    editingNewFiles,
    setEditingNewFiles
}: ExpenseListProps) => {
  
  if (!report) return null;

  const handleChange = (field: keyof Expense, value: any) => {
      setEditingExpenseData({ ...editingExpenseData, [field]: value });
  };

  // 处理现有文件的删除
  const handleRemoveExistingUrl = (urlToRemove: string) => {
      const currentUrls = editingExpenseData.receipt_urls || [];
      const newUrls = currentUrls.filter(url => url !== urlToRemove);
      setEditingExpenseData({ ...editingExpenseData, receipt_urls: newUrls });
  };

  // 处理新文件的添加
  const handleAddNewFiles = (e: ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
          const files = Array.from(e.target.files);
          setEditingNewFiles([...editingNewFiles, ...files]);
      }
      if (e.target) e.target.value = '';
  };

  // 处理新文件的删除
  const handleRemoveNewFile = (index: number) => {
      const updatedFiles = editingNewFiles.filter((_, i) => i !== index);
      setEditingNewFiles(updatedFiles);
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md border border-gray-100">
      <div className="flex justify-between items-baseline mb-4 pb-4 border-b border-gray-100">
        <h2 className="text-xl font-bold text-gray-800">费用明细 ({expenses.length} 项)</h2>
        <div className="text-right">
          <p className="text-sm text-gray-500">总计</p>
          <p className="text-2xl font-bold text-gray-800 font-mono">
            ¥{report.total_amount?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
          </p>
        </div>
      </div>
      
      <div className="space-y-4">
        {expenses.length > 0 ? (
          expenses.map(expense => {
            // --- 编辑模式渲染 ---
            if (editingExpenseId === expense.id) { 
                return (
                    <div key={expense.id} className="bg-blue-50 p-4 rounded-lg border border-blue-200 shadow-sm animate-fade-in">
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="font-bold text-blue-800">✏️ 编辑费用</h3>
                            <button onClick={onCancelEdit} className="text-gray-400 hover:text-gray-600">✕</button>
                        </div>
                        
                        {/* 表单字段区域 */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="block text-xs text-gray-500 mb-1 font-medium">费用类型</label>
                                <select 
                                    value={editingExpenseData.category || ''} 
                                    onChange={(e) => handleChange('category', e.target.value)}
                                    className="w-full p-2 border border-gray-300 rounded text-sm focus:border-blue-500 outline-none"
                                >
                                    {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 mb-1 font-medium">金额 (¥)</label>
                                <input 
                                    type="number" 
                                    value={editingExpenseData.amount || 0} 
                                    onChange={(e) => handleChange('amount', parseFloat(e.target.value))}
                                    step="0.01"
                                    className="w-full p-2 border border-gray-300 rounded text-sm focus:border-blue-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 mb-1 font-medium">日期</label>
                                <input 
                                    type="date" 
                                    value={editingExpenseData.expense_date?.toString().split('T')[0] || ''} 
                                    onChange={(e) => handleChange('expense_date', e.target.value)}
                                    className="w-full p-2 border border-gray-300 rounded text-sm focus:border-blue-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 mb-1 font-medium">归属客户</label>
                                <SearchableSelect 
                                    options={customers} 
                                    value={editingExpenseData.customer_name || ''} 
                                    onChange={(val) => handleChange('customer_name', val)}
                                    placeholder="选择或搜索客户"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-xs text-gray-500 mb-1 font-medium">备注</label>
                                <input 
                                    type="text" 
                                    value={editingExpenseData.description || ''} 
                                    onChange={(e) => handleChange('description', e.target.value)}
                                    className="w-full p-2 border border-gray-300 rounded text-sm focus:border-blue-500 outline-none"
                                />
                            </div>
                        </div>

                        {/* --- 凭证管理区域 --- */}
                        <div className="mb-4 p-3 bg-white rounded border border-blue-100">
                            <label className="block text-xs text-gray-500 mb-2 font-medium">凭证管理</label>
                            
                            {/* 1. 现有文件列表 (已应用 FilePreview) */}
                            {editingExpenseData.receipt_urls && editingExpenseData.receipt_urls.length > 0 && (
                                <div className="mb-3">
                                    <p className="text-xs text-gray-400 mb-1">已保存的凭证 (点击预览):</p>
                                    <div className="flex flex-wrap gap-2">
                                        {editingExpenseData.receipt_urls.map((url, idx) => (
                                            <div key={idx} className="relative w-16 h-16 border rounded overflow-hidden group bg-white shadow-sm">
                                                
                                                {/* 2. 使用 FilePreview 包裹内容，点击即可预览 */}
                                                <FilePreview src={url}>
                                                    <div className="w-full h-full cursor-pointer flex items-center justify-center">
                                                        {url.toLowerCase().endsWith('.pdf') ? 
                                                            <div className="text-red-500 flex flex-col items-center">
                                                                <FaFilePdf size={24} />
                                                                <span className="text-[8px] mt-1">PDF</span>
                                                            </div> 
                                                            : 
                                                            <Image src={url} alt="receipt" fill className="object-cover" unoptimized />
                                                        }
                                                    </div>
                                                </FilePreview>

                                                {/* 删除按钮：必须阻止冒泡，否则删除时会弹出预览 */}
                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation(); 
                                                        handleRemoveExistingUrl(url);
                                                    }}
                                                    className="absolute top-0 right-0 bg-red-500 text-white p-1 rounded-bl opacity-80 hover:opacity-100 z-10"
                                                    type="button"
                                                >
                                                    <FaTimes size={10} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* 2. 新增文件列表 */}
                            {editingNewFiles.length > 0 && (
                                <div className="mb-3">
                                    <p className="text-xs text-blue-400 mb-1">待上传的新凭证:</p>
                                    <div className="flex flex-wrap gap-2">
                                        {editingNewFiles.map((file, idx) => (
                                            <div key={idx} className="relative w-16 h-16 border border-blue-300 rounded overflow-hidden bg-blue-50 flex items-center justify-center">
                                                <span className="text-[10px] text-center break-all px-1 text-blue-800">{file.name.slice(0, 8)}...</span>
                                                <button 
                                                    onClick={() => handleRemoveNewFile(idx)}
                                                    className="absolute top-0 right-0 bg-red-500 text-white p-1 rounded-bl opacity-80 hover:opacity-100"
                                                    type="button"
                                                >
                                                    <FaTimes size={10} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* 3. 上传按钮组 */}
                            <div className="flex gap-2 mt-2">
                                <label className="cursor-pointer flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-600 rounded border border-blue-200 text-xs hover:bg-blue-100 active:scale-95 transition-transform">
                                    <FaCamera /> 拍照
                                    <input type="file" accept="image/*" capture="environment" style={{display:'none'}} onChange={handleAddNewFiles} />
                                </label>
                                <label className="cursor-pointer flex items-center gap-1 px-3 py-1.5 bg-gray-50 text-gray-600 rounded border border-gray-200 text-xs hover:bg-gray-100 active:scale-95 transition-transform">
                                    <FaCloudUploadAlt /> 相册
                                    <input type="file" accept="image/*,application/pdf" multiple style={{display:'none'}} onChange={handleAddNewFiles} />
                                </label>
                            </div>
                        </div>

                        {/* 保存/取消 按钮 */}
                        <div className="flex justify-end space-x-3 pt-2 border-t border-blue-100">
                            <button onClick={onCancelEdit} disabled={isProcessing} className="px-4 py-2 text-sm text-gray-600 hover:bg-white rounded">取消</button>
                            <button onClick={onUpdateExpense} disabled={isProcessing} className="px-5 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded shadow-sm disabled:opacity-50">
                                {isProcessing ? '保存中...' : '保存修改'}
                            </button>
                        </div>
                    </div>
                ); 
            }

            // --- 正常列表显示模式 ---
            return (
              <ExpenseListItem 
                key={expense.id} 
                expense={expense} 
                isOwner={isOwner} 
                isDraft={isDraft}
                isProcessing={isProcessing} 
                onEdit={onEditExpense} 
                onDelete={onDeleteExpense}
              />
            );
          })
        ) : (
          <div className="text-center py-10 text-gray-400 border-2 border-dashed border-gray-100 rounded-lg bg-gray-50">
              <p>暂无费用明细</p>
          </div>
        )}
      </div>
    </div>
  );
};