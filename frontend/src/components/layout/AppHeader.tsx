import { Bell, CalendarDays, ChevronDown, LogOut, Menu, Search, ShieldCheck } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { roleHome, roleNavigation } from '../../config/navigation'
import { useAuth } from '../../hooks/useAuth'
import type { UserRole } from '../../types'

const roleMeta: Record<UserRole, { label: string; context: string }> = {
  PATIENT: { label: 'Bệnh nhân', context: 'Cổng thông tin bệnh nhân' },
  DOCTOR: { label: 'Bác sĩ điều trị', context: 'Buồng khám chuyên khoa' },
  ADMIN: { label: 'Quản trị vận hành', context: 'Trung tâm điều hành' },
  RECEPTION: { label: 'Nhân viên y tế tiếp nhận', context: 'Bàn tiếp đón & Phân luồng' },
}

function getUserBadgeLabel(role: UserRole, staffRole?: string): string {
  if (role === 'DOCTOR') return 'Bác sĩ điều trị'
  if (role === 'ADMIN') return 'Quản trị vận hành'
  if (role === 'RECEPTION') {
    if (staffRole === 'NURSE') return 'Điều dưỡng tiếp đón'
    if (staffRole === 'RECEPTIONIST') return 'Nhân viên tiếp đón'
    return 'Nhân viên y tế tiếp nhận'
  }
  return 'Bệnh nhân'
}

const notifications: Record<UserRole, Array<{ title: string; message: string; to: string; tone: string }>> = {
  PATIENT: [
    { title: 'Sắp đến lượt khám', message: 'Còn 3 bệnh nhân phía trước bạn.', to: '/patient', tone: 'bg-amber-500' },
    { title: 'Lộ trình đã cập nhật', message: 'Điểm đến tiếp theo: Phòng Nội 201, tầng 2.', to: '/patient/pathway', tone: 'bg-emerald-500' },
  ],
  DOCTOR: [
    { title: 'Có ca ưu tiên mới', message: 'Một bệnh nhân URGENT vừa vào hàng đợi.', to: '/doctor/queue', tone: 'bg-red-500' },
    { title: 'Theo dõi kết quả cận lâm sàng', message: 'Mở hàng đợi để chọn đúng hồ sơ đang cần bác sĩ kết luận.', to: '/doctor/queue', tone: 'bg-sky-500' },
  ],
  ADMIN: [
    { title: 'Tải phòng đang tăng', message: 'Khu Nội có thời gian chờ vượt ngưỡng theo dõi.', to: '/admin/rooms', tone: 'bg-amber-500' },
    { title: 'Sắp đến giờ cao điểm', message: 'Lượng check-in dự báo tăng trong 30 phút tới.', to: '/admin', tone: 'bg-sky-500' },
  ],
  RECEPTION: [
    { title: 'Tiếp đón bệnh nhân mới', message: 'Vui lòng kiểm tra thông tin và triệu chứng trước khi phân buồng khám.', to: '/reception', tone: 'bg-emerald-500' },
    { title: 'Theo dõi tiến độ khám', message: 'Xem danh sách lượt khám để phân phối phòng tối ưu.', to: '/reception/live-visits', tone: 'bg-sky-500' },
  ],
}

