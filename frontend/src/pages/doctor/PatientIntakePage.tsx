import { useMutation } from '@tanstack/react-query'
import { AlertTriangle, ArrowRight, ClipboardPlus, LoaderCircle, MapPin, Stethoscope, UserRound } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { aiApi } from '../../api/aiApi'
import { PageHeader } from '../../components/common/PageHeader'
import type { AIRecommendation, SymptomReport } from '../../types'

export function PatientIntakePage() {
  const [submitted, setSubmitted] = useState(false)
  const [form, setForm] = useState({ cccd: '', name: '', symptoms: '' })
  const [recommendation, setRecommendation] = useState<AIRecommendation | null>(null)
  const update = (key: keyof typeof form, value: string) => setForm((old) => ({ ...old, [key]: value }))
  const getValidationError = () => {
    if (!/^\d{9,12}$/.test(form.cccd)) return 'CCCD cần gồm 9 đến 12 chữ số'
    if (form.name.trim().length < 2) return 'Vui lòng nhập họ tên bệnh nhân'
    if (form.symptoms.trim().length < 5) return 'Vui lòng nhập mô tả triệu chứng ít nhất 5 ký tự'
    return null
  }
  const routingMutation = useMutation({
    mutationFn: () => {
      const symptoms: SymptomReport = {
        description: form.symptoms.trim(),
        onset: '',
        painLevel: 0,
        commonSymptoms: [],
        dangerSigns: [],
      }
      return aiApi.symptomRouting(`INTAKE-${form.cccd}`, symptoms)
    },
    onSuccess: (result) => {
      setRecommendation(result)
      setSubmitted(true)
      toast.success('Đã xác định phòng khám phù hợp')
    },
    onError: () => toast.error('Không thể gọi AI xác định phòng khám'),
  })

  return <><PageHeader title="Tiếp nhận bệnh nhân" description="Nhập thông tin ban đầu để xác định khu khám phù hợp."/>
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <form onSubmit={(e) => { e.preventDefault(); const validationError = getValidationError(); if (validationError) { toast.error(validationError); return } routingMutation.mutate() }} className="card space-y-6">
        <div className="border-b border-border pb-5"><h2 className="text-xl font-extrabold text-slate-900">Thông tin tiếp nhận</h2></div>
        <div className="grid gap-5 md:grid-cols-2"><label><span className="field-label">CCCD *</span><input value={form.cccd} onChange={(e) => update('cccd', e.target.value.replace(/\D/g, '').slice(0,12))} className="form-control" placeholder="001204012345"/></label><label><span className="field-label">Họ và tên *</span><div className="relative"><UserRound className="absolute left-3 top-3.5 text-slate-400" size={19}/><input value={form.name} onChange={(e) => update('name', e.target.value)} className="form-control pl-10" placeholder="Nguyễn Văn An"/></div></label></div>
        <label><span className="field-label">Triệu chứng bệnh nhân mô tả *</span><textarea value={form.symptoms} onChange={(e) => update('symptoms', e.target.value)} className="form-control min-h-40" placeholder="Ví dụ: Đau tai bên phải, chảy dịch tai khoảng hai ngày, không sốt..."/></label>
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><AlertTriangle className="mt-0.5 shrink-0" size={19}/><p>Nếu có khó thở nặng, mất ý thức, đau ngực dữ dội hoặc chảy máu nhiều, chuyển ngay đến Cấp cứu.</p></div>
        <button type="submit" disabled={routingMutation.isPending} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-[#126b5b] px-6 font-bold text-white hover:bg-[#0d584b] disabled:bg-slate-300">{routingMutation.isPending ? <LoaderCircle className="animate-spin" size={19}/> : <Stethoscope size={19}/>}Xác định phòng khám</button>
      </form>
      <aside className="space-y-4">{submitted && recommendation ? <div className="overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm"><div className="bg-[#126b5b] p-5 text-white"><h2 className="text-3xl font-extrabold">{recommendation.room}</h2></div><div className="p-5"><dl className="space-y-4"><Info label="Khoa" value={recommendation.department}/><Info label="Khu vực" value={`Tầng ${recommendation.floor}`}/><Info label="Mức ưu tiên" value={recommendation.priority}/><Info label="Độ tin cậy" value={`${Math.round(recommendation.confidence * 100)}%`}/></dl><p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-600">{recommendation.reason}</p><button onClick={() => toast.success('Đã tạo lộ trình khám cho bệnh nhân')} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-[#126b5b] px-4 py-3 font-bold text-[#126b5b] hover:bg-emerald-50"><ClipboardPlus/>Tạo lộ trình khám<ArrowRight size={18}/></button></div></div> : <div className="card grid min-h-80 place-items-center text-center"><div><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-slate-500"><MapPin/></span><h3 className="mt-4 font-bold text-slate-800">Chưa có kết quả điều phối</h3></div></div>}</aside>
    </div>
  </>
}
const Info = ({ label, value }: { label: string; value: string }) => <div className="flex items-center justify-between border-b border-slate-100 pb-3"><dt className="text-sm text-slate-500">{label}</dt><dd className="font-bold text-slate-900">{value}</dd></div>
