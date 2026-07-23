import { AnimatePresence, motion } from 'framer-motion'
import { CircleHelp, Hospital, LogOut, Menu, ShieldCheck, X } from 'lucide-react'
import { useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { isNavigationItemActive, roleNavigation } from '../../config/navigation'
import { useAuth } from '../../hooks/useAuth'
import { cn } from '../../lib/utils'
import { useVisitStore } from '../../stores/visitStore'

const navigation = roleNavigation.PATIENT

export const PatientLayout = () => {
  const { user, logout } = useAuth()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const visitId = useVisitStore((state) => state.visitId)
  const current = navigation.find((item) => isNavigationItemActive(item, location.pathname))
  const dateLabel = new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date())

  return <div className="min-h-screen bg-background">
    <a href="#patient-main" className="skip-link">Bỏ qua đến nội dung chính</a>
    <header className="sticky top-0 z-40 border-b border-border/90 bg-white/95 shadow-[0_1px_2px_rgba(15,23,42,.025)] backdrop-blur">
      <div className="mx-auto flex h-20 max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link to="/patient" className="flex min-w-0 items-center gap-3 rounded-xl">
          <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#126b86] text-white shadow-sm"><Hospital size={23}/><span className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-500"/></span>
          <span className="min-w-0"><strong className="block truncate text-[16px] font-black leading-5 text-slate-950">Bệnh viện An Tâm</strong><span className="block truncate text-[11px] font-semibold text-slate-500">Cổng thông tin bệnh nhân</span></span>
        </Link>

        <nav aria-label="Điều hướng bệnh nhân" className="hidden items-center gap-0.5 xl:flex">{navigation.map((item) => { const Icon = item.icon; const active = isNavigationItemActive(item, location.pathname); return <Link key={item.to} to={item.to} aria-current={active ? 'page' : undefined} title={item.description} className={cn('flex min-h-11 items-center gap-2 rounded-xl px-3 py-2.5 text-[13px] font-bold transition', active ? 'bg-primary/[.075] text-primary' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900')}><Icon size={17}/>{item.shortLabel ?? item.label}</Link> })}</nav>

        <div className="hidden items-center gap-3 xl:flex"><div className="max-w-44 text-right"><p className="truncate text-sm font-bold text-slate-800">{user?.full_name}</p><p className="text-xs text-slate-500">Hồ sơ bệnh nhân</p></div><button onClick={logout} aria-label="Đăng xuất" className="grid h-10 w-10 place-items-center rounded-xl border border-border text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"><LogOut size={18}/></button></div>
        <button aria-label={open ? 'Đóng menu' : 'Mở menu'} aria-expanded={open} onClick={() => setOpen((value) => !value)} className="grid h-11 w-11 place-items-center rounded-xl border border-border bg-white text-slate-600 shadow-sm xl:hidden">{open ? <X size={21}/> : <Menu size={21}/>}</button>
      </div>

      {open && <nav aria-label="Menu bệnh nhân" className="border-t border-border bg-white p-3 xl:hidden"><div className="mx-auto grid max-w-[900px] gap-1 sm:grid-cols-2">{navigation.map((item) => { const Icon = item.icon; const active = isNavigationItemActive(item, location.pathname); return <Link key={item.to} to={item.to} onClick={() => setOpen(false)} aria-current={active ? 'page' : undefined} className={cn('flex items-center gap-3 rounded-xl px-4 py-3 font-bold transition', active ? 'bg-primary/[.075] text-primary' : 'text-slate-600 hover:bg-slate-50')}><span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-xl', active ? 'bg-white text-primary shadow-sm' : 'bg-slate-100 text-slate-500')}><Icon size={18}/></span><span className="min-w-0"><span className="block truncate text-sm">{item.label}</span><span className="mt-0.5 block truncate text-xs font-normal text-slate-400">{item.description}</span></span></Link> })}<button onClick={logout} className="mt-1 flex min-h-12 w-full items-center gap-3 rounded-xl border-t border-slate-100 px-4 py-3 font-bold text-red-600 sm:col-span-2"><LogOut size={19}/>Đăng xuất</button></div></nav>}
    </header>

    <div className="border-b border-[#efd8cb] bg-[#fff8f4]"><div className="mx-auto flex min-h-11 max-w-[1440px] items-center justify-between gap-4 px-4 py-2 sm:px-6 lg:px-8"><div className="flex min-w-0 items-center gap-2.5 text-sm"><span className="status-dot shrink-0 bg-[#ea7a50] text-[#ea7a50]"/><strong className="shrink-0 text-slate-800">{visitId ?? 'Chưa check-in'}</strong><span className="hidden text-slate-400 sm:inline">•</span><span className="hidden truncate capitalize text-slate-500 sm:inline">{dateLabel}</span><span className="hidden text-slate-400 md:inline">•</span><span className="hidden truncate font-semibold text-[#9b5236] md:inline">{current?.label ?? 'Lượt khám ngoại trú'}</span></div><div className="flex shrink-0 items-center gap-3"><span className="hidden items-center gap-1.5 text-xs font-semibold text-emerald-700 sm:flex"><ShieldCheck size={15}/>Thông tin được bảo vệ</span><a href="tel:19001234" className="flex min-h-9 items-center gap-2 rounded-lg px-2 font-bold text-primary transition hover:bg-white"><CircleHelp size={17}/>Trợ giúp</a></div></div></div>

    <main id="patient-main" className="mx-auto w-full max-w-[1440px] px-4 pb-28 pt-7 sm:px-6 md:pb-10 lg:px-8 lg:py-10"><AnimatePresence mode="wait"><motion.div key={location.pathname} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -3 }} transition={{ duration: .18 }}><Outlet/></motion.div></AnimatePresence></main>

    <nav aria-label="Điều hướng nhanh bệnh nhân" className="fixed inset-x-0 bottom-0 z-40 flex overflow-x-auto border-t border-border bg-white/96 px-1.5 py-1.5 shadow-[0_-10px_32px_rgba(15,23,42,.09)] backdrop-blur md:hidden">{navigation.map((item) => { const Icon = item.icon; const active = isNavigationItemActive(item, location.pathname); return <Link key={item.to} to={item.to} aria-current={active ? 'page' : undefined} className={cn('flex min-w-[78px] flex-1 flex-col items-center gap-1 rounded-xl px-2 py-2 text-[10px] font-extrabold transition', active ? 'bg-primary/[.075] text-primary' : 'text-slate-500')}><Icon size={19}/><span className="whitespace-nowrap">{item.shortLabel ?? item.label}</span></Link> })}</nav>
  </div>
}
