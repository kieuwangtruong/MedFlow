import type { ReactNode } from 'react'

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <header className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
      <div className="min-w-0">
        <div className="mb-2 flex items-center gap-2" aria-hidden="true">
          <span className="h-1.5 w-8 rounded-full bg-primary" />
          <span className="h-1.5 w-2 rounded-full bg-[#ea7a50]" />
        </div>
        <h1 className="text-2xl font-black leading-tight tracking-[-.025em] text-slate-950 sm:text-[2rem]">{title}</h1>
        {description && <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground sm:text-[15px]">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>}
    </header>
  )
}
