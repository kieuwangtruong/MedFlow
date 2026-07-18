import { AlertTriangle, ArrowRight, ClipboardPlus, MapPin, Stethoscope, UserRound } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { PageHeader } from '../../components/common/PageHeader'

export function PatientIntakePage() {
  const [submitted, setSubmitted] = useState(false)
  const [form, setForm] = useState({ cccd: '', name: '', symptoms: '' })
  const ready = /^\d{9,12}$/.test(form.cccd) && form.name.trim().length > 3 && form.symptoms.trim().length > 8
  const update = (key: keyof typeof form, value: string) => setForm((old) => ({ ...old, [key]: value }))

  return <><PageHeader title="Tiếp nhận bệnh nhân" description="Nhập thông tin ban đầu để xác định khu khám phù hợp."/>
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <form onSubmit={(e) => { e.preventDefault(); if (ready) setSubmitted(true) }} className="card space-y-6">
        <div className="border-b border-border pb-5"><h2 className="text-xl font-extrabold text-slate-900">Thông tin tiếp nhận</h2></div>
        <div className="grid gap-5 md:grid-cols-2"><label><span className="field-label">CCCD *</span><input value={form.cccd} onChange={(e) => update('cccd', e.target.value.replace(/\D/g, '').slice(0,12))} className="form-control" placeholder="001204012345"/></label><label><span className="field-label">Họ và tên *</span><div className="relative"><UserRound className="absolute left-3 top-3.5 text-slate-400" size={19}/><input value={form.name} onChange={(e) => update('name', e.target.value)} className="form-control pl-10" placeholder="Nguyễn Văn An"/></div></label></div>
        <label><span className="field-label">Triệu chứng bệnh nhân mô tả *</span><textarea value={form.symptoms} onChange={(e) => update('symptoms', e.target.value)} className="form-control min-h-40" placeholder="Ví dụ: Đau tai bên phải, chảy dịch tai khoảng hai ngày, không sốt..."/></label>
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><AlertTriangle className="mt-0.5 shrink-0" size={19}/><p>Nếu có khó thở nặng, mất ý thức, đau ngực dữ dội hoặc chảy máu nhiều, chuyển ngay đến Cấp cứu.</p></div>
        <button disabled={!ready} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-[#126b5b] px-6 font-bold text-white hover:bg-[#0d584b] disabled:bg-slate-300"><Stethoscope size={19}/>Xác định phòng khám</button>
      </form>
      <aside className="space-y-4">{submitted ? <div className="overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm"><div className="bg-[#126b5b] p-5 text-white"><h2 className="text-3xl font-extrabold">Phòng khám Tai</h2></div><div className="p-5"><dl className="space-y-4"><Info label="Khoa" value="Tai Mũi Họng"/><Info label="Khu vực" value="Tầng 2 · Khu B"/><Info label="Mức ưu tiên" value="Thông thường"/></dl><button onClick={() => toast.success('Đã tạo lộ trình khám cho bệnh nhân')} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-[#126b5b] px-4 py-3 font-bold text-[#126b5b] hover:bg-emerald-50"><ClipboardPlus/>Tạo lộ trình khám<ArrowRight size={18}/></button></div></div> : <div className="card grid min-h-80 place-items-center text-center"><div><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-slate-500"><MapPin/></span><h3 className="mt-4 font-bold text-slate-800">Chưa có kết quả điều phối</h3></div></div>}</aside>
    </div>
  </>
}
const Info = ({ label, value }: { label: string; value: string }) => <div className="flex items-center justify-between border-b border-slate-100 pb-3"><dt className="text-sm text-slate-500">{label}</dt><dd className="font-bold text-slate-900">{value}</dd></div>
