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

    // --- 1. 数据计算 ---
    
    // 💡 调整：竖向空间更大，最少显示 12 行，填满版面
    const MIN_ROWS = 12;
    
    const emptyRowsCount = Math.max(0, MIN_ROWS - expenses.length);
    const emptyRows = Array(emptyRowsCount).fill(null);

    const totalAmount = expenses.reduce((sum, item) => sum + item.amount, 0);
    const attachmentCount = expenses.reduce((count, item) => count + (item.receipt_urls?.length || 0), 0);

    const categoryStats = expenses.reduce((acc, item) => {
        const cat = item.category || '其他';
        if (!acc[cat]) acc[cat] = { total: 0, tax: 0 };
        acc[cat].total += item.amount;
        if (item.is_vat_invoice && item.tax_rate) {
            const netAmount = item.amount / (1 + item.tax_rate / 100);
            acc[cat].tax += (item.amount - netAmount);
        }
        return acc;
    }, {} as Record<string, { total: number; tax: number }>);

    const totalVAT = Object.values(categoryStats).reduce((sum, stat) => sum + stat.tax, 0);
    const totalExcludingTax = totalAmount - totalVAT;

    const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    return (
        <>
            <div id="print-voucher-root" className="hidden" ref={ref}>
                {/* 💡 调整：宽度改为 max-w-[800px] 适配竖向 A4 */}
                <div className="p-8 max-w-[800px] mx-auto text-black font-serif bg-white text-sm leading-normal">
                    
                    {/* 标题部分 */}
                    <div className="mb-2 pt-4">
                        <h1 className="text-3xl font-bold tracking-[1em] text-center border-b-2 border-black pb-2 mb-1 mx-1">费用报销单</h1>
                        <div className="text-center text-xs tracking-widest text-gray-500 mb-6">EXPENSE REIMBURSEMENT FORM</div>
                        
                        <div className="flex justify-between items-end px-1 mb-2 font-normal text-sm">
                            <div>
                                <span className="font-bold">报销部门：</span>
                                <span className="underline decoration-dotted underline-offset-4 px-2 min-w-[100px] inline-block text-left">
                                    {report.profiles?.department || '未填写'}
                                </span>
                            </div>
                            <div>
                                <span className="font-bold">报销日期：</span>
                                <span className="underline decoration-dotted underline-offset-4 px-2">
                                    {new Date().toLocaleDateString()}
                                </span>
                            </div>
                            <div>
                                <span className="font-bold">单据编号：</span>
                                <span className="font-mono text-sm font-bold border border-black px-2 py-0.5 bg-gray-50">
                                    {String(report.id).padStart(8, '0')}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* 外框包裹表格 */}
                    <div className="border-2 border-black border-b-0">
                        <table className="w-full border-collapse text-center table-fixed">
                            
                            {/* 💡 调整：针对窄版面优化列宽 */}
                            <colgroup>
                                <col style={{ width: '6%' }} />  {/* 序号 */}
                                <col style={{ width: '13%' }} /> {/* 日期 */}
                                <col style={{ width: '20%' }} /> {/* 客户 */}
                                <col style={{ width: '35%' }} /> {/* 事由 (稍微收窄) */}
                                <col style={{ width: '6%' }} />  {/* 单据 */}
                                <col style={{ width: '20%' }} /> {/* 金额 (保证显示) */}
                            </colgroup>

                            <thead className="table-header-group">
                                <tr className="h-10 text-sm bg-gray-100 font-bold">
                                    <th className="border-b border-r border-black py-2">序号</th>
                                    <th className="border-b border-r border-black">消费日期</th>
                                    <th className="border-b border-r border-black">客户/项目</th>
                                    <th className="border-b border-r border-black">事 由</th>
                                    <th className="border-b border-r border-black">单据</th>
                                    <th className="border-b border-black">金额 (元)</th>
                                </tr>
                            </thead>
                            
                            <tbody>
                                {expenses.map((expense, index) => (
                                    <tr key={expense.id} className="h-10 text-sm">
                                        <td className="border-b border-r border-black">{index + 1}</td>
                                        <td className="border-b border-r border-black font-mono text-xs whitespace-nowrap">{new Date(expense.expense_date).toLocaleDateString()}</td>
                                        <td className="border-b border-r border-black text-left px-1 truncate text-xs" title={expense.customer_name || ''}>{expense.customer_name}</td>
                                        <td className="border-b border-r border-black text-left px-2 py-1 text-xs break-words whitespace-normal leading-tight">
                                            <span className="font-bold">[{expense.category}]</span> {expense.description}
                                            {expense.is_vat_invoice && <span className="text-[10px] ml-1 border rounded px-1 border-gray-500 text-gray-600 scale-75 inline-block">专</span>}
                                        </td>
                                        <td className="border-b border-r border-black">{expense.receipt_urls?.length || 0}</td>
                                        <td className="border-b border-black text-right px-2 font-mono whitespace-nowrap">{fmt(expense.amount)}</td>
                                    </tr>
                                ))}
                                
                                {emptyRows.map((_, index) => (
                                    <tr key={`empty-${index}`} className="h-10">
                                        <td className="border-b border-r border-black"></td>
                                        <td className="border-b border-r border-black"></td>
                                        <td className="border-b border-r border-black"></td>
                                        <td className="border-b border-r border-black"></td>
                                        <td className="border-b border-r border-black"></td>
                                        <td className="border-b border-black"></td>
                                    </tr>
                                ))}

                                {/* 合计行 */}
                                <tr className="h-12 font-bold bg-gray-50 avoid-break">
                                    <td className="border-b border-r border-black">合计</td>
                                    <td className="border-b border-r border-black text-left px-4 text-base tracking-widest" colSpan={4}>
                                        ⊗ {digitToChinese(totalAmount)}
                                    </td>
                                    <td className="border-b border-black text-right px-2 font-mono text-lg whitespace-nowrap">
                                        ¥ {fmt(totalAmount)}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* 底部汇总区 */}
                    <div className="border-2 border-black border-t-0 flex avoid-break">
                        
                        {/* 左侧：分类汇总 */}
                        <div className="w-1/2 border-r border-black p-4 flex flex-col justify-between text-left">
                            <div>
                                <div className="font-bold mb-2 text-xs text-gray-500 uppercase tracking-wider border-b border-gray-300 pb-1">费用分类汇总 (Category & VAT)</div>
                                <div className="grid grid-cols-1 gap-y-1 text-xs">
                                    {Object.entries(categoryStats).map(([cat, stat]) => (
                                        <div key={cat} className="flex justify-between items-center border-b border-dashed border-gray-200 pb-1 last:border-0">
                                            <span className="font-semibold">{cat}</span>
                                            <div className="flex items-center gap-1">
                                                {stat.tax > 0 && <span className="text-[10px] text-gray-500 font-mono scale-90">(税:{fmt(stat.tax)})</span>}
                                                <span className="font-mono w-16 text-right">{fmt(stat.total)}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            
                            <div className="mt-4 pt-2 border-t border-black text-xs text-gray-500">
                                附单据张数：<span className="font-bold text-black text-sm px-1">{attachmentCount}</span> 张
                            </div>
                        </div>

                        {/* 右侧：财务 & 签字 */}
                        <div className="w-1/2 flex flex-col text-left">
                            <div className="p-4 bg-gray-50 border-b border-black">
                                <div className="font-bold mb-2 text-xs text-gray-500 uppercase tracking-wider border-b border-gray-300 pb-1">财务结算 (Financial)</div>
                                <div className="space-y-1 text-xs">
                                    <div className="flex justify-between">
                                        <span>不含税金额:</span>
                                        <span className="font-mono">{fmt(totalExcludingTax)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>进项税额:</span>
                                        <span className="font-mono">{fmt(totalVAT)}</span>
                                    </div>
                                    <div className="flex justify-between items-center border-t border-black pt-1 mt-1 font-bold text-sm">
                                        <span>实付金额:</span>
                                        <span className="font-mono">{fmt(totalAmount)}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex-grow flex text-center text-xs">
                                <div className="flex-1 border-r border-black p-2 flex flex-col justify-between min-h-[80px]">
                                    <span className="text-gray-500">报销人</span>
                                    <span className="font-bold text-sm mb-1">{report.profiles?.full_name}</span>
                                </div>
                                <div className="flex-1 border-r border-black p-2 flex flex-col justify-between">
                                    <span className="text-gray-500">部门主管</span>
                                </div>
                                <div className="flex-1 border-r border-black p-2 flex flex-col justify-between">
                                    <span className="text-gray-500">财务审核</span>
                                </div>
                                <div className="flex-1 p-2 flex flex-col justify-between">
                                    <span className="text-gray-500">总经理</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-2 text-xs text-right text-gray-400">
                        打印时间: {new Date().toLocaleString()}
                    </div>
                </div>
            </div>

            <style jsx global>{`
                @media print {
                    /* 💡 调整：设置为 A4 竖向 */
                    @page { 
                        size: A4 portrait; 
                        margin: 10mm 10mm; /* 稍微减小左右页边距 */
                    }
                    html, body { margin: 0; padding: 0; background: white; height: auto; }
                    body > *:not(#print-voucher-root) { display: none !important; }
                    
                    #print-voucher-root { 
                        display: block !important; 
                        width: 100%; 
                        position: relative; 
                        top: 0; left: 0;
                    }

                    thead { display: table-header-group; }
                    tr { break-inside: avoid; page-break-inside: avoid; }
                    .avoid-break { break-inside: avoid; page-break-inside: avoid; }
                }
            `}</style>
        </>
    );
});

ReimbursementVoucher.displayName = 'ReimbursementVoucher';