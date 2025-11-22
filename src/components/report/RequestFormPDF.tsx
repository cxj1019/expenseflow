// src/components/report/RequestFormPDF.tsx

'use client';

// 从我们创建的 useReportData Hook 文件中导入共享的类型定义
import type { ReportWithRelations } from '@/hooks/useReportData';

// 定义组件接收的 Props
interface RequestFormPDFProps {
    report: ReportWithRelations | null;
    submitterName: string;
}

export const RequestFormPDF = ({ report, submitterName }: RequestFormPDFProps) => {
    // 如果没有报销单数据，则不渲染任何内容
    if (!report) {
        return null;
    }

    // 格式化日期的辅助函数
    const formatDate = (dateString: string | null) => {
        if (!dateString) return { year: '    ', month: '  ', day: '  ' }; // 返回占位符以保持布局
        const date = new Date(dateString);
        return {
            year: date.getFullYear(),
            month: date.getMonth() + 1,
            day: date.getDate()
        };
    };

    // 只有在最终批准后才格式化日期
    const { year, month, day } = formatDate(report.final_approved_at);

    return (
        // 这个 div 模拟了一张 A4 纸
        <div className="p-8 bg-white text-black" style={{ width: '210mm', minHeight: '297mm', fontFamily: "'SimSun', 'STSong'" }}>
            <div className="text-center">
                <p className="text-lg font-bold">上海邁伊茲会計師事務所有限公司</p>
                <p className="text-sm">SHANGHAI MYTS CERTIFIED PUBLIC ACCOUNTANTS LTD.</p>
                <p className="text-xs mt-2">上海市徐汇区虹桥路1号港汇中心1座25楼 TEL：86(21)6407-8585 FAX：86(21)6448-3589</p>
                <p className="text-xs">(25F, 1 Grand Gateway, 1 Hongqiao Rd, Xuhui District, Shanghai 200030 China)</p>
            </div>
            
            <h1 className="text-center text-2xl font-bold my-8" style={{ letterSpacing: '0.5em' }}>
                請　求　書
            </h1>
            
            <div className="flex justify-end mb-4">
                <p>{`${year}年 ${month}月 ${day}日`}</p>
            </div>
            
            <div className="mb-4">
                <p className="border-b-2 border-black pb-1">{report.customer_name || '客户名称未填写'}　　　　御中</p>
            </div>
            
            <p className="mb-4">请根据以下请求，进行银行转账。</p>
            
            <table className="w-full border-collapse border border-black mb-4 text-sm">
                <thead>
                    <tr>
                        <th className="border border-black p-2 font-normal">業務内容</th>
                        <th className="border border-black p-2 font-normal" colSpan={2}>金額（通貨）</th>
                        <th className="border border-black p-2 font-normal">请求金额</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td className="border border-black p-2 h-32 align-top break-words">{report.title}</td>
                        <td className="border border-black p-2 text-center w-24">RMB (含税)</td>
                        <td className="border border-black p-2 text-right w-32">{report.total_amount?.toFixed(2)}</td>
                        <td className="border border-black p-2 text-right w-32">{report.total_amount?.toFixed(2)}</td>
                    </tr>
                </tbody>
            </table>
            
            <p className="mb-4">请在收到请求书2周内，将以上金额转入下面的账户中。</p>
            
            <div className="space-y-2 text-sm">
                <p><span className="font-bold">收款方：</span> 上海迈伊兹会计师事务所有限公司 (SHANGHAI MYTS CERTIFIED PUBLIC ACCOUNTANTS LTD.)</p>
                <p><span className="font-bold">振込銀行：</span> 招商银行徐家汇支行 (CHINA MERCHANTS BANK SHANGHAI BRANCH XU JIA HUI SUB-BRANCH)</p>
                <p><span className="font-bold">口座番号：</span> 212885795610001（RMB）</p>
                <p><span className="font-bold">银行地址：</span> 上海市漕溪北路18号 实业大厦1楼 (1 INDUSTRIAL INVESTMENT BUILDING, 18 NORTH CAO XI RD., SHANGHAI CHINA)</p>
            </div>
            
            <div className="flex justify-end mt-8 text-sm">
                <div className="grid grid-cols-2 gap-x-16">
                    <p>业务担当：{submitterName}</p>
                    <p>财务担当：马建萍</p>
                </div>
            </div>
        </div>
    );
};