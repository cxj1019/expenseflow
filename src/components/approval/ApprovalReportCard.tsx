// src/components/approval/ApprovalReportCard.tsx

import Link from 'next/link';
import type { Database } from '@/types/database.types';

type Profile = Database['public']['Tables']['profiles']['Row'];
type Report = Database['public']['Tables']['reports']['Row'] & { profiles: Profile | null };

// 状态徽章的辅助组件
const StatusBadge = ({ status }: { status: string }) => {
    const styles: { [key: string]: string } = {
        approved: 'bg-green-100 text-green-800',
        rejected: 'bg-red-100 text-red-800',
        send_back: 'bg-yellow-100 text-yellow-800',
        pending_partner_approval: 'bg-purple-100 text-purple-800 font-semibold',
    };
    return <span className={`px-2 py-1 text-xs rounded-full ${styles[status] || 'bg-gray-100 text-gray-800'}`}>{status}</span>;
}

export const ApprovalReportCard = ({ report }: { report: Report }) => {
  return (
    <Link href={`/dashboard/report/${report.id}`} key={report.id}>
      <div className="bg-white p-4 border rounded-lg transition-all duration-200 hover:shadow-lg hover:border-blue-500 cursor-pointer flex flex-col justify-between h-full">
        <div>
          <div className="flex justify-between items-start mb-2">
            <h3 className="font-bold text-gray-800 pr-2 break-all">{report.title}</h3>
            {report.status !== 'submitted' && <StatusBadge status={report.status} />}
          </div>
          <p className="text-sm text-gray-500 mb-2">
            提交人: <span className="font-medium text-gray-700">{report.profiles?.full_name || 'N/A'}</span>
          </p>
        </div>
        <div className="flex justify-between items-end mt-2 pt-2 border-t border-gray-100">
            <div className="text-sm text-gray-500">
                <span>提交于: </span>
                <span>{new Date(report.submitted_at!).toLocaleDateString()}</span>
            </div>
            <p className="text-lg font-semibold font-mono text-gray-800">
                ¥{report.total_amount?.toFixed(2) || '0.00'}
            </p>
        </div>
      </div>
    </Link>
  );
};