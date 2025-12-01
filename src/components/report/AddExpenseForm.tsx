// src/components/report/AddExpenseForm.tsx

'use client';

import { useState, useEffect, FormEvent, ChangeEvent, useRef } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type { Database } from '@/types/database.types';
import type { User } from '@supabase/supabase-js';
import { SearchableSelect } from '../shared/SearchableSelect';
import { FaCamera, FaCloudUploadAlt, FaTimes, FaMagic, FaFilePdf } from 'react-icons/fa';
import imageCompression from 'browser-image-compression';
import { toast } from 'sonner';
import { convertPdfToImage } from '@/utils/pdfHelpers';

type Customer = Database['public']['Tables']['customers']['Row'];
const EXPENSE_CATEGORIES = ['飞机', '火车', '长途汽车', 'Taxi', '餐饮', '住宿', '办公用品', '客户招待', '员工福利', '其他'];

interface AddExpenseFormProps {
  reportId: number;
  user: User | null;
  customers: Customer[];
  onExpenseAdded: () => void;
}

type FileWithPreview = File & { preview?: string };

export const AddExpenseForm = ({ reportId, user, customers, onExpenseAdded }: AddExpenseFormProps) => {
  const supabase = createClientComponentClient<Database>();
  
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [amount, setAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [selectedExpenseCustomer, setSelectedExpenseCustomer] = useState('');
  const [receiptFiles, setReceiptFiles] = useState<FileWithPreview[]>([]);
  const [isVatInvoice, setIsVatInvoice] = useState(false);
  const [taxRate, setTaxRate] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [uploadedCache, setUploadedCache] = useState<Record<string, string>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if ((category === '飞机' || category === '火车') && !isVatInvoice) {
        setIsVatInvoice(true);
        setTaxRate('9');
    }
  }, [category]); 

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const rawFiles = Array.from(e.target.files);
      const newFilesWithPreview: FileWithPreview[] = [];

      setIsAnalyzing(true);
      setUploadStatus('正在处理文件...');

      try {
        for (const file of rawFiles) {
            let previewFile: Blob = file;
            let previewUrl = '';

            // 1. 如果是 PDF，转图片用于预览和AI识别
            if (file.type === 'application/pdf') {
                try {
                    setUploadStatus('正在转换 PDF...');
                    previewFile = await convertPdfToImage(file);
                    previewUrl = URL.createObjectURL(previewFile);
                } catch (err) {
                    console.error(err);
                    toast.error(`PDF ${file.name} 转换失败`);
                    // 转换失败则显示默认图标，不阻断流程
                    previewUrl = 'pdf'; 
                }
            } 
            // 2. 如果是图片，稍微压缩一下生成预览
            else if (file.type.startsWith('image/')) {
                const options = { maxSizeMB: 0.8, maxWidthOrHeight: 1920, useWebWorker: true, fileType: 'image/jpeg' };
                try {
                    previewFile = await imageCompression(file, options);
                } catch (e) { console.warn(e); }
                previewUrl = URL.createObjectURL(previewFile);
            }
            
            // @ts-ignore
            file.preview = previewUrl; 
            // @ts-ignore
            file.convertedBlob = previewFile; // 暂存转换后的 Blob (如果是PDF，这里是转换后的图片；如果是图片，这里是压缩后的图片)
            
            newFilesWithPreview.push(file as FileWithPreview);
        }

        setReceiptFiles(prev => [...prev, ...newFilesWithPreview]);

        // 3. 触发 AI 分析 (只分析本次添加的第一张)
        if (newFilesWithPreview.length > 0) {
            const firstFile = newFilesWithPreview[0];
            // @ts-ignore
            const blobToAnalyze = firstFile.convertedBlob || firstFile;
            
            // 只有当它是图片（或PDF转换后的图片）时才分析
            if (blobToAnalyze instanceof Blob) {
                await triggerAIAnalysis(blobToAnalyze);
            }
        }

      } finally {
        setIsAnalyzing(false);
        setUploadStatus('');
      }
    }
    if (e.target) e.target.value = '';
  };

  const removeFile = (index: number) => {
    setReceiptFiles(prev => {
        const fileToRemove = prev[index];
        if (fileToRemove.preview && fileToRemove.preview !== 'pdf') {
            URL.revokeObjectURL(fileToRemove.preview);
        }
        return prev.filter((_, i) => i !== index);
    });
  };

  // --- 统一分析入口 (接收 Blob) ---
  const triggerAIAnalysis = async (blob: Blob) => {
    setIsAnalyzing(true);
    setUploadStatus('🤖 AI正在读取票据...');
    try {
        const base64String = await blobToBase64(blob);
        await sendToAI(base64String);
    } catch (err) {
        console.error(err);
        toast.error('读取图片数据失败');
        setIsAnalyzing(false);
        setUploadStatus('');
    }
  };

  // --- 发送给后端 ---
  const sendToAI = async (base64String: string) => {
      setUploadStatus('🤖 AI正在分析数据...');
      try {
        const response = await fetch('/api/analyze-receipt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ base64Image: base64String }),
        });

        if (!response.ok) {
            const errText = await response.text();
            let errorMsg = response.statusText;
            try {
                const errorJson = JSON.parse(errText);
                errorMsg = errorJson.error || errorJson.message;
            } catch(e) {}
            throw new Error(`AI服务错误: ${errorMsg}`);
        }
        
        const data = await response.json();
        console.log("AI Result:", data);

        if (data.amount) setAmount(data.amount.toString());
        if (data.date) setExpenseDate(data.date);
        if (data.category && EXPENSE_CATEGORIES.includes(data.category)) setCategory(data.category);
        if (data.invoice_number) setInvoiceNumber(data.invoice_number);
        
        if (data.is_vat_special !== undefined) {
            setIsVatInvoice(data.is_vat_special);
            if (data.is_vat_special && data.tax_rate) setTaxRate(data.tax_rate.toString());
            else setTaxRate(''); 
        } else if (data.tax_rate) {
             setTaxRate(data.tax_rate.toString());
        }

        toast.success('识别成功！');
      } catch (err: any) {
        console.error("AI流程错误:", err);
        toast.error(err.message || '识别失败');
      } finally {
        setIsAnalyzing(false);
        setUploadStatus('');
      }
  };

  // --- 上传 R2 ---
  const uploadFileToR2 = async (file: File): Promise<string> => {
      const presignRes = await fetch('/api/upload-r2', { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileType: file.type }) 
      });
      if (!presignRes.ok) throw new Error('获取上传链接失败');
      const { uploadUrl, accessUrl } = await presignRes.json();

      const uploadRes = await fetch(uploadUrl, { 
          method: 'PUT', body: file, headers: { 'Content-Type': file.type } 
      });
      if (!uploadRes.ok) throw new Error('上传云存储失败');
      return accessUrl;
  };

  const handleAddExpense = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;

    if (!amount || parseFloat(amount) <= 0) { toast.error('请输入金额'); return; }
    if (isVatInvoice && !taxRate) { toast.error('请输入税率'); return; }

    setIsProcessing(true);
    setUploadStatus('正在上传凭证...');
    
    const receiptUrls: string[] = [];

    try {
      for (const file of receiptFiles) {
          const fileKey = `${file.name}-${file.size}`;
          let url = uploadedCache[fileKey];

          if (!url) {
              setUploadStatus(`正在上传: ${file.name}...`);
              // 提交时：如果是图片则压缩上传，如果是PDF则上传原文件
              let fileToUpload = file as File;
              if (file.type.startsWith('image/')) {
                  const options = { maxSizeMB: 0.8, maxWidthOrHeight: 1920, useWebWorker: true, fileType: 'image/jpeg' };
                  try {
                    fileToUpload = await imageCompression(file, options);
                  } catch(e) { console.warn("压缩失败", e); }
              }
              
              url = await uploadFileToR2(fileToUpload);
              setUploadedCache(prev => ({ ...prev, [fileKey]: url }));
          }
          if (url) receiptUrls.push(url);
      }

      setUploadStatus('正在保存...');

      const insertData = {
        report_id: reportId, user_id: user.id, category,
        amount: parseFloat(amount), expense_date: expenseDate,
        description: description.trim() || null,
        customer_name: selectedExpenseCustomer.trim() || null,
        invoice_number: invoiceNumber || null,
        receipt_urls: receiptUrls.length > 0 ? receiptUrls : null,
        is_vat_invoice: isVatInvoice,
        tax_rate: isVatInvoice ? parseFloat(taxRate) : null,
      };

      const { error: insertError } = await supabase.from('expenses').insert([insertData] as any);
      if (insertError) throw insertError;

      setCategory(EXPENSE_CATEGORIES[0]); setAmount(''); setDescription('');
      setSelectedExpenseCustomer(''); setReceiptFiles([]); setUploadedCache({});
      setInvoiceNumber(''); setUploadStatus('');
      
      toast.success('添加成功！');
      onExpenseAdded();

    } catch (error: any) {
      toast.error(`保存失败: ${error.message}`);
    } finally {
      setIsProcessing(false);
      setUploadStatus('');
    }
  };

  return (
    <div className="bg-white p-4 md:p-6 rounded-lg shadow-md transition-all relative">
      {(isProcessing || isAnalyzing) && (
          <div className="absolute inset-0 bg-white/90 z-50 flex flex-col items-center justify-center rounded-lg backdrop-blur-sm">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-2"></div>
              <p className="text-blue-600 font-medium px-4 text-center">{uploadStatus}</p>
          </div>
      )}

      <h2 className="text-xl md:text-2xl font-bold mb-4 flex items-center gap-2"><span>🧾</span> 记一笔</h2>
      
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
             <button type="button" onClick={() => cameraInputRef.current?.click()} className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-blue-300 bg-blue-50 rounded-lg text-blue-600 hover:bg-blue-100 transition-colors active:scale-95">
                <FaCamera className="text-2xl mb-1" />
                <span className="text-sm font-bold">拍照识别</span>
             </button>
             <button type="button" onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-300 bg-gray-50 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors active:scale-95">
                <FaCloudUploadAlt className="text-2xl mb-1" />
                <span className="text-sm">相册/文件</span>
             </button>
          </div>

          <input type="file" ref={cameraInputRef} accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleFileChange} />
          <input type="file" ref={fileInputRef} accept="image/*,application/pdf" multiple style={{ display: 'none' }} onChange={handleFileChange} />

          {/* 预览区域 (移除了大图调试预览) */}
          {receiptFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {receiptFiles.map((file, index) => (
                <div key={index} className="relative group bg-gray-100 px-3 py-1 rounded-full text-xs text-gray-700 flex items-center border">
                  <span className="max-w-[100px] truncate mr-4">{file.name}</span>
                  {file.type === 'application/pdf' && <FaFilePdf className="text-red-500 mr-1" />}
                  <button type="button" onClick={() => removeFile(index)} className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-red-500"><FaTimes /></button>
                </div>
              ))}
            </div>
          )}
        </div>

        <button type="submit" disabled={isProcessing || isAnalyzing} className="w-full py-3 px-4 border border-transparent rounded-lg shadow-sm text-base font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 transition-colors">
            {(isProcessing) ? '正在上传保存...' : '确认添加'} 
        </button>
      </form>
    </div>
  );
};