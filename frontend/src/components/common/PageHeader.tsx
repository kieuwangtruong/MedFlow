import type { ReactNode } from 'react'

export function PageHeader({ title, action }: { title: string; description?: string; action?: ReactNode }) {
  return <header className="mb-6 flex flex-col justify-between gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center">
    <h1 className="min-w-0 text-2xl font-extrabold leading-tight tracking-tight text-slate-950 sm:text-3xl">{title}</h1>
    {action && <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>}
  </header>
}
