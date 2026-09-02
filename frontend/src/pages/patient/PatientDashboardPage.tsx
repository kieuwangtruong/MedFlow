import { ArrowRight, BellRing, CheckCircle2, Clock3, FileCheck2, MapPin, Route, ShieldCheck, Ticket, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { EmptyState } from '../../components/common/EmptyState'
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton'
import { PageHeader } from '../../components/common/PageHeader'
import { Progress } from '../../components/ui/progress'
import { usePatientPathway } from '../../hooks/usePatientPathway'
import { useAuthStore } from '../../stores/authStore'
import { useVisitStore } from '../../stores/visitStore'

export function PatientDashboardPage() {
  const user = useAuthStore((state) => state.user)
  const visitId = useVisitStore((state) => state.visitId)
  const query = usePatientPathway(visitId)

  if (!visitId) return <>
    <PageHeader title={`Xin chào, ${user?.full_name ?? 'bạn'}`} description="Bạn chưa có lượt khám đang hoạt động."/>
    <EmptyState title="Chưa check-in" description="Hãy tạo lượt khám để nhận số thứ tự và theo dõi hành trình tại bệnh viện."/>
    <Link to="/patient/checkin" className="mx-auto mt-5 flex min-h-12 w-fit items-center gap-2 rounded-xl bg-primary px-6 font-bold text-white">Bắt đầu check-in<ArrowRight size={18}/></Link>
  </>
  if (query.isLoading) return <LoadingSkeleton rows={7}/>
  if (!query.data) return <EmptyState title="Không tải được lượt khám" description="Vui lòng thử lại hoặc liên hệ quầy tiếp nhận."/>

  const pathway = query.data
  const pending = pathway.steps.filter((step) => step.status !== 'COMPLETED')
  const roomName = pathway.currentRoom || 'Đang phân phòng'
  const progress = pathway.peopleAhead === 0 ? (pathway.estimatedWait === 0 ? 100 : 90) : Math.max(10, 80 - pathway.peopleAhead * 10)

  return <>
    <PageHeader
      title={`Xin chào, ${user?.full_name ?? 'bạn'}`}
      description="Thông tin lượt khám hôm nay của bạn."
      action={
        <span className="rounded-full bg-amber-50 px-4 py-2 text-sm font-bold text-amber-700">
          {pathway.visitStatus === 'COMPLETED' ? 'Đã hoàn thành' : pathway.visitStatus === 'CALLED' ? 'Đã đến lượt' : pathway.waitingForValidatedResult ? 'Đang kiểm định kết quả' : 'Đang xử lý'}
        </span>
      }
    />

    {pathway.visitStatus === 'CALLED' && (
      <section className="mb-5 flex flex-col justify-between gap-4 rounded-2xl border-2 border-violet-300 bg-violet-700 p-6 text-white shadow-lg sm:flex-row sm:items-center">
        <div className="flex items-center gap-4">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/15">
            <BellRing className="animate-pulse" />
          </span>
          <div>
            <p className="text-sm font-bold uppercase tracking-[.14em] text-violet-100">Đã đến lượt của bạn</p>
            <h2 className="mt-1 text-2xl font-black">Mời {user?.full_name ?? 'bệnh nhân'} vào {roomName}</h2>
          </div>
        </div>
        <div className="rounded-xl bg-white px-6 py-4 text-center text-violet-800">
          <p className="text-xs font-bold uppercase">Số được gọi</p>
          <p className="text-4xl font-black">{pathway.queueNumber}</p>
        </div>
      </section>
    )}

    {pathway.waitingForValidatedResult && (
      <section className="mb-5 flex gap-4 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-amber-950">
        <FileCheck2 className="shrink-0 text-amber-700" />
        <div>
          <h2 className="font-extrabold">Kết quả đang được phòng chỉ định kiểm định</h2>
          <p className="mt-1 text-sm leading-6">Bạn chưa cần quay lại phòng khám ban đầu. Hệ thống sẽ tự động cập nhật sau khi hoàn tất dịch vụ.</p>
        </div>
      </section>
    )}

    {pathway.currentTaskType === 'RETURN_REVIEW' && pathway.resultValidated && (
      <section className="mb-5 flex gap-4 rounded-2xl border border-emerald-300 bg-emerald-50 p-5 text-emerald-950">
        <ShieldCheck className="shrink-0 text-emerald-700" />
        <div>
          <h2 className="font-extrabold">Kết quả cận lâm sàng đã hoàn tất</h2>
          <p className="mt-1 text-sm leading-6">Mời quay lại {roomName} theo số {pathway.queueNumber} để bác sĩ trả kết quả và tư vấn hướng điều trị.</p>
        </div>
      </section>
    )}

    <section className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
      <div className="overflow-hidden rounded-xl border border-sky-200 bg-white shadow-sm">
        <div className="flex flex-col gap-5 bg-[#176b9b] p-6 text-white sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-3xl font-extrabold">{roomName}</h2>
            <div className="mt-2 flex items-center gap-2 text-sky-100">
              <MapPin size={17} />Điểm tiếp nhận hiện tại
            </div>
          </div>
          <div className="rounded-lg bg-[#fff7f2] px-7 py-5 text-center text-[#17324d]">
            <span className="text-xs font-bold uppercase tracking-[.16em] text-slate-500">Số của bạn</span>
            <div className="mt-1 text-5xl font-black">{pathway.queueNumber}</div>
          </div>
        </div>
        <div className="grid gap-5 p-6 sm:grid-cols-3">
          <Metric icon={<Clock3 />} label="Thời gian chờ" value={`${pathway.estimatedWait} phút`} />
          <Metric icon={<Users />} label="Còn phía trước" value={`${pathway.peopleAhead} người`} />
          <Metric icon={<Ticket />} label="Mã lượt khám" value={pathway.visitId} />
        </div>
        <div className="px-6 pb-6">
          <div className="mb-2 flex justify-between text-sm">
            <span className="text-slate-500">Tiến độ hàng đợi</span>
            <span className="font-bold text-slate-800">
              {pathway.estimatedWait === 0 && pathway.peopleAhead === 0 ? 'Sẵn sàng tiếp nhận' : 'Tự động cập nhật'}
            </span>
          </div>
          <Progress value={progress} />
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-500">Bước tiếp theo</p>
            <h2 className="mt-1 text-xl font-extrabold text-slate-950">{pending[0]?.title ?? 'Hoàn thành lượt khám'}</h2>
          </div>
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-emerald-50 text-[#126b5b]">
            <Route />
          </span>
        </div>
        <div className="mt-5 space-y-4">
          {pending.slice(0, 3).map((step, index) => (
            <div key={step.id} className="flex gap-3">
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold ${index === 0 ? 'bg-[#126b5b] text-white' : 'bg-slate-100 text-slate-500'}`}>
                {index + 1}
              </span>
              <div>
                <p className="font-bold text-slate-800">{step.title}</p>
                <p className="mt-0.5 text-sm text-slate-500">{step.room} · {step.directions}</p>
              </div>
            </div>
          ))}
        </div>
        <Link to="/patient/pathway" className="mt-6 flex items-center justify-center gap-2 rounded-xl border border-[#126b5b] px-4 py-3 font-bold text-[#126b5b] hover:bg-emerald-50">
          Xem toàn bộ lộ trình<ArrowRight size={18} />
        </Link>
      </div>
    </section>
    <section className="mt-5 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
      <CheckCircle2 className="shrink-0 text-emerald-700" />
      <h3 className="font-bold text-emerald-950">Dữ liệu lượt khám được đồng bộ thời gian thực từ hệ thống bệnh viện</h3>
    </section>
  </>
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid h-10 w-10 place-items-center rounded-lg bg-sky-50 text-[#176b9b]">{icon}</span>
      <div className="min-w-0">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        <div className="truncate font-extrabold text-slate-900">{value}</div>
      </div>
    </div>
  )
}
