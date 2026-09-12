import { Clock3, MapPinned } from 'lucide-react'
import { Link } from 'react-router-dom'
import { EmptyState } from '../../components/common/EmptyState'
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton'
import { PageHeader } from '../../components/common/PageHeader'
import { CarePathwayTimeline } from '../../components/patient/CarePathwayTimeline'
import { usePatientPathway } from '../../hooks/usePatientPathway'
import { useVisitStore } from '../../stores/visitStore'

export function CarePathwayPage() {
  const visitId = useVisitStore((s) => s.visitId)
  const query = usePatientPathway(visitId)

  if (!visitId) {
    return (
      <>
        <PageHeader title="Lộ trình khám" />
        <EmptyState title="Chưa có lượt khám" description="Bạn cần check-in trước khi xem lộ trình." />
        <Link to="/patient/checkin" className="mx-auto mt-5 block w-fit rounded-xl bg-primary px-5 py-3 font-bold text-white">Đi đến check-in</Link>
      </>
    )
  }

  if (query.isLoading) return <LoadingSkeleton />
  const data = query.data!

  return (
    <>
      <PageHeader title="Lộ trình khám" description="Tự động cập nhật mỗi 15 giây." />
      <div className="sticky top-20 z-20 mb-6 grid gap-3 rounded-2xl bg-slate-900 p-4 text-white shadow-xl sm:grid-cols-4">
        <Metric label="Số thứ tự" value={data.queueNumber} />
        <Metric label="Phòng hiện tại" value={data.currentRoom} />
        <Metric label="Phía trước" value={`${data.peopleAhead} bệnh nhân`} />
        <Metric label="Chờ dự kiến" value={data.isDelayed ? `${data.estimatedWait} phút (+${Math.round(data.delayMinutes || 0)}' trễ)` : `${data.estimatedWait} phút`} />
      </div>

      {data.isDelayed && data.delayAlert && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 text-amber-950 shadow-sm">
          <Clock3 className="shrink-0 text-amber-600 animate-pulse" size={24} />
          <div className="min-w-0 flex-1">
            <p className="font-extrabold text-amber-950">{data.delayAlert.title}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-amber-800">{data.delayAlert.reason}</p>
          </div>
          <span className="shrink-0 rounded-lg bg-amber-200/80 px-2.5 py-1 text-xs font-black text-amber-900">
            +{Math.round(data.delayAlert.delayMinutes)}'
          </span>
        </div>
      )}

      <div className="card">
        <h2 className="section-title mb-6"><MapPinned />Hành trình của bạn</h2>
        <CarePathwayTimeline steps={data.steps} />
      </div>
    </>
  )
}
const Metric = ({ label, value }: { label: string; value: string }) => <div><p className="text-xs text-slate-400">{label}</p><p className="font-extrabold">{value}</p></div>
