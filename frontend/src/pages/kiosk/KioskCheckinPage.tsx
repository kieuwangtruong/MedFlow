import { CheckCircle2, DoorOpen, Hospital, Keyboard, Ticket } from 'lucide-react'
import { useState } from 'react'
import kioskBackground from '../../assets/backgrounds/hospital-kiosk.png'

export function KioskCheckinPage() {
  const [cccd, setCccd] = useState('')
  const [ticket, setTicket] = useState<string | null>(null)
  const valid = /^\d{9,12}$/.test(cccd)
  const checkin = () => { if (valid) setTicket('T-024') }

  return <main className="min-h-screen bg-cover bg-center bg-fixed p-5 sm:p-8" style={{ backgroundImage: `linear-gradient(rgba(23,50,77,.34), rgba(23,50,77,.22)), url(${kioskBackground})` }}>
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl flex-col overflow-hidden rounded-[1.5rem] border border-white/70 bg-white/94 shadow-[0_24px_80px_rgba(15,23,42,.18)] backdrop-blur-sm">
      <header className="flex items-center justify-between border-b border-slate-200 px-6 py-5 sm:px-10">
        <div className="flex items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-lg bg-[#176b9b] text-white"><Hospital/></span><strong className="text-xl text-slate-900">Bệnh viện An Tâm</strong></div>
        <div className="hidden items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 sm:flex"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500"/>Sẵn sàng phục vụ</div>
      </header>
      <section className="grid flex-1 place-items-center px-6 py-10 sm:px-10">
        {!ticket ? <div className="w-full max-w-2xl text-center">
          <span className="mx-auto grid h-20 w-20 place-items-center rounded-2xl bg-emerald-50 text-[#126b5b]"><DoorOpen size={38}/></span>
          <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-5xl">Check-in vào phòng khám</h1>
          <p className="mx-auto mt-4 max-w-xl text-lg leading-8 text-slate-600">Nhập số CCCD để xác nhận bạn đã có mặt và nhận số thứ tự tại phòng.</p>
          <label className="mx-auto mt-9 block max-w-xl text-left"><span className="mb-2 block text-base font-bold text-slate-800">Số căn cước công dân</span><input autoFocus inputMode="numeric" value={cccd} onChange={(e) => setCccd(e.target.value.replace(/\D/g, '').slice(0, 12))} onKeyDown={(e) => e.key === 'Enter' && checkin()} placeholder="Nhập 9–12 chữ số" className="h-20 w-full rounded-xl border-2 border-slate-300 bg-white px-6 text-2xl font-bold tracking-[.12em] outline-none transition focus:border-[#176b9b] focus:ring-4 focus:ring-sky-100"/></label>
          <button disabled={!valid} onClick={checkin} className="mx-auto mt-6 flex h-16 w-full max-w-xl items-center justify-center gap-3 rounded-lg bg-[#176b9b] px-8 text-xl font-bold text-white transition hover:bg-[#145b84] disabled:cursor-not-allowed disabled:bg-slate-300"><Keyboard/>Xác nhận check-in</button>
        </div> : <div className="w-full max-w-2xl text-center">
          <CheckCircle2 className="mx-auto text-emerald-600" size={80}/><p className="mt-5 text-xl font-bold text-emerald-700">Check-in thành công</p><h1 className="mt-2 text-4xl font-extrabold text-slate-950">Phòng khám Tai</h1>
          <div className="mx-auto mt-8 max-w-md rounded-3xl border-2 border-[#126b5b] bg-emerald-50 p-8"><Ticket className="mx-auto text-[#126b5b]" size={36}/><p className="mt-3 text-sm font-bold uppercase tracking-[.18em] text-slate-500">Số thứ tự của bạn</p><p className="mt-2 text-7xl font-black text-[#126b5b]">{ticket}</p><p className="mt-4 text-lg text-slate-700">Còn <strong>3 bệnh nhân</strong> phía trước</p></div>
          <p className="mt-7 text-lg text-slate-600">Vui lòng ngồi chờ gần cửa phòng và theo dõi màn hình gọi số.</p><button onClick={() => { setTicket(null); setCccd('') }} className="mt-7 rounded-xl border border-slate-300 px-6 py-3 font-bold text-slate-700 hover:bg-slate-50">Hoàn tất</button>
        </div>}
      </section>
    </div>
  </main>
}
