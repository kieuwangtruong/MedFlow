import { useQuery } from '@tanstack/react-query'
import { Activity, ArrowRight, Clock, DoorOpen, Stethoscope, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { doctorApi } from '../../api/doctorApi'
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton'
import { PageHeader } from '../../components/common/PageHeader'
import { DoctorQueueTable } from '../../components/doctor/DoctorQueueTable'
import { Button } from '../../components/ui/button'
import { useAuthStore } from '../../stores/authStore'

export function DoctorDashboardPage() {
  const user = useAuthStore((state) => state.user)
  const query = useQuery({ queryKey: ['doctor-queue'], queryFn: doctorApi.getQueue })
  const assignmentQuery = useQuery({ queryKey: ['doctor-assignment'], queryFn: doctorApi.getAssignment })
  if (query.isLoading || assignmentQuery.isLoading) return <LoadingSkeleton/>

  const queue = query.data ?? []
  const assignment = assignmentQuery.data
  const priorityCases = queue.filter((item) => ['EMERGENCY', 'URGENT', 'HIGH'].includes(item.priority)).length

  return <>
    <PageHeader
      title={`Xin chào, ${user?.full_name ?? 'bác sĩ'}`}
      description={assignment
        ? `${assignment.room.name} · Ca ${formatShift(assignment.shiftStart, assignment.shiftEnd)} · Hàng đợi cập nhật theo thời gian thực`
        : 'Tài khoản chưa có phân công phòng đang hoạt động.'}
      action={<Button asChild><Link to="/doctor/queue">Mở hàng đợi<ArrowRight/></Link></Button>}
    />

    <section aria-label="Chỉ số ca trực" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <Kpi icon={<Users/>} label="Đang chờ" value={queue.length} note="2 ca mới trong 15 phút" tone="bg-sky-50 text-sky-700"/>
      <Kpi icon={<Activity/>} label="Cần ưu tiên" value={priorityCases} note="Cần xử lý sớm" tone="bg-red-50 text-red-700"/>
      <Kpi icon={<Stethoscope/>} label="Đang khám" value="1" note="Bắt đầu 12 phút trước" tone="bg-violet-50 text-violet-700"/>
      <Kpi icon={<Clock/>} label="Chờ kết quả" value="4" note="Gần nhất còn 8 phút" tone="bg-amber-50 text-amber-700"/>
      <Kpi icon={<DoorOpen/>} label="Phòng hiện tại" value={assignment?.room.code ?? '—'} note={assignment ? 'Đang tiếp nhận' : 'Chưa phân công'} tone="bg-emerald-50 text-emerald-700"/>
    </section>

    <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
      <section className="min-w-0" aria-labelledby="next-patients-title">
        <div className="mb-3 flex items-end justify-between gap-4">
          <div><h2 id="next-patients-title" className="text-xl font-extrabold tracking-tight text-foreground">Bệnh nhân tiếp theo</h2><p className="mt-1 text-sm text-muted-foreground">Sắp xếp theo mức ưu tiên lâm sàng và thời gian chờ.</p></div>
          <Link className="shrink-0 text-sm font-bold text-primary hover:underline" to="/doctor/queue">Xem tất cả</Link>
        </div>
        <DoctorQueueTable items={queue.slice(0, 5)}/>
      </section>

      <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
        <div className="overflow-hidden rounded-2xl bg-[#17324d] text-white shadow-[0_16px_38px_rgba(23,50,77,.18)]">
          <div className="border-b border-white/10 p-5"><p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-sky-200/70">Hiệu suất ca trực</p><div className="mt-3 flex items-end justify-between"><div><p className="text-4xl font-black">12</p><p className="mt-1 text-sm text-slate-300">bệnh nhân đã hoàn thành</p></div><span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-2.5 py-1 text-xs font-bold text-emerald-200">75% mục tiêu</span></div></div>
          <div className="p-5"><div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full w-3/4 rounded-full bg-[#ea7a50]"/></div><div className="mt-3 flex justify-between text-xs text-slate-300"><span>Đã hoàn thành 12</span><span>Mục tiêu 16 ca</span></div></div>
        </div>
        <div className="card"><h3 className="font-extrabold text-foreground">Thông tin vận hành</h3><dl className="mt-4 space-y-3 text-sm"><Row label="Thời gian khám TB" value="14 phút"/><Row label="Chờ trung bình" value="24 phút"/><Row label="Tỷ lệ đúng lịch" value="91%"/></dl><p className="mt-4 rounded-xl bg-sky-50 p-3 text-xs leading-5 text-sky-800">Các chỉ số hỗ trợ điều phối, không thay thế đánh giá lâm sàng của bác sĩ.</p></div>
      </aside>
    </div>
  </>
}

function Kpi({ icon, label, value, note, tone }: { icon: React.ReactNode; label: string; value: string | number; note: string; tone: string }) {
  return <div className="card relative overflow-hidden"><span className={`grid h-11 w-11 place-items-center rounded-xl ${tone}`}>{icon}</span><p className="mt-4 text-sm font-semibold text-muted-foreground">{label}</p><p className="mt-1 text-3xl font-black tracking-tight text-foreground">{value}</p><p className="mt-2 text-xs leading-5 text-muted-foreground">{note}</p></div>
}

const Row = ({ label, value }: { label: string; value: string }) => <div className="flex justify-between gap-3 border-b border-border pb-3 last:border-0 last:pb-0"><dt className="text-muted-foreground">{label}</dt><dd className="font-bold text-foreground">{value}</dd></div>

function formatShift(start: string, end: string) {
  const format = (value: string) => new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
  return `${format(start)}–${format(end)}`
}
