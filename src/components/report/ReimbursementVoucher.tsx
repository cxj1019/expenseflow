// src/components/report/ReimbursementVoucher.tsx

'use client';

import React, { forwardRef } from 'react';
import type { Database } from '@/types/database.types';
import type { ReportWithRelations } from '@/hooks/useReportData';
import { digitToChinese } from '@/utils/currency';

type Expense = Database['public']['Tables']['expenses']['Row'];

interface Props {
    report: ReportWithRelations | null;
    expenses: Expense[];
}

export const ReimbursementVoucher = forwardRef<HTMLDivElement, Props>(({ report, expenses }, ref) => {
    if (!report) return null;

    // 补齐空行逻辑
    const MIN_ROWS = 8;
    const emptyRowsCount = Math.max(0, MIN_ROWS - expenses.length);
    const emptyRows = Array(emptyRowsCount).fill(null);

    const totalAmount = expenses.reduce((sum, item) => sum + item.amount, 0);
    const attachmentCount = expenses.reduce((count, item) => count + (item.receipt_urls?.length || 0), 0);

    // 辅助函数：格式化金额（千分位 + 保留两位小数）
    const formatCurrency = (amount: number) => {
        return amount.toLocaleString('en-US', { 
            minimumFractionDigits: 2, 
            maximumFractionDigits: 2 
        });
    };

    return (
        <>
            <div id="print-voucher-root" className="hidden" ref={ref}>
                <div className="p-8 max-w-[1000px] mx-auto text-black font-serif bg-white">
                    
                    {/* 标题栏 */}
                    <div className="flex justify-between items-end mb-4 px-2">
                        <div className="w-1/3"></div>
                        <h1 className="text-3xl font-bold tracking-[0.5em] text-center w-1/3 text-black">报销凭单</h1>
                        <div className="w-1/3 text-right text-lg text-black">
                            <span className="font-bold">报销人：</span>
                            <span className="underline decoration-1 underline-offset-4 px-2">{report.profiles?.full_name || '未填写'}</span>
                        </div>
                    </div>

                    {/* 表格主体 */}
                    <div className="border-[2px] border-black text-black">
                        <table className="w-full border-collapse text-center">
                            <thead>
                                <tr className="h-12 text-lg">
                                    <th className="border border-black w-12 font-bold text-black">序号</th>
                                    <th className="border border-black w-28 font-bold text-black">日期</th>
                                    <th className="border border-black w-32 font-bold text-black">公司/客户</th>
                                    <th className="border border-black font-bold text-black">事 由</th>
                                    <th className="border border-black w-28 font-bold text-black">金 额</th>
                                    <th className="border border-black w-20 font-bold text-black">主管</th>
                                    <th className="border border-black w-20 font-bold text-black">出纳</th>
                                    <th className="border border-black w-20 font-bold text-black">签字</th>
                                </tr>
                            </thead>
                            <tbody>
                                {expenses.map((expense, index) => (
                                    <tr key={expense.id} className="h-10 text-base">
                                        <td className="border border-black text-black">{index + 1}</td>
                                        <td className="border border-black text-black">{new Date(expense.expense_date).toLocaleDateString()}</td>
                                        <td className="border border-black text-sm px-1 truncate max-w-[100px] text-black">{expense.customer_name || '-'}</td>
                                        <td className="border border-black text-left px-2 text-black">
                                            <span className="font-semibold">[{expense.category}]</span> 
                                            {expense.description ? ` ${expense.description}` : ''}
                                        </td>
                                        {/* 核心修改：应用千分位格式化 */}
                                        <td className="border border-black text-right px-2 font-mono text-black font-bold">
                                            {formatCurrency(expense.amount)}
                                        </td>
                                        <td className="border border-black"></td>
                                        <td className="border border-black"></td>
                                        <td className="border border-black"></td>
                                    </tr>
                                ))}

                                {emptyRows.map((_, index) => (
                                    <tr key={`empty-${index}`} className="h-10">
                                        <td className="border border-black text-black">{expenses.length + index + 1}</td>
                                        <td className="border border-black"></td>
                                        <td className="border border-black"></td>
                                        <td className="border border-black"></td>
                                        <td className="border border-black"></td>
                                        <td className="border border-black"></td>
                                        <td className="border border-black"></td>
                                        <td className="border border-black"></td>
                                    </tr>
                                ))}

                                <tr className="h-10 font-bold">
                                    <td className="border border-black text-black" colSpan={4}>小 计</td>
                                    {/* 核心修改：应用千分位格式化 */}
                                    <td className="border border-black text-right px-2 font-mono text-black text-lg">
                                        {formatCurrency(totalAmount)}
                                    </td>
                                    <td className="border border-black bg-gray-50" colSpan={3}></td>
                                </tr>

                                <tr className="h-14">
                                    <td className="border border-black font-bold text-lg text-black">总 计</td>
                                    <td className="border border-black text-left px-4 text-lg font-serif tracking-widest text-black" colSpan={7}>
                                        <div className="flex justify-between items-center w-full">
                                            <span>{digitToChinese(totalAmount)}</span>
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div className="mt-1 border-[2px] border-t-0 border-black p-2 text-center text-lg font-serif text-black">
                        票 证 粘 贴 于 反 面 （ 附 件 <span className="underline px-4 font-bold">{attachmentCount}</span> 张 ）
                    </div>
                    
                    <div className="mt-4 text-xs text-right text-gray-400">
                        打印时间: {new Date().toLocaleString()}
                    </div>
                </div>
            </div>

            <style jsx global>{`
                @media print {
                    html, body {
                        margin: 0;
                        padding: 0;
                        background: white;
                        height: auto; 
                    }
                    body > *:not(#print-voucher-root) {
                        display: none !important;
                    }
                    #print-voucher-root {
                        display: block !important;
                        position: relative; 
                        width: 100%;
                        height: auto;
                        overflow: visible;
                    }
                    @page {
                        size: A4 landscape;
                        margin: 10mm; 
                    }
                }
            `}</style>
        </>
    );
});

ReimbursementVoucher.displayName = 'ReimbursementVoucher';