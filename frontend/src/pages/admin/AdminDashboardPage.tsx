import { useQuery } from '@tanstack/react-query'
import { Activity, Clock3, DoorOpen, RadioTower, TrendingUp } from 'lucide-react'
import { adminApi } from '../../api/adminApi'
import { DepartmentLoadChart } from '../../components/admin/DepartmentLoadChart'
import { HospitalOverviewCards } from '../../components/admin/HospitalOverviewCards'
import { OperationalCharts } from '../../components/admin/OperationalCharts'
import { PeakHourChart } from '../../components/admin/PeakHourChart'
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton'
import { PageHeader } from '../../components/common/PageHeader'

export function AdminDashboardPage() {
  const query = useQuery({ queryKey: ['admin-dashboard'], queryFn: adminApi.getDashboard, refetchInterval: 30_000 })
  if (query.isLoading) return <LoadingSkeleton rows={7}/>

  const data = query.data!
  const peak = data.forecasts.find((item) => item.is_peak)
  const averageWait = Math.round(data.rooms.reduce((sum, room) => sum + room.averageWait, 0) / data.rooms.length)
  const openRooms = data.rooms.filter((room) => room.status === 'OPEN').length
  const peakTime = peak ? new Date(peak.checkin_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : 'Không có'

  return <>
    <PageHeader
      title="Tổng quan bệnh viện"
      description="Theo dõi tải khám, nguồn lực và dự báo cao điểm trên một màn hình điều hành thống nhất."
      action={<span className="inline-flex min-h-10 items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 text-xs font-bold text-emerald-700"><RadioTower size={15}/>Tự cập nhật mỗi 30 giây</span>}
    />

    <section aria-label="Tóm tắt vận hành" className="mb-5 grid gap-4 md:grid-cols-3">
      <BriefCard icon={<TrendingUp/>} label="Cao điểm tiếp theo" value={peakTime} detail={peak ? `Dự báo ${Math.round(peak.predicted_checkin_count)} lượt check-in` : 'Không phát hiện cao điểm'} tone="bg-[#fff4ee] text-[#b45835]"/>
      <BriefCard icon={<Clock3/>} label="Chờ trung bình toàn viện" value={`${averageWait} phút`} detail="Theo các phòng đang được theo dõi" tone="bg-sky-50 text-sky-700"/>
      <BriefCard icon={<DoorOpen/>} label="Phòng đang hoạt động" value={`${openRooms}/${data.rooms.length}`} detail="Nguồn lực sẵn sàng tiếp nhận" tone="bg-emerald-50 text-emerald-700"/>
    </section>

    <HospitalOverviewCards/>
    <div className="mt-5 grid gap-5 xl:grid-cols-[1.4fr_.6fr]"><PeakHourChart data={data.forecasts}/><DepartmentLoadChart/></div>
    <OperationalCharts/>
    <div className="mt-5 flex items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900"><Activity size={19} className="mt-0.5 shrink-0"/><p><strong>Dữ liệu hỗ trợ vận hành:</strong> mọi điều chỉnh nguồn lực vẫn cần được người phụ trách ca trực xác nhận trước khi áp dụng.</p></div>
  </>
}

function BriefCard({ icon, label, value, detail, tone }: { icon: React.ReactNode; label: string; value: string; detail: string; tone: string }) {
  return <div className="clinical-surface flex items-center gap-4 p-4"><span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${tone}`}>{icon}</span><div className="min-w-0"><p className="truncate text-xs font-bold text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-black tracking-tight text-foreground">{value}</p><p className="mt-1 truncate text-xs text-muted-foreground">{detail}</p></div></div>
}
