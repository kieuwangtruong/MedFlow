import {
  Activity,
  Bed,
  ClipboardCheck,
  FileHeart,
  HeartPulse,
  LayoutDashboard,
  MapPinned,
  Stethoscope,
  UserPlus,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react'
import type { UserRole } from '../types'

export type NavigationSection = 'Hành trình khám' | 'Ca trực' | 'Chăm sóc' | 'Điều hành' | 'Nguồn lực'

export interface NavigationItem {
  to: string
  label: string
  shortLabel?: string
  description: string
  section: NavigationSection
  icon: LucideIcon
  end?: boolean
  matchPrefix?: string
}

export const roleNavigation: Record<UserRole, NavigationItem[]> = {
  PATIENT: [
    { to: '/patient', label: 'Tổng quan lượt khám', shortLabel: 'Tổng quan', description: 'Số thứ tự và thời gian chờ hiện tại', section: 'Hành trình khám', icon: LayoutDashboard, end: true },
    { to: '/patient/checkin', label: 'Check-in', description: 'Xác nhận thông tin và lấy số khám', section: 'Hành trình khám', icon: ClipboardCheck },
    { to: '/patient/symptoms', label: 'Khai báo triệu chứng', shortLabel: 'Triệu chứng', description: 'Cung cấp triệu chứng để hỗ trợ phân luồng', section: 'Hành trình khám', icon: HeartPulse },
    { to: '/patient/routing', label: 'Phòng cần đến', shortLabel: 'Phòng khám', description: 'Xem khoa và phòng được đề xuất', section: 'Hành trình khám', icon: Stethoscope },
    { to: '/patient/pathway', label: 'Lộ trình khám', shortLabel: 'Lộ trình', description: 'Theo dõi toàn bộ hành trình khám', section: 'Hành trình khám', icon: MapPinned },
    { to: '/patient/results', label: 'Kết quả dịch vụ', shortLabel: 'Kết quả', description: 'Xem kết quả đã được bác sĩ xác nhận', section: 'Hành trình khám', icon: FileHeart },
  ],
  DOCTOR: [
    { to: '/doctor', label: 'Tổng quan ca trực', shortLabel: 'Tổng quan', description: 'Hàng đợi và hiệu suất ca trực', section: 'Ca trực', icon: LayoutDashboard, end: true },
    { to: '/doctor/queue', label: 'Hàng đợi phòng khám', shortLabel: 'Hàng đợi', description: 'Quản lý thứ tự và mức ưu tiên', section: 'Ca trực', icon: Users },
    { to: '/doctor/intake', label: 'Tiếp nhận tại quầy', shortLabel: 'Quầy tiếp nhận', description: 'Nhân viên y tế nhập triệu chứng và tạo lộ trình ban đầu', section: 'Ca trực', icon: UserPlus },
  ],
  ADMIN: [
    { to: '/admin', label: 'Tổng quan bệnh viện', shortLabel: 'Tổng quan', description: 'Chỉ số và dự báo toàn bệnh viện', section: 'Điều hành', icon: LayoutDashboard, end: true },
    { to: '/admin/live-visits', label: 'Bệnh nhân thời gian thực', shortLabel: 'Bệnh nhân', description: 'Theo dõi lượt khám đang hoạt động', section: 'Điều hành', icon: Activity },
    { to: '/admin/rooms', label: 'Quản lý phòng', shortLabel: 'Phòng', description: 'Tải, hàng đợi và trạng thái phòng', section: 'Nguồn lực', icon: Bed },
    { to: '/admin/doctors', label: 'Quản lý nhân viên', shortLabel: 'Nhân viên', description: 'Ca trực và hiệu suất nhân sự', section: 'Nguồn lực', icon: UserRound },
  ],
}

export const roleHome: Record<UserRole, string> = {
  PATIENT: '/patient',
  DOCTOR: '/doctor',
  ADMIN: '/admin',
}

export function isNavigationItemActive(item: NavigationItem, pathname: string) {
  if (item.end) return pathname === item.to
  if (item.matchPrefix) return pathname.startsWith(item.matchPrefix)
  return pathname === item.to || pathname.startsWith(`${item.to}/`)
}

export function getCurrentNavigationItem(role: UserRole, pathname: string) {
  return roleNavigation[role].find((item) => isNavigationItemActive(item, pathname))
}

export function groupNavigation(items: NavigationItem[]) {
  return items.reduce<Array<{ section: NavigationSection; items: NavigationItem[] }>>((groups, item) => {
    const group = groups.find((entry) => entry.section === item.section)
    if (group) group.items.push(item)
    else groups.push({ section: item.section, items: [item] })
    return groups
  }, [])
}
