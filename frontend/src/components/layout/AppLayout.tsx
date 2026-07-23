import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import type { UserRole } from '../../types'
import { AppBreadcrumbs } from './AppBreadcrumbs'
import { AppHeader } from './AppHeader'
import { AppSidebar } from './AppSidebar'
export function AppLayout({ role }: { role: UserRole }) { const [open, setOpen] = useState(false); const location = useLocation(); return <div className="min-h-screen bg-background"><a href="#main-content" className="skip-link">Bỏ qua đến nội dung chính</a><AppSidebar role={role} open={open} onClose={() => setOpen(false)}/><div className="min-h-screen lg:pl-72"><AppHeader role={role} onMenu={() => setOpen(true)}/><main id="main-content" className="mx-auto w-full max-w-[1560px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8"><AppBreadcrumbs role={role}/><AnimatePresence mode="wait"><motion.div key={location.pathname} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: .18, ease: 'easeOut' }}><Outlet/></motion.div></AnimatePresence></main></div></div> }
