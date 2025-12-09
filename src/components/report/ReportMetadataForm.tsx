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
    
    // 辅助函数：清空客户
    const handleClearCustomer = () => {
        onCustomerNameChange('');
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-100">
            <h2 className="text-lg font-bold mb-4 text-gray-800 flex items-center">
                📝 客户信息配置
                <span className="ml-2 text-xs font-normal text-gray-500">(仅用于向客户请款的报销单)</span>
            </h2>
            
            <div className="space-y-5">
                {/* 开关：是否请款 */}
                <div className="flex items-start">
                    <div className="flex items-center h-5">
                        <input
                            id="reportBillToCustomer"
                            type="checkbox"
                            checked={billToCustomer}
                            onChange={e => onBillToCustomerChange(e.target.checked)}
                            className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                        />
                    </div>
                    <div className="ml-3 text-sm">
                        <label htmlFor="reportBillToCustomer" className="font-medium text-gray-900 cursor-pointer">
                            此报销单需向客户请款
                        </label>
                        <p className="text-gray-500">勾选后，该报销单将被归类为项目成本，并生成请款请求书。</p>
                    </div>
                </div>

                {/* 客户选择区域 - 只有勾选后才高亮显示 */}
                <div className={`transition-all duration-300 ${billToCustomer ? 'opacity-100' : 'opacity-50 grayscale'}`}>
                    <div className="flex justify-between items-center mb-1">
                        <label htmlFor="reportCustomerName" className="block text-sm font-medium text-gray-700">客户名称</label>
                        {reportCustomerName && billToCustomer && (
                            <button 
                                onClick={handleClearCustomer}
                                className="text-xs text-red-500 hover:text-red-700 hover:underline"
                            >
                                清空 / 删除对象
                            </button>
                        )}
                    </div>
                    <SearchableSelect
                        placeholder={billToCustomer ? "搜索客户名称或拼音..." : "无需填写 (未启用请款)"}
                        options={customers}
                        value={reportCustomerName}
                        onChange={onCustomerNameChange}
                    />
                </div>

                <div className="pt-2">
                    <button
                        onClick={onSave}
                        disabled={isProcessing}
                        className={`w-full py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white transition-colors
                            ${billToCustomer 
                                ? 'bg-indigo-600 hover:bg-indigo-700' 
                                : 'bg-gray-500 hover:bg-gray-600'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                        {isProcessing ? '保存中...' : '保存配置'}
                    </button>
                </div>
            </div>
        </div>
    );
};