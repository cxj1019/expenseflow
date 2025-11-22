//src\components\report\AddExpenseForm.tsx

'use client';

import { useState, useEffect, FormEvent, ChangeEvent } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type { Database } from '@/types/database.types';
import type { User } from '@supabase/supabase-js';
import { SearchableSelect } from '../shared/SearchableSelect'; // 确保你已创建这个共享组件

// 类型定义
type Customer = Database['public']['Tables']['customers']['Row'];
const EXPENSE_CATEGORIES = ['飞机', '火车', '长途汽车', 'Taxi', '餐饮', '住宿', '办公用品', '客户招待', '员工福利', '其他'];

interface AddExpenseFormProps {
  reportId: number;
  user: User | null;
  customers: Customer[];
  onExpenseAdded: () => void; // 用于通知父组件刷新数据
}

export const AddExpenseForm = ({ reportId, user, customers, onExpenseAdded }: AddExpenseFormProps) => {
  const supabase = createClientComponentClient<Database>();
  
  // 所有表单相关的状态都封装在此组件内部
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [amount, setAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [selectedExpenseCustomer, setSelectedExpenseCustomer] = useState('');
  const [receiptFiles, setReceiptFiles] = useState<FileList | null>(null);
  const [isVatInvoice, setIsVatInvoice] = useState(false);
  const [taxRate, setTaxRate] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // 核心功能：根据费用类别自动更新税率信息
  useEffect(() => {
    if (category === '飞机' || category === '火车') {
      setIsVatInvoice(true);
      setTaxRate('9');
    } else {
      setIsVatInvoice(false);
      setTaxRate('');
    }
  }, [category]);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    setReceiptFiles(e.target.files);
  };

  const handleAddExpense = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      alert('请输入有效的正数金额！');
      return;
    }
    let parsedTaxRate = null;
    if (isVatInvoice) {
      if (taxRate.trim() === '') {
        alert('选择了增值税专用发票，必须填写税率！');
        return;
      }
      parsedTaxRate = parseFloat(taxRate);
      if (isNaN(parsedTaxRate)) {
        alert('请输入有效的税率！');
        return;
      }
    }
    setIsProcessing(true);
    const receiptUrls: string[] = [];
    if (receiptFiles && receiptFiles.length > 0) {
      for (const file of Array.from(receiptFiles)) {
        try {
          const presignResponse = await fetch('/api/upload-r2', { /* 注意：这里沿用你之前的API路径 */
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileType: file.type, userId: user.id }),
          });
          if (!presignResponse.ok) throw new Error('获取上传链接失败');
          const { uploadUrl, accessUrl } = await presignResponse.json();
          const uploadResponse = await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type }});
          if (!uploadResponse.ok) throw new Error(`上传文件 ${file.name} 失败`);
          receiptUrls.push(accessUrl);
        } catch (error: unknown) {
          if (error instanceof Error) {
            alert(`上传发票时出错: ${error.message}`);
          } else {
            alert('上传发票时发生未知错误');
          }
          setIsProcessing(false);
          return;
        }
      }
    }

    const insertData = {
      report_id: reportId,
      user_id: user.id,
      category,
      amount: parsedAmount,
      expense_date: expenseDate,
      description: description.trim() === '' ? null : description.trim(),
      customer_name: selectedExpenseCustomer.trim() === '' ? null : selectedExpenseCustomer.trim(),
      invoice_number: invoiceNumber || null,
      receipt_urls: receiptUrls.length > 0 ? receiptUrls : null,
      is_vat_invoice: isVatInvoice,
      tax_rate: parsedTaxRate,
    };

    const { error: insertError } = await supabase.from('expenses').insert([insertData] as any);
    if (insertError) {
      alert('添加费用失败: ' + insertError.message);
    } else {
      // 重置表单
      setCategory(EXPENSE_CATEGORIES[0]);
      setAmount('');
      setDescription('');
      setSelectedExpenseCustomer('');
      setReceiptFiles(null);
      setInvoiceNumber('');
      const fileInput = document.getElementById('receipt') as HTMLInputElement;
      if (fileInput) fileInput.value = "";
      // 通知父组件刷新数据
      onExpenseAdded();
    }
    setIsProcessing(false);
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4">添加一笔费用</h2>
      <form onSubmit={handleAddExpense} className="space-y-4">
        <div><label htmlFor="category" className="block text-sm font-medium text-gray-700">费用类型</label><select id="category" value={category} onChange={e => setCategory(e.target.value)} required className="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm">{EXPENSE_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}</select></div>
        <div><label htmlFor="amount" className="block text-sm font-medium text-gray-700">金额</label><input type="number" id="amount" value={amount} onChange={e => setAmount(e.target.value)} required step="0.01" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"/></div>
        <div><label htmlFor="expenseDate" className="block text-sm font-medium text-gray-700">消费日期</label><input type="date" id="expenseDate" value={expenseDate} onChange={e => setExpenseDate(e.target.value)} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"/></div>
        <div>
          <label htmlFor="expenseCustomer" className="block text-sm font-medium text-gray-700">客户名称 (费用归属)</label>
          <SearchableSelect
            placeholder="搜索客户名称"
            options={customers}
            value={selectedExpenseCustomer}
            onChange={setSelectedExpenseCustomer}
          />
        </div>
        <div><label htmlFor="description" className="block text-sm font-medium text-gray-700">备注 (可选)</label><textarea id="description" value={description} onChange={e => setDescription(e.target.value)} rows={2} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"></textarea></div>
        <div className="space-y-2 p-3 border border-gray-200 rounded-md">
          <div className="flex items-center"><input id="isVatInvoice" type="checkbox" checked={isVatInvoice} onChange={e => setIsVatInvoice(e.target.checked)} className="h-4 w-4 text-blue-600 border-gray-300 rounded"/><label htmlFor="isVatInvoice" className="ml-2 block text-sm text-gray-900">增值税专用发票</label></div>
          {isVatInvoice && (<div><label htmlFor="taxRate" className="block text-sm font-medium text-gray-700">税率 (%)</label><input type="number" id="taxRate" value={taxRate} onChange={e => setTaxRate(e.target.value)} required={isVatInvoice} step="0.01" placeholder="例如: 9 或 6" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"/></div>)}
        </div>
        <div>
          <label htmlFor="receipt" className="block text-sm font-medium text-gray-700">上传发票/PDF (可选, 可多选)</label>
          <input type="file" id="receipt" onChange={handleFileChange} accept="image/*,application/pdf" multiple className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"/>
        </div>
        <button type="submit" disabled={isProcessing} className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400"> {isProcessing ? '正在处理...' : '添加费用'} </button>
      </form>
    </div>
  );
};