import { lazy, Suspense, type ComponentType, type ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { LoadingSkeleton } from '../components/common/LoadingSkeleton'
import { AdminLayout } from '../components/layout/AdminLayout'
import { DoctorLayout } from '../components/layout/DoctorLayout'
import { PatientLayout } from '../components/layout/PatientLayout'
import { useAuthStore } from '../stores/authStore'
import type { UserRole } from '../types'
import { ProtectedRoute } from './ProtectedRoute'
import { RoleRoute } from './RoleRoute'

const page = <T extends Record<string, ComponentType>>(loader: () => Promise<T>, name: keyof T) => lazy(async () => ({ default: (await loader())[name] }))
const LoginPage = page(() => import('../pages/auth/LoginPage'), 'LoginPage')
const PatientDashboardPage = page(() => import('../pages/patient/PatientDashboardPage'), 'PatientDashboardPage')
const CheckinPage = page(() => import('../pages/patient/CheckinPage'), 'CheckinPage')
const SymptomPage = page(() => import('../pages/patient/SymptomPage'), 'SymptomPage')
const RoutingPage = page(() => import('../pages/patient/RoutingPage'), 'RoutingPage')
const CarePathwayPage = page(() => import('../pages/patient/CarePathwayPage'), 'CarePathwayPage')
const PatientResultsPage = page(() => import('../pages/patient/PatientResultsPage'), 'PatientResultsPage')
const DoctorDashboardPage = page(() => import('../pages/doctor/DoctorDashboardPage'), 'DoctorDashboardPage')
const PatientIntakePage = page(() => import('../pages/doctor/PatientIntakePage'), 'PatientIntakePage')
const KioskCheckinPage = page(() => import('../pages/kiosk/KioskCheckinPage'), 'KioskCheckinPage')
const DoctorQueuePage = page(() => import('../pages/doctor/DoctorQueuePage'), 'DoctorQueuePage')
const ExaminationPage = page(() => import('../pages/doctor/ExaminationPage'), 'ExaminationPage')
const ServiceOrderPage = page(() => import('../pages/doctor/ServiceOrderPage'), 'ServiceOrderPage')
const AdminDashboardPage = page(() => import('../pages/admin/AdminDashboardPage'), 'AdminDashboardPage')
const LivePatientManagementPage = page(() => import('../pages/admin/LivePatientManagementPage'), 'LivePatientManagementPage')
const RoomManagementPage = page(() => import('../pages/admin/RoomManagementPage'), 'RoomManagementPage')
const DoctorManagementPage = page(() => import('../pages/admin/DoctorManagementPage'), 'DoctorManagementPage')

const Guard = ({ role, children }: { role: UserRole; children: ReactNode }) => <ProtectedRoute><RoleRoute role={role}>{children}</RoleRoute></ProtectedRoute>
function HomeRedirect() { const user = useAuthStore((state) => state.user); return <Navigate to={user ? `/${user.role.toLowerCase()}` : '/login'} replace/> }
export function AppRoutes() { return <Suspense fallback={<div className="mx-auto max-w-6xl p-6"><LoadingSkeleton rows={6}/></div>}><Routes><Route path="/login" element={<LoginPage/>}/><Route path="/kiosk" element={<KioskCheckinPage/>}/><Route path="/patient" element={<Guard role="PATIENT"><PatientLayout/></Guard>}><Route index element={<PatientDashboardPage/>}/><Route path="checkin" element={<CheckinPage/>}/><Route path="symptoms" element={<SymptomPage/>}/><Route path="routing" element={<RoutingPage/>}/><Route path="pathway" element={<CarePathwayPage/>}/><Route path="results" element={<PatientResultsPage/>}/></Route><Route path="/doctor" element={<Guard role="DOCTOR"><DoctorLayout/></Guard>}><Route index element={<DoctorDashboardPage/>}/><Route path="intake" element={<PatientIntakePage/>}/><Route path="queue" element={<DoctorQueuePage/>}/><Route path="examination/:visitId" element={<ExaminationPage/>}/><Route path="orders/:visitId" element={<ServiceOrderPage/>}/></Route><Route path="/admin" element={<Guard role="ADMIN"><AdminLayout/></Guard>}><Route index element={<AdminDashboardPage/>}/><Route path="live-visits" element={<LivePatientManagementPage/>}/><Route path="rooms" element={<RoomManagementPage/>}/><Route path="doctors" element={<DoctorManagementPage/>}/></Route><Route path="/" element={<HomeRedirect/>}/><Route path="*" element={<Navigate to="/" replace/>}/></Routes></Suspense> }
