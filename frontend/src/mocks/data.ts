import type { AIRecommendation, Doctor, Notification, PatientPathway, PatientVisit, PeakHourForecast, QueueEntry, Room, ServiceResult } from '../types'

const today = new Date()
const isoAt = (hour: number, minute = 0) => new Date(today.getFullYear(), today.getMonth(), today.getDate(), hour, minute).toISOString()

export const peakForecasts: PeakHourForecast[] = Array.from({ length: 20 }, (_, slot) => {
  const hour = 7 + Math.floor(slot / 2)
  const minute = slot % 2 ? 30 : 0
  const morning = 14 + 55 * Math.exp(-Math.pow(slot - 4, 2) / 8)
  const afternoon = 28 * Math.exp(-Math.pow(slot - 14, 2) / 10)
  const count = Math.round(morning + afternoon)
  const level = count >= 58 ? 'very_high' : count >= 45 ? 'high' : count >= 29 ? 'normal' : 'low'
  return { checkin_time: isoAt(hour, minute), slot_index: slot, predicted_checkin_count: count, is_peak: count >= 45, peak_level: level }
})

export const notifications: Notification[] = [
  { id: 'n1', title: 'Sắp đến lượt khám', message: 'Còn 3 bệnh nhân trước bạn tại phòng Nội 201.', createdAt: new Date(Date.now() - 5 * 60_000).toISOString(), read: false },
  { id: 'n2', title: 'Lộ trình đã cập nhật', message: 'Bạn được điều phối đến khoa Nội tổng hợp.', createdAt: new Date(Date.now() - 28 * 60_000).toISOString(), read: false },
  { id: 'n3', title: 'Nhắc mang giấy tờ', message: 'Vui lòng chuẩn bị CCCD và thẻ BHYT.', createdAt: new Date(Date.now() - 90 * 60_000).toISOString(), read: true },
]

export const routingRecommendation: AIRecommendation = {
  department: 'Khoa Nội tổng hợp', room: 'Phòng khám Nội 201', floor: 2, estimatedWait: 18, waitingCount: 3,
  reason: 'Triệu chứng phù hợp chuyên khoa và phòng hiện có thời gian chờ thấp nhất.', confidence: 0.89, priority: 'NORMAL',
}

export const pathway: PatientPathway = {
  visitId: 'VIS-260718-042', visitStatus: 'WAITING', queueNumber: 'A042', currentRoom: 'Phòng Nội 201', currentTaskType: 'INITIAL_CONSULT', peopleAhead: 3, estimatedWait: 18,
  steps: [
    { id: 's1', title: 'Check-in', department: 'Tiếp đón', room: 'Quầy A', status: 'COMPLETED', estimatedWait: 0, estimatedStart: isoAt(8, 5), actualTime: isoAt(8, 4), directions: 'Sảnh tầng 1' },
    { id: 's2', title: 'Đang chờ phòng khám', department: 'Nội tổng hợp', room: 'Phòng 201', doctor: 'BS. Trần Minh An', status: 'WAITING', estimatedWait: 18, estimatedStart: isoAt(8, 35), directions: 'Tầng 2, rẽ phải sau thang máy' },
    { id: 's3', title: 'Đang khám', department: 'Nội tổng hợp', room: 'Phòng 201', doctor: 'BS. Trần Minh An', status: 'PENDING', estimatedWait: 0, estimatedStart: isoAt(8, 55), directions: 'Giữ số A042 và chờ gọi tên' },
    { id: 's4', title: 'Xét nghiệm', department: 'Xét nghiệm', room: 'Phòng 105', status: 'PENDING', estimatedWait: 12, estimatedStart: isoAt(9, 25), directions: 'Tầng 1, khu cận lâm sàng' },
    { id: 's5', title: 'Kết quả sẵn sàng', department: 'Nội tổng hợp', room: 'Phòng 201', status: 'PENDING', estimatedWait: 30, estimatedStart: isoAt(10, 10), directions: 'Quay lại phòng khám ban đầu' },
    { id: 's6', title: 'Hoàn thành', department: 'Thanh toán', room: 'Quầy B', status: 'PENDING', estimatedWait: 5, estimatedStart: isoAt(10, 30), directions: 'Sảnh tầng 1' },
  ],
}

