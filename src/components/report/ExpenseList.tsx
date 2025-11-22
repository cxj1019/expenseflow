// src/components/report/ExpenseList.tsx


'use client';

import type { Database } from '@/types/database.types';
import type { ReportWithRelations } from '@/hooks/useReportData';
import { ExpenseListItem } from './ExpenseListItem';
// ... 其他需要的组件和类型

type Expense = Database['public']['Tables']['expenses']['Row'];

interface ExpenseListProps {
  report: ReportWithRelations | null;
  expenses: Expense[];
  // ... 其他从 page.tsx 传递过来的 props，如 isOwner, isDraft 等
  isOwner: boolean;
  isDraft: boolean;
  isProcessing: boolean;
  onEditExpense: (expense: Expense) => void;
  onDeleteExpense: (expense: Expense) => void;
  // ... 如果有编辑模式，还需要传递 editingExpenseId 等状态
}

export const ExpenseList = ({ report, expenses, isOwner, isDraft, isProcessing, onEditExpense, onDeleteExpense }: ExpenseListProps) => {
  if (!report) return null;

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <div className="flex justify-between items-baseline mb-4 pb-4 border-b">
        <h2 className="text-xl font-bold text-gray-800">费用明细 ({expenses.length} 项)</h2>
        <div className="text-right">
          <p className="text-sm text-gray-500">总计</p>
          <p className="text-2xl font-bold text-gray-800">¥{report.total_amount?.toFixed(2)}</p>
        </div>
      </div>
      
      <div className="space-y-4">
        {expenses.length > 0 ? (
          expenses.map(expense => {
            // 这里可以处理编辑状态的逻辑，为了简化，我们先只展示列表
            // if (editingExpenseId === expense.id) { return <EditExpenseForm ... />; }
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
          <p className="text-gray-500 text-center py-8">此报销单下还没有任何费用。</p>
        )}
      </div>
    </div>
  );
};