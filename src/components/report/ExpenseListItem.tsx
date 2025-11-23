// src/components/report/ExpenseListItem.tsx

'use client';

import React from 'react';
import Image from 'next/image';
import type { Database } from '@/types/database.types';
import { FaPlane, FaTrain, FaUtensils, FaTaxi, FaBuilding, FaFilePdf } from 'react-icons/fa';
import { ImagePreview } from '../shared/ImagePreview';

type Expense = Database['public']['Tables']['expenses']['Row'];

// 类别图标映射
const categoryIcons: { [key: string]: JSX.Element } = {
  '飞机': <FaPlane className="text-blue-500" />,
  '火车': <FaTrain className="text-green-500" />,
  '餐饮': <FaUtensils className="text-orange-500" />,
  'Taxi': <FaTaxi className="text-yellow-500" />,
  // 添加更多图标...
  '默认': <FaBuilding className="text-gray-500" />,
};

interface ExpenseListItemProps {
  expense: Expense;
  isOwner: boolean;
  isDraft: boolean;
  isProcessing: boolean;
  onEdit: (expense: Expense) => void;
  onDelete: (expense: Expense) => void;
}

export const ExpenseListItem = ({ expense, isOwner, isDraft, isProcessing, onEdit, onDelete }: ExpenseListItemProps) => {

  const categoryKey = expense.category || '默认';

  return (
    <div className="bg-gray-50 p-4 border rounded-lg transition-shadow hover:shadow-md">
      <div className="flex justify-between items-start gap-4">
        <div className="flex items-center gap-4 flex-grow">
          <div className="text-2xl w-8 text-center">
            {categoryIcons[categoryKey] || categoryIcons['默认']}
          </div>
          <div>
            <p className="font-bold text-gray-800">{expense.category}</p>
            <p className="text-sm text-gray-500">{expense.expense_date ? new Date(expense.expense_date).toLocaleDateString() : '无日期'}</p>
            {expense.customer_name && <p className="text-sm text-indigo-600">客户: {expense.customer_name}</p>}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-xl font-mono font-semibold text-gray-900">¥{expense.amount?.toFixed(2)}</p>
          {isDraft && isOwner && (
            <div className="flex space-x-2 mt-1">
              <button onClick={() => onEdit(expense)} className="text-xs text-blue-500 hover:underline">修改</button>
              <button onClick={() => onDelete(expense)} disabled={isProcessing} className="text-xs text-red-500 hover:underline disabled:text-gray-400">删除</button>
            </div>
          )}
        </div>
      </div>

      {(expense.description || (expense.receipt_urls && expense.receipt_urls.length > 0)) && (
        <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
          {expense.description && <p className="text-sm text-gray-600 italic">&quot;{expense.description}&quot;</p>}
          {expense.receipt_urls && (
            <div className="flex flex-wrap gap-2">
              {expense.receipt_urls.map((url, index) => {
                const isPdf = url.toLowerCase().endsWith('.pdf');
                return (
                  isPdf ? (
                    <a key={index} href={url} target="_blank" rel="noopener noreferrer" className="block w-16 h-16 rounded border-2 border-transparent hover:border-blue-500 overflow-hidden group relative">
                      <div className="w-full h-full bg-red-50 flex flex-col items-center justify-center text-red-600">
                        <FaFilePdf className="text-2xl"/>
                        <span className="text-xs mt-1">发票 {index + 1}</span>
                      </div>
                    </a>
                  ) : (
                    <ImagePreview key={index} src={url}>
                      {/* 这里添加了 unoptimized 属性，解决移动端预览失败问题 */}
                      <a href={url} target="_blank" rel="noopener noreferrer" className="block w-16 h-16 rounded border-2 border-transparent hover:border-blue-500 overflow-hidden group relative">
                        <Image 
                          src={url} 
                          alt={`发票 ${index+1}`} 
                          width={64} 
                          height={64} 
                          className="w-full h-full object-cover" 
                          unoptimized 
                        />
                      </a>
                    </ImagePreview>
                  )
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};