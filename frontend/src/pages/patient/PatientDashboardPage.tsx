import { ArrowRight, CheckCircle2, Clock3, MapPin, Route, Ticket, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../../components/common/PageHeader'
import { Progress } from '../../components/ui/progress'
import { pathway } from '../../mocks/data'
import { useAuthStore } from '../../stores/authStore'

export function PatientDashboardPage() {
  const user = useAuthStore((state) => state.user)
  const pending = pathway.steps.filter((step) => step.status !== 'COMPLETED')
  return <><PageHeader title={`Xin chào, ${user?.full_name ?? 'bạn'}`} description="Thông tin lượt khám hôm nay của bạn." action={<span className="rounded-full bg-amber-50 px-4 py-2 text-sm font-bold text-amber-700">Đang chờ khám</span>}/>
    <section className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
      <div className="overflow-hidden rounded-xl border border-sky-200 bg-white shadow-sm"><div className="flex flex-col gap-5 bg-[#176b9b] p-6 text-white sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-3xl font-extrabold">Phòng khám Nội</h2><div className="mt-2 flex items-center gap-2 text-sky-100"><MapPin size={17}/>Tầng 2 · Khu B</div></div><div className="rounded-lg bg-[#fff7f2] px-7 py-5 text-center text-[#17324d]"><span className="text-xs font-bold uppercase tracking-[.16em] text-slate-500">Số của bạn</span><div className="mt-1 text-5xl font-black">{pathway.queueNumber}</div></div></div><div className="grid gap-5 p-6 sm:grid-cols-3"><Metric icon={<Clock3/>} label="Thời gian chờ" value={`${pathway.estimatedWait} phút`}/><Metric icon={<Users/>} label="Còn phía trước" value={`${pathway.peopleAhead} người`}/><Metric icon={<Ticket/>} label="Đang phục vụ" value="A039"/></div><div className="px-6 pb-6"><div className="mb-2 flex justify-between text-sm"><span className="text-slate-500">Tiến độ hàng đợi</span><span className="font-bold text-slate-800">Sắp đến lượt</span></div><Progress value={72}/></div></div>
      <div className="card"><div className="flex items-center justify-between"><div><p className="text-sm font-semibold text-slate-500">Bước tiếp theo</p><h2 className="mt-1 text-xl font-extrabold text-slate-950">{pending[0]?.title}</h2></div><span className="grid h-12 w-12 place-items-center rounded-xl bg-emerald-50 text-[#126b5b]"><Route/></span></div><div className="mt-5 space-y-4">{pending.slice(0,3).map((step, index) => <div key={step.id} className="flex gap-3"><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold ${index === 0 ? 'bg-[#126b5b] text-white' : 'bg-slate-100 text-slate-500'}`}>{index + 1}</span><div><p className="font-bold text-slate-800">{step.title}</p><p className="mt-0.5 text-sm text-slate-500">{step.room} · {step.directions}</p></div></div>)}</div><Link to="/patient/pathway" className="mt-6 flex items-center justify-center gap-2 rounded-xl border border-[#126b5b] px-4 py-3 font-bold text-[#126b5b] hover:bg-emerald-50">Xem toàn bộ lộ trình<ArrowRight size={18}/></Link></div>
    </section>
    <section className="mt-5 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><CheckCircle2 className="shrink-0 text-emerald-700"/><h3 className="font-bold text-emerald-950">Bạn đã check-in thành công</h3></section>
  </>
}
function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-lg bg-sky-50 text-[#176b9b]">{icon}</span><div><span className="text-xs font-medium text-slate-500">{label}</span><div className="font-extrabold text-slate-900">{value}</div></div></div> }
