import { useMutation } from '@tanstack/react-query'
import { ArrowLeft, CheckCircle2, DoorOpen, Hospital, Keyboard, ShieldCheck, Ticket } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { patientApi } from '../../api/patientApi'
import kioskBackground from '../../assets/backgrounds/hospital-kiosk.png'

export function KioskCheckinPage() {
  const [cccd, setCccd] = useState('')
  const [fullName, setFullName] = useState('')
  const mutation = useMutation({ mutationFn: () => patientApi.kioskCheckin(cccd, fullName.trim()) })
  const valid = /^\d{9,12}$/.test(cccd) && fullName.trim().length >= 2
  const result = mutation.data

  return <main className="min-h-screen bg-cover bg-center p-3 sm:p-8" style={{ backgroundImage: `linear-gradient(rgba(23,50,77,.42), rgba(23,50,77,.25)), url(${kioskBackground})` }}>
    <div className="mx-auto flex min-h-[calc(100vh-1.5rem)] max-w-5xl flex-col overflow-hidden rounded-[1.75rem] border border-white/70 bg-white/96 shadow-2xl sm:min-h-[calc(100vh-4rem)]">
      <header className="flex min-h-20 items-center justify-between gap-4 border-b border-border px-5 py-4 sm:px-9">
        <div className="flex items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-white"><Hospital/></span><span><strong className="block text-lg font-black">Bệnh viện An Tâm</strong><span className="text-xs font-semibold text-slate-500">Kiosk check-in tự phục vụ</span></span></div>
        <Link to="/login" className="inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm font-bold"><ArrowLeft size={17}/>Quay lại</Link>
      </header>
      <section className="grid flex-1 place-items-center px-5 py-9">
        {!result ? <div className="w-full max-w-2xl text-center">
          <span className="mx-auto grid h-20 w-20 place-items-center rounded-3xl bg-emerald-50 text-[#126b5b]"><DoorOpen size={38}/></span>
          <h1 className="mt-5 text-4xl font-black">Xác nhận có mặt</h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-slate-600">Nhập CCCD để tạo hoặc khôi phục lượt khám hiện tại. Kiosk không sử dụng số thứ tự hay phòng cố định.</p>
          <label className="mx-auto mt-8 block max-w-xl text-left"><span className="mb-2 block font-bold">Họ và tên</span><input autoFocus autoComplete="name" value={fullName} onChange={(event) => setFullName(event.target.value.slice(0, 100))} className="h-16 w-full rounded-2xl border-2 px-6 text-xl font-bold" placeholder="Nhập họ và tên bệnh nhân"/></label>
          <label className="mx-auto mt-5 block max-w-xl text-left"><span className="mb-2 block font-bold">Số CCCD</span><input inputMode="numeric" value={cccd} onChange={(event) => setCccd(event.target.value.replace(/\D/g, '').slice(0, 12))} onKeyDown={(event) => event.key === 'Enter' && valid && mutation.mutate()} className="h-20 w-full rounded-2xl border-2 px-6 text-2xl font-black tracking-[.12em]" placeholder="9–12 chữ số"/></label>
          <button disabled={!valid || mutation.isPending} onClick={() => mutation.mutate()} className="mx-auto mt-5 flex h-16 w-full max-w-xl items-center justify-center gap-3 rounded-2xl bg-primary text-xl font-black text-white disabled:bg-slate-300"><Keyboard/>{mutation.isPending ? 'Đang check-in...' : 'Xác nhận check-in'}</button>
          {mutation.isError && <p className="mt-4 font-semibold text-red-700">Không thể check-in. Vui lòng kiểm tra backend hoặc liên hệ quầy tiếp nhận.</p>}
          <p className="mt-5 flex items-center justify-center gap-2 text-sm text-slate-500"><ShieldCheck size={17}/>Thông tin chỉ dùng cho lượt khám hiện tại.</p>
        </div> : <div className="w-full max-w-2xl text-center">
          <CheckCircle2 className="mx-auto text-emerald-700" size={72}/><h1 className="mt-4 text-4xl font-black">Check-in thành công</h1>
          <div className="mx-auto mt-7 max-w-md rounded-[2rem] border-2 border-[#126b5b] bg-emerald-50 p-8"><Ticket className="mx-auto text-[#126b5b]" size={36}/><p className="mt-3 text-sm font-bold uppercase text-slate-500">Mã lượt khám</p><p className="mt-2 break-all text-2xl font-black text-[#126b5b]">{result.visitId}</p><p className="mt-4 text-lg">{result.currentRoom ? `${result.currentRoom} · số ${result.queueNumber}` : 'Chưa phân phòng'}</p></div>
          <p className="mx-auto mt-7 max-w-xl text-lg text-slate-600">Hãy đăng nhập cổng bệnh nhân bằng CCCD vừa nhập để khai báo triệu chứng và nhận phòng thực tế.</p>
          <div className="mt-6 flex justify-center gap-3"><Link to="/login" className="rounded-xl bg-primary px-6 py-3 font-bold text-white">Đăng nhập và khai triệu chứng</Link><button onClick={() => { mutation.reset(); setCccd(''); setFullName('') }} className="rounded-xl border px-6 py-3 font-bold">Lượt tiếp theo</button></div>
        </div>}
      </section>
    </div>
  </main>
}
