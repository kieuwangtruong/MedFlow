import { useMutation } from '@tanstack/react-query'
import { AlertTriangle, ArrowRight, ClipboardPlus, LoaderCircle, MapPin, Stethoscope, UserRound } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { aiApi } from '../../api/aiApi'
import { PageHeader } from '../../components/common/PageHeader'
import type { AIRecommendation, SymptomReport } from '../../types'

type IntakeForm = {
  cccd: string
  name: string
  age: string
  gender: 'MALE' | 'FEMALE' | 'OTHER' | 'UNKNOWN'
  pregnancyStatus: 'YES' | 'NO' | 'NA' | 'UNKNOWN'
  symptoms: string
}

export function PatientIntakePage() {
  const [submitted, setSubmitted] = useState(false)
  const [form, setForm] = useState<IntakeForm>({ cccd: '', name: '', age: '', gender: 'UNKNOWN', pregnancyStatus: 'NA', symptoms: '' })
  const [recommendation, setRecommendation] = useState<AIRecommendation | null>(null)
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null)
  const update = (key: keyof typeof form, value: string) => setForm((old) => ({ ...old, [key]: value }))
  const getValidationError = () => {
    if (!/^\d{9,12}$/.test(form.cccd)) return 'CCCD cần gồm 9 đến 12 chữ số'
    if (form.name.trim().length < 2) return 'Vui lòng nhập họ tên bệnh nhân'
    const age = Number(form.age)
    if (!Number.isInteger(age) || age < 0 || age > 120) return 'Tuổi cần nằm trong khoảng 0 đến 120'
    if (form.gender !== 'FEMALE' && !['NA', 'UNKNOWN'].includes(form.pregnancyStatus)) return 'Trạng thái thai kỳ chỉ áp dụng cho bệnh nhân nữ'
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
      return aiApi.patientIntakeRouting(symptoms, {
        age: Number(form.age),
        gender: form.gender,
        pregnancyStatus: form.gender === 'FEMALE' ? form.pregnancyStatus : 'NA',
      })
    },
    onSuccess: (result) => {
      setRecommendation(result)
      setSelectedRoom(null)
      setSubmitted(true)
      toast.success('Đã xác định phòng khám phù hợp')
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Không thể gọi API xác định phòng khám'),
  })

  return <><PageHeader title="Tiếp nhận bệnh nhân" description="Nhập thông tin ban đầu để xác định khu khám phù hợp."/>
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <form onSubmit={(e) => { e.preventDefault(); const validationError = getValidationError(); if (validationError) { toast.error(validationError); return } routingMutation.mutate() }} className="card space-y-6">
        <div className="border-b border-border pb-5"><h2 className="text-xl font-extrabold text-slate-900">Thông tin tiếp nhận</h2></div>
        <div className="grid gap-5 md:grid-cols-2"><label><span className="field-label">CCCD *</span><input value={form.cccd} onChange={(e) => update('cccd', e.target.value.replace(/\D/g, '').slice(0,12))} className="form-control" placeholder="001204012345"/></label><label><span className="field-label">Họ và tên *</span><div className="relative"><UserRound className="absolute left-3 top-3.5 text-slate-400" size={19}/><input value={form.name} onChange={(e) => update('name', e.target.value)} className="form-control pl-10" placeholder="Nguyễn Văn An"/></div></label></div>
        <div className="grid gap-5 md:grid-cols-3"><label><span className="field-label">Tuổi *</span><input inputMode="numeric" value={form.age} onChange={(e) => update('age', e.target.value.replace(/\D/g, '').slice(0,3))} className="form-control" placeholder="35"/></label><label><span className="field-label">Giới tính *</span><select value={form.gender} onChange={(e) => update('gender', e.target.value)} className="form-control"><option value="UNKNOWN">Chưa xác định</option><option value="MALE">Nam</option><option value="FEMALE">Nữ</option><option value="OTHER">Khác</option></select></label><label><span className="field-label">Thai kỳ</span><select value={form.pregnancyStatus} disabled={form.gender !== 'FEMALE'} onChange={(e) => update('pregnancyStatus', e.target.value)} className="form-control disabled:bg-slate-100 disabled:text-slate-400"><option value="NA">Không áp dụng</option><option value="NO">Không mang thai</option><option value="YES">Đang mang thai</option><option value="UNKNOWN">Chưa rõ</option></select></label></div>
        <label><span className="field-label">Triệu chứng bệnh nhân mô tả *</span><textarea value={form.symptoms} onChange={(e) => update('symptoms', e.target.value)} className="form-control min-h-40" placeholder="Ví dụ: Đau tai bên phải, chảy dịch tai khoảng hai ngày, không sốt..."/></label>
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><AlertTriangle className="mt-0.5 shrink-0" size={19}/><p>Nếu có khó thở nặng, mất ý thức, đau ngực dữ dội hoặc chảy máu nhiều, chuyển ngay đến Cấp cứu.</p></div>
        <button type="submit" disabled={routingMutation.isPending} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-[#126b5b] px-6 font-bold text-white hover:bg-[#0d584b] disabled:bg-slate-300">{routingMutation.isPending ? <LoaderCircle className="animate-spin" size={19}/> : <Stethoscope size={19}/>}Xác định phòng khám</button>
      </form>
      <aside className="space-y-4">{submitted && recommendation ? <div className={`overflow-hidden rounded-2xl border bg-white shadow-sm ${recommendation.isRedFlag ? 'border-red-300' : 'border-emerald-200'}`}><div className={`p-5 text-white ${recommendation.isRedFlag ? 'bg-red-700' : 'bg-[#126b5b]'}`}><p className="text-sm font-semibold text-white/80">Kết quả phân luồng</p><h2 className="mt-1 text-2xl font-extrabold">Chọn phòng tiếp nhận</h2></div><div className="p-5"><p className="rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-600">{recommendation.reason}</p><div className="mt-4 space-y-3"><h3 className="text-sm font-bold text-slate-800">Nhân viên chọn 1 trong 2 phương án</h3>{[{ department: recommendation.department, room: recommendation.room, confidence: recommendation.confidence }, ...(recommendation.alternatives ?? [])].slice(0, 2).map((item, index) => { const selected = selectedRoom === item.room; return <button type="button" key={`${item.department}-${item.room}`} onClick={() => setSelectedRoom(item.room)} className={`flex w-full items-start gap-3 rounded-xl border-2 p-4 text-left transition ${selected ? 'border-[#126b5b] bg-emerald-50 ring-4 ring-emerald-50' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}><span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${selected ? 'border-[#126b5b]' : 'border-slate-300'}`}>{selected && <span className="h-2.5 w-2.5 rounded-full bg-[#126b5b]"/>}</span><span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-3"><strong className="text-slate-950">{item.room}</strong><span className="shrink-0 text-sm font-bold text-[#126b5b]">{Math.round(item.confidence * 100)}%</span></span><span className="mt-1 block text-sm text-slate-500">{item.department}</span><span className="mt-2 block text-xs font-semibold uppercase tracking-wide text-slate-400">Phương án {index + 1}</span></span></button> })}</div><dl className="mt-5 space-y-4"><Info label="Mức ưu tiên" value={recommendation.priority}/><Info label="Xác nhận nhân viên" value={recommendation.requiresHumanReview ? 'Bắt buộc' : 'Đã thực hiện'}/></dl><button type="button" disabled={!selectedRoom} onClick={() => toast.success(`Đã chọn ${selectedRoom} và tạo lộ trình khám`)} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#126b5b] px-4 py-3 font-bold text-white transition hover:bg-[#0d584b] disabled:cursor-not-allowed disabled:bg-slate-300"><ClipboardPlus/>Tiếp tục với phòng đã chọn<ArrowRight size={18}/></button></div></div> : <div className="card grid min-h-80 place-items-center text-center"><div><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-slate-500"><MapPin/></span><h3 className="mt-4 font-bold text-slate-800">Chưa có kết quả điều phối</h3></div></div>}</aside>
    </div>
  </>
}
const Info = ({ label, value }: { label: string; value: string }) => <div className="flex items-center justify-between border-b border-slate-100 pb-3"><dt className="text-sm text-slate-500">{label}</dt><dd className="font-bold text-slate-900">{value}</dd></div>
