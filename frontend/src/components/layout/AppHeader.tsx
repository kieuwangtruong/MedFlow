import { Bell, CalendarDays, ChevronDown, LogOut, Menu, Search, ShieldCheck } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { roleHome, roleNavigation } from '../../config/navigation'
import { useAuth } from '../../hooks/useAuth'
import type { UserRole } from '../../types'

const roleMeta: Record<UserRole, { label: string; context: string }> = {
  PATIENT: { label: 'Bệnh nhân', context: 'Cổng thông tin bệnh nhân' },
  DOCTOR: { label: 'Nhân viên y tế', context: 'Điều phối ca trực' },
  ADMIN: { label: 'Quản trị vận hành', context: 'Trung tâm điều hành' },
}

const notifications: Record<UserRole, Array<{ title: string; message: string; to: string; tone: string }>> = {
  PATIENT: [
    { title: 'Sắp đến lượt khám', message: 'Hệ thống hiển thị thời gian chờ thực tế.', to: '/patient', tone: 'bg-amber-500' },
    { title: 'Lộ trình khám', message: 'Theo dõi hành trình di chuyển và số thứ tự.', to: '/patient/pathway', tone: 'bg-emerald-500' },
  ],
  DOCTOR: [
    { title: 'Hàng đợi phòng khám', message: 'Tự động đồng bộ số thứ tự và kết quả.', to: '/doctor/queue', tone: 'bg-sky-500' },
    { title: 'Tiếp nhận bệnh nhân', message: 'Hỗ trợ gợi ý phân khoa chính xác.', to: '/doctor/intake', tone: 'bg-emerald-500' },
  ],
  ADMIN: [
    { title: 'Theo dõi vận hành', message: 'Giám sát tải và thời gian chờ các phòng khám.', to: '/admin/rooms', tone: 'bg-amber-500' },
    { title: 'Dự báo lưu lượng', message: 'Phân tích khung giờ cao điểm trong ngày.', to: '/admin', tone: 'bg-sky-500' },
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

  return (
    <header className="sticky top-0 z-30 flex h-[76px] items-center justify-between border-b border-border/90 bg-white/95 px-4 shadow-[0_1px_2px_rgba(15,23,42,.025)] backdrop-blur sm:px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <button
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-border bg-white text-slate-600 shadow-sm transition hover:border-primary/30 hover:text-primary lg:hidden"
          aria-label="Mở menu chính"
          aria-controls="primary-navigation"
          onClick={onMenu}
        >
          <Menu size={20} />
        </button>
        <div className="hidden min-w-44 lg:block xl:hidden">
          <p className="truncate text-[11px] font-extrabold uppercase tracking-[.12em] text-primary">{roleMeta[role].context}</p>
          <p className="truncate text-sm font-bold text-foreground">Bệnh viện An Tâm</p>
        </div>
        <form onSubmit={goToFirstResult} className="relative hidden w-[min(420px,34vw)] xl:block">
          <Search className="pointer-events-none absolute left-3.5 top-3 text-muted-foreground" size={18} />
          <input
            value={query}
            onChange={(event) => { setQuery(event.target.value); setSearchOpen(true) }}
            onFocus={() => setSearchOpen(true)}
            onBlur={() => window.setTimeout(() => setSearchOpen(false), 150)}
            className="form-control h-11 pl-10 text-sm"
            placeholder="Tìm tính năng, phòng khám, hướng dẫn..."
          />
          {searchOpen && (
            <div className="absolute left-0 top-12 z-50 w-full rounded-2xl border border-border bg-white p-2 shadow-2xl">
              {results.slice(0, 5).map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="flex items-center gap-3 rounded-xl p-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 hover:text-primary"
                >
                  <item.icon size={18} className="text-primary" />
                  <div>
                    <p className="font-bold leading-none">{item.label}</p>
                    <p className="mt-1 text-xs text-slate-400">{item.description}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </form>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <div className="hidden items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs font-bold text-muted-foreground md:flex">
          <CalendarDays size={15} />
          <span className="capitalize">{dateLabel}</span>
        </div>

        <div className="relative">
          <button
            onClick={() => setNotificationOpen((v) => !v)}
            aria-label="Thông báo hệ thống"
            className="relative grid h-11 w-11 place-items-center rounded-xl border border-border bg-white text-slate-600 shadow-sm transition hover:border-primary/30 hover:text-primary"
          >
            <Bell size={19} />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500" />
          </button>
          {notificationOpen && (
            <div className="absolute right-0 top-13 z-50 w-80 rounded-2xl border border-border bg-white p-3 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Thông báo</span>
                <span className="text-xs font-semibold text-primary">Thời gian thực</span>
              </div>
              <div className="mt-2 space-y-2">
                {notifications[role].map((item) => (
                  <Link
                    key={item.title}
                    to={item.to}
                    onClick={() => setNotificationOpen(false)}
                    className="block rounded-xl border border-slate-100 p-2.5 transition hover:bg-slate-50"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${item.tone}`} />
                      <strong className="text-xs text-slate-900">{item.title}</strong>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{item.message}</p>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="relative">
          <button
            onClick={() => setProfileOpen((v) => !v)}
            className="flex items-center gap-2.5 rounded-xl border border-border bg-white p-1.5 pr-3 shadow-sm transition hover:border-primary/30"
          >
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#126b86] text-xs font-black text-white">
              {initials}
            </span>
            <div className="hidden text-left sm:block">
              <p className="max-w-32 truncate text-xs font-bold text-foreground">{user?.full_name}</p>
              <p className="text-[10px] font-semibold text-muted-foreground">{roleMeta[role].label}</p>
            </div>
            <ChevronDown size={15} className="text-slate-400" />
          </button>
          {profileOpen && (
            <div className="absolute right-0 top-13 z-50 w-56 rounded-2xl border border-border bg-white p-2 shadow-2xl">
              <div className="border-b border-slate-100 p-2.5">
                <p className="text-xs font-bold text-slate-900">{user?.full_name}</p>
                <p className="text-[11px] text-slate-500">{user?.email || user?.cccd}</p>
              </div>
              <Link
                to={roleHome[role]}
                onClick={() => setProfileOpen(false)}
                className="mt-1 flex items-center gap-2 rounded-xl p-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                <ShieldCheck size={16} className="text-primary" />Trang chính
              </Link>
              <button
                onClick={logout}
                className="flex w-full items-center gap-2 rounded-xl p-2.5 text-xs font-bold text-red-600 hover:bg-red-50"
              >
                <LogOut size={16} />Đăng xuất
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
