import { AnimatePresence, motion } from 'framer-motion'
import { CircleHelp, Hospital, LogOut, Map, Menu, Ticket, X } from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { cn } from '../../lib/utils'

const navigation = [
  { to: '/patient', label: 'Lượt khám', icon: Ticket },
  { to: '/patient/pathway', label: 'Lộ trình', icon: Map },
  { to: '/patient/routing', label: 'Phòng cần đến', icon: Hospital },
]

export const PatientLayout = () => {
  const { user, logout } = useAuth()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  return <div className="min-h-screen bg-[#f5f7f9]">
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white">
      <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-lg bg-[#176b9b] text-white"><Hospital size={22}/></span><div><p className="font-extrabold leading-5 text-slate-950">Bệnh viện An Tâm</p><p className="text-xs text-slate-500">Cổng thông tin bệnh nhân</p></div></div>
        <nav className="hidden items-center gap-1 md:flex">{navigation.map(({ to, label, icon: Icon }) => <NavLink key={to} end={to === '/patient'} to={to} className={({ isActive }) => cn('flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold transition', isActive ? 'bg-sky-50 text-[#176b9b]' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900')}><Icon size={17}/>{label}</NavLink>)}</nav>
        <div className="hidden items-center gap-3 md:flex"><div className="text-right"><p className="text-sm font-bold text-slate-800">{user?.full_name}</p><p className="text-xs text-slate-500">Hồ sơ bệnh nhân</p></div><button onClick={logout} aria-label="Đăng xuất" className="rounded-lg border border-slate-200 p-2.5 text-slate-500 hover:bg-slate-50 hover:text-red-600"><LogOut size={18}/></button></div>
        <button onClick={() => setOpen(!open)} className="rounded-lg border border-slate-200 p-2.5 md:hidden">{open ? <X/> : <Menu/>}</button>
      </div>
      {open && <nav className="border-t border-slate-200 bg-white p-3 md:hidden">{navigation.map(({ to, label, icon: Icon }) => <NavLink key={to} end={to === '/patient'} to={to} onClick={() => setOpen(false)} className={({ isActive }) => cn('flex items-center gap-3 rounded-lg px-4 py-3 font-bold', isActive ? 'bg-sky-50 text-[#176b9b]' : 'text-slate-600')}><Icon size={19}/>{label}</NavLink>)}<button onClick={logout} className="mt-2 flex w-full items-center gap-3 border-t border-slate-100 px-4 py-3 font-bold text-red-600"><LogOut size={19}/>Đăng xuất</button></nav>}
    </header>
    <div className="border-b border-[#f1d9cc] bg-[#fff7f2]"><div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2.5 text-sm sm:px-6 lg:px-8"><p className="flex items-center gap-2 text-slate-600"><span className="h-2 w-2 rounded-full bg-[#ea7a50]"/><strong className="text-slate-800">Lượt khám VIS-260718-042</strong><span className="hidden sm:inline">· Hôm nay, 18/07/2026</span></p><a href="tel:19001234" className="flex items-center gap-2 font-bold text-[#176b9b]"><CircleHelp size={17}/>Trợ giúp</a></div></div>
    <main className="mx-auto w-full max-w-7xl px-4 py-7 sm:px-6 lg:px-8 lg:py-10"><AnimatePresence mode="wait"><motion.div key={location.pathname} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: .18 }}><Outlet/></motion.div></AnimatePresence></main>
  </div>
}
