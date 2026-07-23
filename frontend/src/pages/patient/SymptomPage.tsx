import { useMutation } from '@tanstack/react-query'
import { CheckCircle2, HeartPulse, LockKeyhole, ShieldAlert } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { aiApi } from '../../api/aiApi'
import { patientApi } from '../../api/patientApi'
import { PageHeader } from '../../components/common/PageHeader'
import { SymptomForm } from '../../components/patient/SymptomForm'
import type { SymptomFormData } from '../../schemas/symptomSchema'
import { useVisitStore } from '../../stores/visitStore'

export function SymptomPage() {
  const navigate = useNavigate()
  const { visitId, setRecommendation, setVisit } = useVisitStore()
  const mutation = useMutation({
    mutationFn: async (data: SymptomFormData) => {
      if (!visitId) throw new Error('Bạn cần check-in trước khi khai báo triệu chứng')
      await patientApi.submitSymptoms(visitId, data)
      const recommendation = await aiApi.symptomRouting(visitId, data)
      const routing = await patientApi.confirmRouting(visitId, {
        department: recommendation.department,
        room: recommendation.room,
        estimatedWait: recommendation.estimatedWait,
        source: 'PATIENT_SELF_SYMPTOM_ROUTING',
      })
      return { recommendation, routing }
    },
    onSuccess: ({ recommendation, routing }) => {
      setRecommendation(recommendation)
      setVisit(routing.visitId, routing.queueNumber)
      toast.success(`Đã phân phòng: ${routing.currentRoom} · số ${routing.queueNumber}`)
      navigate('/patient/routing')
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Không thể phân tích triệu chứng'),
  })

  if (!visitId) return <>
    <PageHeader title="Khai báo triệu chứng" description="Bạn chưa có lượt khám đang hoạt động."/>
    <div className="card mx-auto max-w-xl text-center">
      <p className="font-semibold text-slate-700">Vui lòng check-in trước để triệu chứng được lưu đúng vào hồ sơ lượt khám.</p>
      <Link to="/patient/checkin" className="mt-4 inline-flex rounded-xl bg-primary px-5 py-3 font-bold text-white">Đi đến check-in</Link>
    </div>
  </>

  return <>
    <PageHeader title="Khai báo triệu chứng" description="Thông tin được lưu vào lượt khám và dùng để phân khoa, phòng cùng mức ưu tiên."/>
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <SymptomForm loading={mutation.isPending} onSubmit={(data) => mutation.mutate(data)}/>
      <aside className="space-y-4 xl:sticky xl:top-24">
        <div className="rounded-2xl bg-[#082f34] p-5 text-white shadow-xl">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/10"><HeartPulse/></span>
          <h2 className="mt-4 text-lg font-bold">Thông tin phục vụ phân luồng</h2>
          <ul className="mt-4 space-y-3 text-sm text-teal-50/75">{['Vị trí và tính chất triệu chứng','Thời điểm khởi phát','Mức độ đau và dấu hiệu nguy hiểm'].map((item) => <li key={item} className="flex gap-2"><CheckCircle2 size={17} className="shrink-0 text-teal-300"/>{item}</li>)}</ul>
        </div>
        <div className="card"><p className="flex items-center gap-2 font-bold"><LockKeyhole size={18} className="text-primary"/>Bảo mật y tế</p><p className="mt-2 text-sm leading-6 text-muted-foreground">Chỉ nhân viên tham gia lượt khám được xem thông tin này.</p></div>
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4"><p className="flex items-center gap-2 font-bold text-red-800"><ShieldAlert size={18}/>Trường hợp khẩn cấp</p><p className="mt-1 text-sm text-red-700">Nếu khó thở nặng, bất tỉnh hoặc chảy máu nhiều, hãy báo nhân viên hoặc gọi 115.</p></div>
      </aside>
    </div>
  </>
}