export function AppHeader({ role, onMenu }: { role: UserRole; onMenu: () => void }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [notificationOpen, setNotificationOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const initials = user?.full_name.split(' ').filter(Boolean).slice(-2).map((word) => word[0]).join('').toUpperCase() ?? 'AT'
  const keyword = query.trim().toLowerCase()
  const results = roleNavigation[role].filter((item) => !keyword || `${item.label} ${item.description}`.toLowerCase().includes(keyword))
  const dateLabel = new Intl.DateTimeFormat('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' }).format(new Date())

  const goToFirstResult = (event: FormEvent) => {
    event.preventDefault()
    if (!results[0]) return
    navigate(results[0].to)
    setQuery('')
    setSearchOpen(false)
  }

  return <header className="sticky top-0 z-30 flex h-[76px] items-center justify-between border-b border-border/90 bg-white/95 px-4 shadow-[0_1px_2px_rgba(15,23,42,.025)] backdrop-blur sm:px-6 lg:px-8">
    <div className="flex min-w-0 items-center gap-3">
      <button className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-border bg-white text-slate-600 shadow-sm transition hover:border-primary/30 hover:text-primary lg:hidden" aria-label="Mở menu chính" aria-controls="primary-navigation" onClick={onMenu}><Menu size={20}/></button>
      <div className="hidden min-w-44 lg:block xl:hidden"><p className="truncate text-[11px] font-extrabold uppercase tracking-[.12em] text-primary">{roleMeta[role].context}</p><p className="truncate text-sm font-bold text-foreground">Bệnh viện An Tâm</p></div>
      <form onSubmit={goToFirstResult} className="relative hidden w-[min(420px,34vw)] xl:block">
        <Search className="pointer-events-none absolute left-3.5 top-3 text-muted-foreground" size={18}/>
        <input
          value={query}
          onChange={(event) => { setQuery(event.target.value); setSearchOpen(true) }}
          onFocus={() => setSearchOpen(true)}
          onBlur={() => window.setTimeout(() => setSearchOpen(false), 150)}
          onKeyDown={(event) => { if (event.key === 'Escape') setSearchOpen(false) }}
          className="h-11 w-full rounded-xl border border-border bg-[#f7f9fa] pl-10 pr-14 text-sm font-medium outline-none transition placeholder:text-slate-400 focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10"
          placeholder="Đi đến trang hoặc chức năng..."
          aria-label="Điều hướng nhanh"
          aria-expanded={searchOpen}
        />
        <kbd className="pointer-events-none absolute right-3 top-3 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-bold text-slate-400">↵</kbd>
        {searchOpen && <div className="absolute left-0 right-0 top-13 overflow-hidden rounded-2xl border border-border bg-white p-2 shadow-[0_20px_55px_rgba(15,23,42,.16)]">
          <p className="px-3 pb-2 pt-1 text-[10px] font-extrabold uppercase tracking-[.14em] text-muted-foreground">Điều hướng nhanh</p>
          {results.length ? results.map((item) => { const Icon = item.icon; return <Link key={item.to} to={item.to} onClick={() => { setQuery(''); setSearchOpen(false) }} className="flex items-start gap-3 rounded-xl px-3 py-2.5 transition hover:bg-primary/[.045]"><span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/[.075] text-primary"><Icon size={17}/></span><span className="min-w-0"><span className="block truncate text-sm font-bold text-foreground">{item.label}</span><span className="block truncate text-xs leading-5 text-muted-foreground">{item.description}</span></span></Link> }) : <p className="px-3 py-5 text-sm text-muted-foreground">Không tìm thấy chức năng phù hợp.</p>}
        </div>}
      </form>
    </div>

    <div className="flex items-center gap-1.5 sm:gap-2">
      <div className="mr-1 hidden items-center gap-2 border-r border-border pr-4 2xl:flex"><CalendarDays size={17} className="text-muted-foreground"/><span className="text-xs font-bold capitalize text-slate-600">{dateLabel}</span></div>
      <div className="mr-1 hidden items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 sm:flex"><span className="status-dot bg-emerald-500 text-emerald-500"/>Hệ thống ổn định</div>
      <div className="relative">
        <button aria-label="Thông báo" aria-expanded={notificationOpen} onClick={() => { setNotificationOpen((value) => !value); setProfileOpen(false) }} className="relative grid h-10 w-10 place-items-center rounded-xl text-muted-foreground transition hover:bg-muted hover:text-foreground"><Bell size={20}/><span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-destructive ring-2 ring-white"/></button>
        {notificationOpen && <div className="absolute right-0 top-12 w-[min(370px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border bg-white shadow-[0_20px_55px_rgba(15,23,42,.16)]"><div className="border-b border-border px-4 py-3.5"><p className="font-extrabold text-foreground">Thông báo vận hành</p><p className="mt-0.5 text-xs text-muted-foreground">Các cập nhật cần chú ý trong phiên hiện tại</p></div><div className="p-2">{notifications[role].map((item) => <Link key={item.title} to={item.to} onClick={() => setNotificationOpen(false)} className="flex gap-3 rounded-xl px-3 py-3 transition hover:bg-slate-50"><span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${item.tone}`}/><span><span className="block text-sm font-bold text-foreground">{item.title}</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">{item.message}</span></span></Link>)}</div></div>}
      </div>
      <div className="relative">
        <button aria-label="Mở menu tài khoản" aria-expanded={profileOpen} onClick={() => { setProfileOpen((value) => !value); setNotificationOpen(false) }} className="flex items-center gap-3 rounded-xl p-1.5 text-left transition hover:bg-muted"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#126b86] text-xs font-black text-white shadow-sm">{initials}</span><span className="hidden md:block"><span className="block max-w-40 truncate text-sm font-bold leading-4 text-foreground">{user?.full_name ?? 'Người dùng'}</span><span className="mt-0.5 block text-xs text-muted-foreground">{getUserBadgeLabel(role, user?.staff_role)}</span></span><ChevronDown size={16} className="hidden text-muted-foreground md:block"/></button>
        {profileOpen && <div className="absolute right-0 top-12 w-64 rounded-2xl border border-border bg-white p-2 shadow-[0_20px_55px_rgba(15,23,42,.16)]"><div className="border-b border-border px-3 py-3"><p className="truncate font-extrabold text-foreground">{user?.full_name}</p><p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"><ShieldCheck size={14} className="text-emerald-600"/>{getUserBadgeLabel(role, user?.staff_role)}</p></div><Link to={roleHome[role]} onClick={() => setProfileOpen(false)} className="mt-2 block rounded-xl px-3 py-2.5 text-sm font-bold text-foreground transition hover:bg-slate-50">Về trang tổng quan</Link><button onClick={logout} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold text-destructive transition hover:bg-red-50"><LogOut size={17}/>Đăng xuất an toàn</button></div>}
      </div>
    </div>
  </header>
}
