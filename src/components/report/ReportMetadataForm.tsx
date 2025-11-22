// src/components/report/ReportMetadataForm.tsx

'use client';
import { SearchableSelect } from '../shared/SearchableSelect';
type Customer = { id: string | number; name: string | null };

interface ReportMetadataFormProps {
    customers: Customer[];
    reportCustomerName: string;
    onCustomerNameChange: (name: string) => void;
    billToCustomer: boolean;
    onBillToCustomerChange: (checked: boolean) => void;
    onSave: () => void;
    isProcessing: boolean;
}

export const ReportMetadataForm = ({
    customers,
    reportCustomerName,
    onCustomerNameChange,
    billToCustomer,
    onBillToCustomerChange,
    onSave,
    isProcessing,
}: ReportMetadataFormProps) => {
    return (
        <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-bold mb-4">客户信息 (用于请款)</h2>
            <div className="space-y-4">
                <div>
                    <label htmlFor="reportCustomerName" className="block text-sm font-medium text-gray-700">客户名称</label>
                    <SearchableSelect
                        placeholder="搜索客户名称或拼音"
                        options={customers}
                        value={reportCustomerName}
                        onChange={onCustomerNameChange}
                    />
                </div>
                <div className="flex items-center">
                    <input
                        id="reportBillToCustomer"
                        type="checkbox"
                        checked={billToCustomer}
                        onChange={e => onBillToCustomerChange(e.target.checked)}
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                    />
                    <label htmlFor="reportBillToCustomer" className="ml-2 block text-sm text-gray-900">此报销单需向客户请款</label>
                </div>
                <button
                    onClick={onSave}
                    disabled={isProcessing}
                    className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400"
                >
                    {isProcessing ? '保存中...' : '保存客户信息'}
                </button>
            </div>
        </div>
    );
};