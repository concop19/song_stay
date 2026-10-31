import { useState } from 'react';
import { useQuery } from 'convex/react';
import { Download } from 'lucide-react';
import { api } from '../../convex/_generated/api';
import { addDays } from '../../shared/pricing';
import { useAdminProperty } from '../components/AdminShell';
import { todayIso } from '../lib/dates';
import { formatMoney } from '../lib/money';

type Row = { snapshotId: string; businessDate: string; status: string; summary: Record<string, number> };
export function AdminReportsPage() {
  const { property } = useAdminProperty(); const [endDate, setEndDate] = useState(todayIso()); const [startDate, setStartDate] = useState(addDays(todayIso(), -30));
  const rows = useQuery(api.closeout.report, { propertyId: property.propertyId, startDate, endDate }) as Row[] | undefined;
  function exportCsv() { const csv = ['Date,Revenue cents,Payments cents,Occupied units,Open folios', ...(rows ?? []).map((row) => [row.businessDate, row.summary.postedRevenueCents, row.summary.paymentsCents, row.summary.occupiedUnits, row.summary.openFolios].join(','))].join('\n'); const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); const a = document.createElement('a'); a.href = url; a.download = `${property.slug}-operations-${startDate}-${endDate}.csv`; a.click(); URL.revokeObjectURL(url); }
  const currency = property.slug === 'song-homestay' ? 'VND' : 'CAD';
  return <div className="space-y-5"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Báo cáo</p><h1 className="mt-1 text-2xl font-semibold">Báo cáo vận hành</h1></div><button type="button" className="btn-secondary" onClick={exportCsv} disabled={!rows?.length}><Download className="h-4 w-4" /> Xuất CSV kế toán</button></div><div className="card flex flex-wrap gap-3 p-4"><label><span className="field-label">Từ ngày</span><input className="field-input" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label><label><span className="field-label">Đến ngày</span><input className="field-input" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label></div><div className="card overflow-x-auto"><table className="w-full min-w-[44rem] text-left text-sm"><thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500"><tr><th className="p-3">Ngày</th><th className="p-3">Doanh thu</th><th className="p-3">Thanh toán</th><th className="p-3">Căn có khách</th><th className="p-3">Folio mở</th><th className="p-3">Ngoại lệ</th></tr></thead><tbody>{rows?.map((row) => <tr key={row.snapshotId} className="border-b border-stone-100"><td className="p-3 font-semibold">{row.businessDate}</td><td className="p-3">{formatMoney(row.summary.postedRevenueCents, currency)}</td><td className="p-3">{formatMoney(row.summary.paymentsCents, currency)}</td><td className="p-3">{row.summary.occupiedUnits}</td><td className="p-3">{row.summary.openFolios}</td><td className="p-3">{row.summary.openRefundCases + row.summary.channelConflicts}</td></tr>)}</tbody></table>{rows?.length === 0 ? <p className="p-8 text-center text-stone-500">Chưa có dữ liệu khóa sổ trong khoảng ngày này.</p> : null}</div></div>;
}
