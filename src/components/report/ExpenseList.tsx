// src/components/report/ExpenseList.tsx

import { useState, useRef } from 'react';
import { 
    FaPlane, FaTrain, FaBus, FaTaxi, FaUtensils, FaHotel, 
    FaBriefcase, FaReceipt, FaParking, FaMobileAlt, FaShippingFast,
    FaGlassCheers, FaSmile, FaEllipsisH, FaTimes, // ✅ 修改：引入了 FaGlassCheers 和 FaSmile
    FaEdit, FaTrash, FaFilePdf, FaEye
} from 'react-icons/fa';
import Image from 'next/image';
import { toast } from 'sonner';
import type { Database } from '@/types/database.types';

type Report = Database['public']['Tables']['reports']['Row'];
type Expense = Database['public']['Tables']['expenses']['Row'];
type Customer = Database['public']['Tables']['customers']['Row'];

interface ExpenseListProps {
    report: Report;
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

const categoryIcons: Record<string, React.ReactNode> = {
    '飞机': <FaPlane className="text-blue-500" />,
    '火车': <FaTrain className="text-blue-500" />,
    '长途汽车': <FaBus className="text-blue-500" />,
    'Taxi': <FaTaxi className="text-yellow-500" />,
    '餐饮': <FaUtensils className="text-orange-500" />,
    '住宿': <FaHotel className="text-indigo-500" />,
    '办公用品': <FaBriefcase className="text-gray-500" />,
    '过路费': <FaReceipt className="text-red-500" />,
    '停车费': <FaParking className="text-blue-600" />,
    '电信费': <FaMobileAlt className="text-green-500" />,
    '快递费': <FaShippingFast className="text-yellow-600" />,
    // ✅ 修改：使用了新的图标
    '客户招待': <FaGlassCheers className="text-indigo-500" />, 
    '员工福利': <FaSmile className="text-pink-500" />,
    '其他': <FaEllipsisH className="text-gray-400" />,
};

export const ExpenseList = ({
    report, expenses, isOwner, isDraft, isProcessing,
    editingExpenseId, editingExpenseData, setEditingExpenseData,
    onEditExpense, onCancelEdit, onUpdateExpense, onDeleteExpense,
    customers, editingNewFiles, setEditingNewFiles
}: ExpenseListProps) => {
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setEditingNewFiles(Array.from(e.target.files));
        }
    };

    const handleRemoveExistingFile = (urlToRemove: string) => {
        const currentUrls = editingExpenseData.receipt_urls || [];
        setEditingExpenseData({
            ...editingExpenseData,
            receipt_urls: currentUrls.filter(url => url !== urlToRemove)
        });
    };

    const handleRemoveNewFile = (indexToRemove: number) => {
        setEditingNewFiles(editingNewFiles.filter((_, index) => index !== indexToRemove));
    };

    const openPreview = (url: string) => {
        if (url.endsWith('.pdf')) {
            window.open(url, '_blank');
        } else {
            setPreviewImage(url);
        }
    };
    
    const isPdf = (url: string) => url.toLowerCase().includes('.pdf');
    const getFileName = (url: string) => {
        try {
            const urlObj = new URL(url);
            const path = urlObj.pathname;
            return path.substring(path.lastIndexOf('/') + 1);
        } catch {
            return '未知文件';
        }
    };

    if (expenses.length === 0) {
        return <div className="p-8 text-center text-gray-500 bg-white rounded-lg shadow-sm border border-dashed border-gray-300">暂无费用明细</div>;
    }

    return (
        <div className="space-y-4">
            {expenses.map((expense) => (
                <div key={expense.id} className={`bg-white p-4 rounded-lg shadow-sm border transition-all hover:shadow-md ${editingExpenseId === expense.id ? 'ring-2 ring-blue-500' : 'border-gray-100'}`}>
                    {editingExpenseId === expense.id ? (
                        // --- 编辑模式 ---
                        <div className="space-y-4">
                            <div className="flex justify-between items-center mb-2">
                                <h3 className="font-bold text-lg">编辑费用</h3>
                                <span className="text-sm text-gray-500">ID: {expense.id}</span>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">费用类型</label>
                                    <select 
                                        value={editingExpenseData.category || ''} 
                                        onChange={e => setEditingExpenseData({ ...editingExpenseData, category: e.target.value })}
                                        className="w-full px-3 py-2 border rounded-md"
                                    >
                                        {Object.keys(categoryIcons).map(cat => (
                                            <option key={cat} value={cat}>{cat}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">金额</label>
                                    <input 
                                        type="number" step="0.01"
                                        value={editingExpenseData.amount || ''} 
                                        onChange={e => setEditingExpenseData({ ...editingExpenseData, amount: parseFloat(e.target.value) })}
                                        className="w-full px-3 py-2 border rounded-md"
                                    />
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">日期</label>
                                    <input 
                                        type="date"
                                        value={editingExpenseData.expense_date || ''} 
                                        onChange={e => setEditingExpenseData({ ...editingExpenseData, expense_date: e.target.value })}
                                        className="w-full px-3 py-2 border rounded-md"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">客户</label>
                                     <select
                                        value={editingExpenseData.customer_name || ''}
                                        onChange={e => setEditingExpenseData({ ...editingExpenseData, customer_name: e.target.value || null })}
                                        className="w-full px-3 py-2 border rounded-md"
                                    >
                                        <option value="">(无)</option>
                                        {customers.map(c => (
                                            <option key={c.id} value={c.name}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">备注</label>
                                <textarea 
                                    value={editingExpenseData.description || ''} 
                                    onChange={e => setEditingExpenseData({ ...editingExpenseData, description: e.target.value })}
                                    rows={2}
                                    className="w-full px-3 py-2 border rounded-md"
                                ></textarea>
                            </div>
                            
                             {/* 编辑模式下的文件管理 */}
                             <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">凭证文件</label>
                                
                                {/* 现有文件 */}
                                {editingExpenseData.receipt_urls && editingExpenseData.receipt_urls.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mb-2">
                                        {editingExpenseData.receipt_urls.map((url, index) => (
                                            <div key={index} className="relative group border rounded-lg overflow-hidden w-20 h-20 bg-gray-100 flex items-center justify-center">
                                                {isPdf(url) ? <FaFilePdf className="text-red-500 text-2xl" /> : 
                                                 <Image src={url} alt="凭证" fill className="object-cover" />
                                                }
                                                <button type="button" onClick={() => handleRemoveExistingFile(url)} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <FaTimes size={10} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* 新添加的文件 */}
                                {editingNewFiles.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mb-2">
                                        {editingNewFiles.map((file, index) => (
                                            <div key={index} className="relative group border rounded-lg p-2 w-20 h-20 bg-blue-50 flex flex-col items-center justify-center text-xs overflow-hidden">
                                                {file.type === 'application/pdf' ? <FaFilePdf className="text-red-500 text-lg mb-1" /> : <span className="text-gray-500">图片</span>}
                                                <span className="truncate w-full text-center">{file.name}</span>
                                                <button type="button" onClick={() => handleRemoveNewFile(index)} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <FaTimes size={10} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                
                                <input type="file" ref={fileInputRef} multiple accept="image/*,application/pdf" onChange={handleFileChange} className="hidden" />
                                <button type="button" onClick={() => fileInputRef.current?.click()} className="text-sm text-blue-600 hover:text-blue-700 flex items-center">
                                    + 添加新文件
                                </button>
                            </div>

                            <div className="flex justify-end gap-2 mt-4">
                                <button type="button" onClick={onCancelEdit} disabled={isProcessing} className="px-3 py-1.5 border rounded-md text-gray-600 hover:bg-gray-50">取消</button>
                                <button type="button" onClick={onUpdateExpense} disabled={isProcessing} className="px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                                    {isProcessing ? '保存中...' : '保存修改'}
                                </button>
                            </div>
                        </div>
                    ) : (
                        // --- 查看模式 ---
                        <div className="flex items-start">
                            <div className="p-3 rounded-full bg-gray-50 mr-4">
                                <span className="text-2xl">{categoryIcons[expense.category] || categoryIcons['其他']}</span>
                            </div>
                            <div className="flex-grow">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h4 className="font-bold text-lg flex items-center">
                                            {expense.category}
                                            {expense.customer_name && <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">{expense.customer_name}</span>}
                                        </h4>
                                        <p className="text-gray-500 text-sm">{expense.expense_date}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-xl text-blue-600">¥ {expense.amount.toFixed(2)}</p>
                                        {expense.is_vat_invoice && <span className="text-xs text-green-600 bg-green-50 px-1 rounded">专票 {expense.tax_rate}%</span>}
                                    </div>
                                </div>
                                {expense.description && <p className="text-gray-600 mt-1">{expense.description}</p>}
                                
                                {/* 凭证缩略图 */}
                                {expense.receipt_urls && expense.receipt_urls.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mt-3">
                                        {expense.receipt_urls.map((url, index) => (
                                            <div key={index} className="relative group w-16 h-16 border rounded-md overflow-hidden cursor-pointer hover:opacity-80" onClick={() => openPreview(url)}>
                                                {isPdf(url) ? (
                                                    <div className="flex flex-col items-center justify-center h-full bg-gray-100 text-red-500">
                                                        <FaFilePdf size={24} />
                                                        <span className="text-[8px] text-gray-500 truncate w-full text-center px-1">{getFileName(url)}</span>
                                                    </div>
                                                ) : (
                                                    <Image src={url} alt="凭证" fill className="object-cover" />
                                                )}
                                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                                    <FaEye className="text-white opacity-0 group-hover:opacity-100" />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            
                            {/* 操作按钮 (仅草稿状态且是本人) */}
                            {isOwner && isDraft && (
                                <div className="flex flex-col gap-2 ml-4">
                                    <button onClick={() => onEditExpense(expense)} className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-full transition-colors">
                                        <FaEdit />
                                    </button>
                                    <button onClick={() => onDeleteExpense(expense)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors">
                                        <FaTrash />
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            ))}

            {/* 图片预览弹窗 */}
            {previewImage && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setPreviewImage(null)}>
                    <div className="relative max-w-4xl max-h-[90vh] w-full h-full">
                        <Image src={previewImage} alt="凭证大图" fill className="object-contain" />
                        <button className="absolute top-4 right-4 text-white bg-black/50 p-2 rounded-full hover:bg-black/70">
                            <FaTimes size={24} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};