// src/components/report/RequestFormPDF.tsx

'use client';

import type { ReportWithRelations } from '@/hooks/useReportData';
import type { Database } from '@/types/database.types';

type Expense = Database['public']['Tables']['expenses']['Row'];

interface RequestFormPDFProps {
    report: ReportWithRelations | null;
    expenses: Expense[];
    submitterName: string;
}

export const RequestFormPDF = ({ report, expenses = [], submitterName }: RequestFormPDFProps) => {
    if (!report) return null;

    // --- 核心计算逻辑 (修正版) ---
    
    // 1. 获取报销单总金额 (例如: 109)
    const totalExpenseAmount = report.total_amount || 0;

    // 2. 计算员工发票中的“进项税金” (例如: 9)
    // 只有标记为专票 (is_vat_invoice) 的才计算
    const totalInputVAT = expenses.reduce((sum, item) => {
        if (item.is_vat_invoice && item.tax_rate) {
            // 公式: 价税合计 - (价税合计 / (1 + 税率))
            const net = item.amount / (1 + item.tax_rate / 100);
            return sum + (item.amount - net);
        }
        return sum;
    }, 0);

    // 3. 计算净成本 (不含税金额) (例如: 109 - 9 = 100)
    // 这是我们要向客户收取的“本金”
    const netCost = totalExpenseAmount - totalInputVAT;

    // 4. 计算请求书的“销项税金” (服务业增值税 6%) (例如: 100 * 6% = 6)
    const serviceOutputVAT = netCost * 0.06;

    // 5. 计算请求书的“含税合计金额” (例如: 100 + 6 = 106)
    const finalRequestTotal = netCost + serviceOutputVAT;


    // 格式化日期
    const formatDate = (dateString: string | null) => {
        const date = dateString ? new Date(dateString) : new Date();
        return {
            year: date.getFullYear(),
            month: date.getMonth() + 1,
            day: date.getDate()
        };
    };
    const { year, month, day } = formatDate(report.final_approved_at);

    // 样式定义 (保持 Hex 颜色)
    const styles = {
        container: {
            width: '210mm',
            minHeight: '297mm',
            padding: '48px', 
            backgroundColor: '#ffffff',
            color: '#000000',
            fontFamily: '"SimSun", "STSong", serif',
            lineHeight: '1.6',
            fontSize: '14px',
        },
        header: { marginBottom: '32px' },
        title: {
            textAlign: 'center' as const,
            fontSize: '30px',
            fontWeight: 'bold',
            margin: '40px 0',
            letterSpacing: '1em',
        },
        date: {
            display: 'flex',
            justifyContent: 'flex-end',
            marginBottom: '24px',
            fontSize: '16px',
        },
        customer: { marginBottom: '32px' },
        customerUnderline: {
            display: 'inline-block',
            minWidth: '300px',
            paddingBottom: '4px',
            borderBottom: '1px solid #000000',
            fontSize: '18px',
        },
        table: {
            width: '100%',
            borderCollapse: 'collapse' as const,
            border: '1px solid #000000',
            marginBottom: '32px',
        },
        th: {
            border: '1px solid #000000',
            padding: '12px',
            fontWeight: 'normal',
            textAlign: 'center' as const,
            width: '50%',
            backgroundColor: '#f9fafb',
        },
        tdBorder: {
            border: '1px solid #000000',
            padding: '8px',
            verticalAlign: 'middle',
        },
        tdTitle: {
            border: '1px solid #000000',
            padding: '16px',
            verticalAlign: 'top',
            height: '192px',
            fontSize: '18px',
        },
        flexBetween: {
            display: 'flex',
            justifyContent: 'space-between',
            padding: '0 16px',
        },
        bankInfo: { marginLeft: '8px' },
        bankRow: { display: 'flex', marginBottom: '12px' },
        bankLabel: { width: '96px', fontWeight: 'bold', flexShrink: 0 },
        smallText: { fontSize: '12px', fontFamily: 'sans-serif' }
    };

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <p style={{ fontWeight: 'bold', fontSize: '18px' }}>上海迈伊兹会计师事务所有限公司</p>
                <p style={{ fontWeight: 'bold', fontSize: '18px' }}>SHANGHAI MYTS CERTIFIED PUBLIC ACCOUNTANTS LTD.</p>
            </div>

            <h1 style={styles.title}>請　求　書</h1>

            <div style={styles.date}>
                <p>{year}年 {month}月 {day}日</p>
            </div>

            <div style={styles.customer}>
                <p style={styles.customerUnderline}>
                    {report.customer_name || '客户名称未填写'}　　　　御中
                </p>
            </div>

            <p style={{ marginBottom: '16px' }}>请根据以下请求，进行银行转账。</p>

            <table style={styles.table}>
                <thead>
                    <tr>
                        <th style={styles.th}>業　務　内　　容</th>
                        <th style={styles.th}>金　　額 （通貨）</th>
                    </tr>
                </thead>
                <tbody>
                    {/* 第一行：业务名称 + 净成本 (不含税金额) */}
                    <tr>
                        <td style={styles.tdTitle} rowSpan={3}>
                            {report.title}
                        </td>
                        <td style={styles.tdBorder}>
                            <div style={styles.flexBetween}>
                                <span>RMB :</span>
                                <span style={{ fontSize: '18px' }}>
                                    {netCost.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </div>
                        </td>
                    </tr>
                    
                    {/* 第二行：销项税金 (6%) */}
                    <tr>
                        <td style={styles.tdBorder}>
                            <div style={styles.flexBetween}>
                                <span>税金合计（6%增值税） RMB :</span>
                                <span>
                                    {serviceOutputVAT.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </div>
                        </td>
                    </tr>

                    {/* 第三行：含税合计 (最终请求金额) */}
                    <tr>
                        <td style={styles.tdBorder}>
                            <div style={{ ...styles.flexBetween, fontWeight: 'bold' }}>
                                <span>含税金额合计 RMB :</span>
                                <span>
                                    {finalRequestTotal.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>

            <p style={{ marginBottom: '24px' }}>请在收到请求书2周内，将以上金额转入下面的账户中。</p>

            <div style={styles.bankInfo}>
                <div style={styles.bankRow}>
                    <span style={styles.bankLabel}>收款方：</span> 
                    <div>
                        <p>上海迈伊兹会计师事务所有限公司</p>
                        <p style={styles.smallText}>(SHANGHAI MYTS CERTIFIED PUBLIC ACCOUNTANTS LTD.)</p>
                    </div>
                </div>
                <div style={styles.bankRow}>
                    <span style={styles.bankLabel}>振込銀行：</span>
                    <div>
                        <p>中国工商银行股份有限公司上海市泗泾支行</p>
                        <p style={styles.smallText}>(Industrial and Commercial Bank of China Limited Shanghai Sijing Sub-branch)</p>
                    </div>
                </div>
                <div style={styles.bankRow}>
                    <span style={styles.bankLabel}>口座番号：</span>
                    <p>1001709519300444265（RMB）</p>
                </div>
                <div style={styles.bankRow}>
                    <span style={styles.bankLabel}>银行地址：</span>
                    <div>
                        <p>上海市松江区泗泾镇鼓浪路412号</p>
                        <p style={styles.smallText}>(412 Gulang Road, Sijing Town, Songjiang District, China Shanghai)</p>
                    </div>
                </div>
            </div>

            <div style={{ marginTop: '80px', display: 'flex', justifyContent: 'flex-end', paddingRight: '40px', position: 'relative' }}>
                <div style={{ textAlign: 'center', position: 'relative', zIndex: 10 }}>
                    <p style={{ marginBottom: '32px' }}>业务担当：{submitterName}</p>
                </div>
            </div>
        </div>
    );
};