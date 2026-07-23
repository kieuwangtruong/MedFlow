import { ChevronRight, Home } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { getCurrentNavigationItem, roleHome } from '../../config/navigation'
import type { UserRole } from '../../types'

export function AppBreadcrumbs({ role }: { role: UserRole }) {
  const { pathname } = useLocation()
  const current = getCurrentNavigationItem(role, pathname)
  const home = roleHome[role]

  if (!current || pathname === home) return null

  const resourceId = current.matchPrefix ? pathname.slice(current.matchPrefix.length) : ''

  return <nav aria-label="Đường dẫn trang" className="mb-5 flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
    <Link to={home} className="inline-flex shrink-0 items-center gap-1.5 font-semibold transition hover:text-primary"><Home size={15}/>Tổng quan</Link>
    <ChevronRight size={15} className="shrink-0 text-slate-300"/>
    <span className="truncate font-semibold text-foreground" aria-current={resourceId ? undefined : 'page'}>{current.label}</span>
    {resourceId && <><ChevronRight size={15} className="shrink-0 text-slate-300"/><span className="truncate rounded-md bg-slate-100 px-2 py-1 font-mono text-xs font-semibold text-slate-600" aria-current="page">{decodeURIComponent(resourceId)}</span></>}
  </nav>
}