const names = ['Nguyễn Văn Nam', 'Trần Thị Lan', 'Lê Minh Tuấn', 'Phạm Ngọc Anh', 'Vũ Hoàng Long', 'Đỗ Thu Hà', 'Bùi Gia Huy', 'Ngô Thảo Vy']
const priorities = ['EMERGENCY', 'URGENT', 'HIGH', 'NORMAL', 'LOW'] as const
export const queue: QueueEntry[] = names.map((name, index) => ({
  visitId: `VIS-${100 + index}`, queueNumber: `A${String(31 + index).padStart(3, '0')}`, orderNumber: 31 + index, patientName: name, age: 24 + index * 5,
  mainSymptom: ['Khó thở, tức ngực', 'Đau bụng', 'Sốt cao', 'Đau đầu', 'Ho kéo dài'][index % 5] ?? 'Mệt mỏi',
  priority: priorities[Math.min(index, 4)] ?? 'NORMAL', waitedMinutes: 42 - index * 4,
  status: index === 0 ? 'CALLED' : 'WAITING', department: 'Nội tổng hợp', room: '201', taskType: 'INITIAL_CONSULT', serviceType: 'CLINICAL_CONSULT', resultValidated: false,
}))

export const liveVisits: PatientVisit[] = queue.map((item, index) => ({
  id: item.visitId, patientId: `BN-${2200 + index}`, patientName: item.patientName, queueNumber: item.queueNumber,
  checkinTime: new Date(Date.now() - item.waitedMinutes * 60_000).toISOString(), priority: item.priority, status: item.status,
  department: item.department, room: item.room, doctor: index < 2 ? 'BS. Trần Minh An' : undefined,
  waitingMinutes: item.waitedMinutes, nextStep: 'Khám lâm sàng', estimatedCompletion: new Date(Date.now() + (50 + index * 8) * 60_000).toISOString(),
}))

export const rooms: Room[] = [
  { id: 'r1', code: '201', name: 'Phòng khám Nội 1', department: 'Nội tổng hợp', floor: 2, doctor: 'BS. Trần Minh An', waitingCount: 8, servingPatient: 'A029', averageWait: 22, status: 'OPEN' },
  { id: 'r2', code: '202', name: 'Phòng khám Nội 2', department: 'Nội tổng hợp', floor: 2, doctor: 'BS. Lê Thanh Bình', waitingCount: 5, servingPatient: 'A018', averageWait: 16, status: 'OPEN' },
  { id: 'r3', code: '105', name: 'Phòng lấy mẫu', department: 'Xét nghiệm', floor: 1, waitingCount: 11, servingPatient: 'X051', averageWait: 28, status: 'OPEN' },
  { id: 'r4', code: '301', name: 'Phòng X-quang', department: 'Chẩn đoán hình ảnh', floor: 3, waitingCount: 0, averageWait: 0, status: 'PAUSED' },
]

export const doctors: Doctor[] = [
  { id: 'd1', fullName: 'BS. Trần Minh An', department: 'Nội tổng hợp', room: '201', status: 'BUSY', examinedToday: 12, waitingPatients: 8, averageMinutes: 14 },
  { id: 'd2', fullName: 'BS. Lê Thanh Bình', department: 'Nội tổng hợp', room: '202', status: 'AVAILABLE', examinedToday: 10, waitingPatients: 5, averageMinutes: 12 },
  { id: 'd3', fullName: 'BS. Nguyễn Thu Hương', department: 'Chẩn đoán hình ảnh', room: '301', status: 'OFFLINE', examinedToday: 7, waitingPatients: 0, averageMinutes: 18 },
]

export const serviceResults: ServiceResult[] = [
  { id: 'rs1', serviceName: 'Xét nghiệm công thức máu', status: 'READY', estimatedAt: new Date(Date.now() - 10 * 60_000).toISOString(), fileUrl: '#', doctorConfirmed: true },
  { id: 'rs2', serviceName: 'Sinh hóa máu', status: 'PROCESSING', estimatedAt: new Date(Date.now() + 25 * 60_000).toISOString(), doctorConfirmed: false },
  { id: 'rs3', serviceName: 'X-quang ngực', status: 'PENDING', estimatedAt: new Date(Date.now() + 55 * 60_000).toISOString(), doctorConfirmed: false },
]
