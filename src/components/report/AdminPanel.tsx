// src/components/report/AdminPanel.tsx


'use client';

interface AdminPanelProps {
    invoiceReceived: boolean;
    onInvoiceReceivedChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    isPaid: boolean;
    onIsPaidChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    canMarkAsPaid: boolean;
    onSave: () => void;
    isProcessing: boolean;
}

export const AdminPanel = ({
    invoiceReceived,
    onInvoiceReceivedChange,
    isPaid,
    onIsPaidChange,
    canMarkAsPaid,
    onSave,
    isProcessing,
}: AdminPanelProps) => {
    return (
        <div className="p-4 border border-blue-200 bg-blue-50 rounded-lg">
            <h3 className="text-lg font-bold text-blue-800 mb-3">管理员操作 (财务)</h3>
            <div className="space-y-3">
                <div className="flex items-center">
                    <input id="invoiceReceived" type="checkbox" checked={invoiceReceived} onChange={onInvoiceReceivedChange} className="h-4 w-4 text-blue-600 border-gray-300 rounded"/>
                    <label htmlFor="invoiceReceived" className="ml-2 block text-sm font-medium text-gray-900">已收到发票</label>
                </div>
                <div className="flex items-center">
                    <input id="isPaid" type="checkbox" checked={isPaid} onChange={onIsPaidChange} disabled={!canMarkAsPaid} className="h-4 w-4 text-blue-600 border-gray-300 rounded disabled:bg-gray-200"/>
                    <label htmlFor="isPaid" className={`ml-2 block text-sm font-medium ${!canMarkAsPaid ? 'text-gray-400' : 'text-gray-900'}`}>已付款 (需先收到发票)</label>
                </div>
            </div>
            <button onClick={onSave} disabled={isProcessing} className="mt-4 w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400">
                {isProcessing ? '保存中...' : '保存财务状态'}
            </button>
        </div>
    );
};