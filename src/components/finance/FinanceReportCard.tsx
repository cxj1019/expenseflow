//src\components\finance\FinanceReportCard.tsx

'use client'
import { useState } from 'react';
import Link from 'next/link';
import type { ReportWithProfile } from '@/hooks/useFinanceData';

interface FinanceReportCardProps {
    report: ReportWithProfile;
    onUpdate: (reportId: number, updates: { is_invoice_received: boolean; is_paid: boolean }) => Promise<void>;
}

export const FinanceReportCard = ({ report, onUpdate }: FinanceReportCardProps) => {
    const [isInvoiceReceived, setIsInvoiceReceived] = useState(report.is_invoice_received || false);
    const [isPaid, setIsPaid] = useState(report.is_paid || false);
    const [isSaving, setIsSaving] = useState(false);
    const hasChanged = (report.is_invoice_received || false) !== isInvoiceReceived || (report.is_paid || false) !== isPaid;
    const handleSave = async () => {
        setIsSaving(true);
        await onUpdate(report.id, { is_invoice_received: isInvoiceReceived, is_paid: isPaid });
        setIsSaving(false);
    };
    const handleInvoiceReceivedChange = (checked: boolean) => {
        setIsInvoiceReceived(checked);
        if (!checked) setIsPaid(false);
    }

    return (
        <div className="bg-white p-4 border rounded-lg shadow-sm grid grid-cols-5 gap-4 items-center">
            <div className="col-span-2">
                <Link href={`/dashboard/report/${report.id}`} className="font-semibold text-blue-600 hover:underline break-all" title="查看详情">{report.title}</Link>
                <p className="text-sm text-gray-500">提交人: <span className="font-medium text-gray-700">{report.profiles?.full_name || 'N/A'}</span></p>
                <p className="text-xs text-gray-400">批准于: {new Date(report.final_approved_at!).toLocaleDateString()}</p>
            </div>
            <div className="col-span-1 text-center">
                <p className="text-lg font-mono font-semibold text-gray-800">¥{report.total_amount.toFixed(2)}</p>
            </div>
            <div className="col-span-2 flex items-center justify-end gap-4">
                <div className="flex items-center">
                    <input id={`invoice-${report.id}`} type="checkbox" checked={isInvoiceReceived} onChange={(e) => handleInvoiceReceivedChange(e.target.checked)} className="h-4 w-4 text-indigo-600 border-gray-300 rounded"/>
                    <label htmlFor={`invoice-${report.id}`} className="ml-2 text-sm text-gray-700">收到发票</label>
                </div>
                <div className="flex items-center">
                    <input id={`paid-${report.id}`} type="checkbox" checked={isPaid} onChange={(e) => setIsPaid(e.target.checked)} disabled={!isInvoiceReceived} className="h-4 w-4 text-indigo-600 border-gray-300 rounded"/>
                    <label htmlFor={`paid-${report.id}`} className={`ml-2 text-sm ${!isInvoiceReceived ? 'text-gray-400' : 'text-gray-700'}`}>已付款</label>
                </div>
                {hasChanged && (
                    <button onClick={handleSave} disabled={isSaving} className="px-3 py-1 text-sm font-semibold text-white bg-green-600 rounded-md hover:bg-green-700 disabled:bg-gray-400">
                        {isSaving ? '保存中...' : '保存'}
                    </button>
                )}
            </div>
        </div>
    );
};