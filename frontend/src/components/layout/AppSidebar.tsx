import { Hospital, LifeBuoy, RadioTower, ShieldCheck, X } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { groupNavigation, isNavigationItemActive, roleHome, roleNavigation } from '../../config/navigation'
import { cn } from '../../lib/utils'
import type { UserRole } from '../../types'

const roleName: Record<UserRole, string> = {
  PATIENT: 'Cổng bệnh nhân',
  DOCTOR: 'Không gian bác sĩ',
  ADMIN: 'Trung tâm vận hành',
}

export function AppSidebar({ role, open, onClose }: { role: UserRole; open: boolean; onClose: () => void }) {
  const { pathname } = useLocation()
  const groups = groupNavigation(roleNavigation[role])

  return <>
    <button aria-label="Đóng menu" className={cn('fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-[1px] lg:hidden', open ? 'block' : 'hidden')} onClick={onClose}/>
    <aside id="primary-navigation" className={cn('fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-[#29465c] bg-[#17324d] text-white shadow-2xl transition-transform duration-200 lg:translate-x-0 lg:shadow-none', open ? 'translate-x-0' : '-translate-x-full')}>
      <div className="flex h-[92px] shrink-0 items-center justify-between border-b border-white/10 px-5">
        <Link to={roleHome[role]} onClick={onClose} className="flex min-w-0 items-center gap-3 rounded-xl focus-visible:outline-white">
          <span className="relative grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#ea7a50] text-white shadow-lg shadow-black/10"><Hospital size={24}/><span className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-[#17324d] bg-emerald-400"/></span>
          <span className="min-w-0"><strong className="block truncate text-[17px] font-black tracking-tight">Bệnh viện An Tâm</strong><span className="mt-0.5 block text-[11px] font-semibold tracking-wide text-slate-300">Hệ thống điều phối khám</span></span>
        </Link>
        <button aria-label="Đóng menu" className="grid h-10 w-10 place-items-center rounded-xl text-slate-300 transition hover:bg-white/10 hover:text-white lg:hidden" onClick={onClose}><X size={20}/></button>
      </div>

      <div className="mx-4 mt-5 rounded-2xl border border-white/10 bg-white/[.065] p-3.5">
        <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-sky-200/75">Không gian làm việc</p>
        <p className="mt-1.5 flex items-center gap-2 text-sm font-bold text-white"><ShieldCheck size={16} className="text-[#f3a283]"/>{roleName[role]}</p>
        <p className="mt-2 flex items-center gap-2 text-[11px] font-semibold text-emerald-200"><RadioTower size={13}/>Dữ liệu đang được đồng bộ</p>
      </div>

      <nav aria-label="Điều hướng chính" className="mt-5 flex-1 overflow-y-auto px-3 pb-5">
        {groups.map((group) => <div key={group.section} className="mb-5"><p className="mb-2 px-3 text-[10px] font-extrabold uppercase tracking-[.16em] text-slate-400">{group.section}</p><div className="space-y-1">{group.items.map((item) => { const Icon = item.icon; const active = isNavigationItemActive(item, pathname); return <Link key={item.to} to={item.to} onClick={onClose} aria-current={active ? 'page' : undefined} title={item.description} className={cn('group relative flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-bold transition-all', active ? 'bg-white text-[#17324d] shadow-lg shadow-black/10' : 'text-slate-300 hover:bg-white/[.08] hover:text-white')}>
            {active && <span className="absolute -left-0.5 h-6 w-1 rounded-full bg-[#ea7a50]"/>}
            <span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-lg transition', active ? 'bg-primary/[.09] text-primary' : 'bg-white/[.06] text-slate-300 group-hover:bg-white/10 group-hover:text-white')}><Icon size={18}/></span>
            <span className="min-w-0 truncate">{item.label}</span>
          </Link> })}</div></div>)}
      </nav>

      <div className="shrink-0 border-t border-white/10 p-4">
        <div className="rounded-2xl bg-[#102b40] p-4"><div className="flex items-center gap-2 text-sm font-bold"><LifeBuoy size={17} className="text-[#f3a283]"/>Hỗ trợ vận hành</div><p className="mt-2 text-xs leading-5 text-slate-300">Hotline nội bộ: <strong className="text-white">1900 1234</strong><br/>Khẩn cấp y tế: <strong className="text-white">115</strong></p></div>
      </div>
    </aside>
  </>
}
