export type UserRole = 'PATIENT' | 'DOCTOR' | 'ADMIN'
export type Priority = 'EMERGENCY' | 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW'
export type VisitStatus = 'CHECKED_IN' | 'SYMPTOM_SUBMITTED' | 'WAITING_TRIAGE' | 'ROUTED' | 'WAITING' | 'CALLED' | 'IN_EXAMINATION' | 'WAITING_SERVICE' | 'IN_SERVICE' | 'WAITING_RESULT' | 'RESULT_READY' | 'COMPLETED' | 'CANCELLED'
export type StepStatus = 'PENDING' | 'WAITING' | 'CALLED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
export type PeakLevel = 'low' | 'normal' | 'high' | 'very_high'

export interface User { id: string; full_name: string; role: UserRole; email?: string; cccd?: string; patient_token?: string; staff_role?: string }
export interface Patient { id: string; code: string; fullName: string; birthYear: number; phone: string; gender: string; insuranceNumber?: string }
export interface Doctor { id: string; fullName: string; department: string; room: string; status: 'AVAILABLE' | 'BUSY' | 'OFFLINE'; examinedToday: number; waitingPatients: number; averageMinutes: number }
export interface Department { id: string; name: string; waitingCount: number }
export interface Room { id: string; code: string; name: string; department: string; floor: number; doctor?: string; waitingCount: number; servingPatient?: string; averageWait: number; status: 'OPEN' | 'PAUSED' | 'CLOSED' }
export interface PatientVisit { id: string; patientId: string; patientName: string; queueNumber: string; checkinTime: string; priority: Priority; status: VisitStatus; department: string; room: string; doctor?: string; waitingMinutes: number; nextStep: string; estimatedCompletion: string }
export interface SymptomReport { description: string; onset: string; painLevel: number; commonSymptoms: string[]; dangerSigns: string[] }
export interface TriageAssessment { priority: Priority; summary: string; warning?: string }
export interface AIRecommendation { department: string; room: string; floor: number; estimatedWait: number; waitingCount: number; reason: string; confidence: number; priority: Priority }
export interface PathwayStep { id: string; title: string; department: string; room: string; doctor?: string; status: StepStatus; estimatedWait: number; estimatedStart: string; actualTime?: string; directions: string }
export interface PatientPathway { visitId: string; visitStatus: VisitStatus; queueNumber: string; currentRoom: string; peopleAhead: number; estimatedWait: number; steps: PathwayStep[] }
export interface QueueEntry { visitId: string; queueNumber: string; patientName: string; age: number; mainSymptom: string; priority: Priority; waitedMinutes: number; status: VisitStatus; department: string; room: string }
export interface ServiceOrder { id: string; type: string; targetDepartment: string; priority: Priority; clinicalNote: string; specialRequest?: string; room?: string; status: string }
export interface ServiceResult { id: string; serviceName: string; status: 'PENDING' | 'PROCESSING' | 'READY'; estimatedAt: string; fileUrl?: string; doctorConfirmed: boolean }
export interface WaitTimePrediction { roomId: string; minutes: number; confidence: number }
export interface ResultTimePrediction { orderId: string; estimatedAt: string; confidence: number }
export interface PeakHourForecast { checkin_time: string; slot_index: number; predicted_checkin_count: number; is_peak: boolean; peak_level: PeakLevel }
export interface Notification { id: string; title: string; message: string; createdAt: string; read: boolean }
export interface ApiResponse<T> { data: T; message?: string }
export interface PaginatedResponse<T> { data: T[]; page: number; pageSize: number; total: number }
export interface AuthResponse { access_token: string; user: User }
export interface DashboardKpi { label: string; value: number | string; trend?: string }
