'use client';

import { useState, useEffect, FormEvent, ChangeEvent, useRef } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type { Database } from '@/types/database.types';
import type { User } from '@supabase/supabase-js';
import { SearchableSelect } from '../shared/SearchableSelect';
import { FaCamera, FaCloudUploadAlt, FaTimes } from 'react-icons/fa';
import imageCompression from 'browser-image-compression';
import { toast } from 'sonner'; 

type Customer = Database['public']['Tables']['customers']['Row'];
const EXPENSE_CATEGORIES = ['飞机', '火车', '长途汽车', 'Taxi', '餐饮', '住宿', '办公用品', '客户招待', '员工福利', '其他'];

interface AddExpenseFormProps {
  reportId: number;
  user: User | null;
  customers: Customer[];
  onExpenseAdded: () => void;
}

export const AddExpenseForm = ({ reportId, user, customers, onExpenseAdded }: AddExpenseFormProps) => {
  const supabase = createClientComponentClient<Database>();
  
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [amount, setAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [selectedExpenseCustomer, setSelectedExpenseCustomer] = useState('');
  const [receiptFiles, setReceiptFiles] = useState<File[]>([]);
  const [isVatInvoice, setIsVatInvoice] = useState(false);
  const [taxRate, setTaxRate] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (category === '飞机' || category === '火车') {
      setIsVatInvoice(true);
      setTaxRate('9');
    } else {
      setIsVatInvoice(false);
      setTaxRate('');
    }
  }, [category]);

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const originalFiles = Array.from(e.target.files);
      setReceiptFiles(prev => [...prev, ...originalFiles]);
    }
    // 关键：每次选择后清空 value，否则安卓手机上同名文件可能无法再次触发选择
    if (e.target) e.target.value = '';
  };

  const removeFile = (index: number) => {
    setReceiptFiles(prev => prev.filter((_, i) => i !== index));
  };

  // 压缩并上传逻辑
  const compressAndUploadFile = async (file: File) => {
    try {
      const options = {
        maxSizeMB: 0.8,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
        fileType: 'image/jpeg'
      };

      let fileToUpload = file;
      if (file.type.startsWith('image/')) {
        setUploadStatus(`正在压缩: ${file.name}...`);
        try {
            fileToUpload = await imageCompression(file, options);
        } catch (err) {
            console.error("压缩失败，使用原图", err);
        }
      }

      setUploadStatus(`正在上传: ${file.name}...`);

      const presignResponse = await fetch('/api/upload-r2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileType: fileToUpload.type }),
      });
      
      if (!presignResponse.ok) throw new Error('获取上传凭证失败');
      const { uploadUrl, accessUrl } = await presignResponse.json();
      
      const uploadResponse = await fetch(uploadUrl, { 
          method: 'PUT', 
          body: fileToUpload, 
          headers: { 'Content-Type': fileToUpload.type }
      });
      
      if (!uploadResponse.ok) throw new Error('上传云存储失败');
      return accessUrl;

    } catch (error) {
      console.error(error);
      throw error;
    }
  };

  const handleAddExpense = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      alert('请输入有效的金额'); 
      return;
    }

    let parsedTaxRate = null;
    if (isVatInvoice) {
        if (!taxRate) { alert('请输入税率'); return; }
        parsedTaxRate = parseFloat(taxRate);
    }

    setIsProcessing(true);
    setUploadStatus('准备上传...');
    
    const receiptUrls: string[] = [];

    try {
      if (receiptFiles.length > 0) {
        for (const file of receiptFiles) {
            const url = await compressAndUploadFile(file);
            receiptUrls.push(url);
        }
      }

      setUploadStatus('正在保存...');

      const insertData = {
        report_id: reportId,
        user_id: user.id,
        category,
        amount: parsedAmount,
        expense_date: expenseDate,
        description: description.trim() || null,
        customer_name: selectedExpenseCustomer.trim() || null,
        invoice_number: invoiceNumber || null,
        receipt_urls: receiptUrls.length > 0 ? receiptUrls : null,
        is_vat_invoice: isVatInvoice,
        tax_rate: parsedTaxRate,
      };

      const { error: insertError } = await supabase.from('expenses').insert([insertData] as any);
      if (insertError) throw insertError;

      setCategory(EXPENSE_CATEGORIES[0]);
      setAmount('');
      setDescription('');
      setSelectedExpenseCustomer('');
      setReceiptFiles([]);
      setInvoiceNumber('');
      setUploadStatus('');
      onExpenseAdded();
      
      // 如果有 toast 库建议使用
      // toast.success('添加成功');

    } catch (error: any) {
      alert(`操作失败: ${error.message}`);
    } finally {
      setIsProcessing(false);
      setUploadStatus('');
    }
  };

  return (
    <div className="bg-white p-4 md:p-6 rounded-lg shadow-md transition-all relative">
      {isProcessing && (
          <div className="absolute inset-0 bg-white/80 z-50 flex flex-col items-center justify-center rounded-lg">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-2"></div>
              <p className="text-blue-600 font-medium text-sm">{uploadStatus}</p>
          </div>
      )}

      <h2 className="text-xl md:text-2xl font-bold mb-4 flex items-center gap-2">
        <span>🧾</span> 记一笔
      </h2>
      <form onSubmit={handleAddExpense} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">费用类型</label>
                <select value={category} onChange={e => setCategory(e.target.value)} required className="w-full px-3 py-2 border rounded-md bg-white text-base">
                    {EXPENSE_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">金额 (¥)</label>
                <input type="number" value={amount} onChange={e => setAmount(e.target.value)} required step="0.01" className="w-full px-3 py-2 border rounded-md text-base" placeholder="0.00"/>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">消费日期</label>
                <input type="date" value={expenseDate} onChange={e => setExpenseDate(e.target.value)} required className="w-full px-3 py-2 border rounded-md bg-white"/>
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">归属客户</label>
                <SearchableSelect placeholder="搜索客户..." options={customers} value={selectedExpenseCustomer} onChange={setSelectedExpenseCustomer} />
            </div>
        </div>

        <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">备注</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className="w-full px-3 py-2 border rounded-md text-sm" placeholder="选填"></textarea>
        </div>

        <div className="bg-gray-50 p-3 rounded-md border border-gray-100">
          <div className="flex items-center">
            <input id="isVatInvoice" type="checkbox" checked={isVatInvoice} onChange={e => setIsVatInvoice(e.target.checked)} className="h-5 w-5 text-blue-600 rounded"/>
            <label htmlFor="isVatInvoice" className="ml-2 block text-sm text-gray-900 font-medium">增值税专用发票</label>
          </div>
          {isVatInvoice && (
            <div className="mt-3 animate-fade-in grid grid-cols-2 gap-4">
                <input type="text" placeholder="发票号码" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} className="w-full px-3 py-2 border rounded-md text-sm"/>
                <div className="relative">
                    <input type="number" value={taxRate} onChange={e => setTaxRate(e.target.value)} placeholder="税率" className="w-full px-3 py-2 border rounded-md text-sm pr-6"/>
                    <span className="absolute right-2 top-2 text-gray-500">%</span>
                </div>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">发票凭证</label>
          
          <div className="grid grid-cols-2 gap-4 mb-3">
             {/* 拍照按钮 */}
             <button 
                type="button" 
                onClick={() => cameraInputRef.current?.click()}
                className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-blue-300 bg-blue-50 rounded-lg text-blue-600 hover:bg-blue-100 transition-colors active:scale-95"
             >
                <FaCamera className="text-2xl mb-1" />
                <span className="text-sm font-bold">拍照</span>
             </button>

             {/* 相册按钮 */}
             <button 
                type="button" 
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-300 bg-gray-50 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors active:scale-95"
             >
                <FaCloudUploadAlt className="text-2xl mb-1" />
                <span className="text-sm">相册/文件</span>
             </button>
          </div>

          {/* Android 兼容性设置核心：
            Input 1 (Camera): 只加 capture="environment"，严禁加 multiple
            Input 2 (File): 加 multiple，不加 capture
            样式使用 style={{display:'none'}} 避免某些浏览器布局塌陷问题
          */}
          <input 
            type="file" 
            ref={cameraInputRef} 
            accept="image/*" 
            capture="environment" 
            style={{ display: 'none' }}
            onChange={handleFileChange} 
          />
          
          <input 
            type="file" 
            ref={fileInputRef} 
            accept="image/*,application/pdf" 
            multiple 
            style={{ display: 'none' }}
            onChange={handleFileChange} 
          />

          {receiptFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {receiptFiles.map((file, index) => (
                <div key={index} className="relative group bg-gray-100 px-3 py-1 rounded-full text-xs text-gray-700 flex items-center border">
                  <span className="max-w-[100px] truncate mr-4">{file.name}</span>
                  <button type="button" onClick={() => removeFile(index)} className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-red-500">
                    <FaTimes />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <button type="submit" disabled={isProcessing} className="w-full py-3 px-4 border border-transparent rounded-lg shadow-sm text-base font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 transition-colors">
            {isProcessing ? '处理中...' : '确认添加'} 
        </button>
      </form>
    </div>
  );
};