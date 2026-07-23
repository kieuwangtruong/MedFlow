import { Check, Route } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { AppButton } from '../../components/common/AppButton'
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton'
import { PageHeader } from '../../components/common/PageHeader'
import { RoutingRecommendationCard } from '../../components/patient/RoutingRecommendationCard'
import { usePatientPathway } from '../../hooks/usePatientPathway'
import { useVisitStore } from '../../stores/visitStore'

export function RoutingPage() {
  const navigate = useNavigate()
  const { visitId, recommendation } = useVisitStore()
  const pathway = usePatientPathway(visitId)

  if (!visitId || !recommendation) return <>
    <PageHeader title="Phân phòng" description="Chưa có kết quả phân luồng cho lượt khám hiện tại."/>
    <div className="card mx-auto max-w-xl text-center"><p>Hãy khai báo triệu chứng để hệ thống tạo lộ trình thật.</p><Link to="/patient/symptoms" className="mt-4 inline-flex rounded-xl bg-primary px-5 py-3 font-bold text-white">Khai báo triệu chứng</Link></div>
  </>
  if (pathway.isLoading) return <LoadingSkeleton rows={6}/>

  return <>
    <PageHeader title="Phòng bạn cần đến" description="Phòng và số thứ tự dưới đây đã được ghi vào backend cho đúng CCCD của bạn." action={<span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700"><Check size={16}/>Đã tạo lộ trình</span>}/>
    <RoutingRecommendationCard recommendation={recommendation}/>
    {pathway.data && <section className="card mt-5"><h2 className="text-lg font-extrabold">Lộ trình đã lưu</h2><div className="mt-4 space-y-3">{pathway.data.steps.map((step, index) => <div key={step.id} className="flex gap-3 rounded-xl border p-4"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-white">{index + 1}</span><div><p className="font-bold">{step.title}</p><p className="text-sm text-slate-500">{step.department} · {step.room}</p></div></div>)}</div></section>}
    <AppButton className="mt-6 w-full text-base" onClick={() => navigate('/patient/pathway')}><Route/>Xem toàn bộ hành trình</AppButton>
  </>
}
