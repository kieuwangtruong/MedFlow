import { pathway, queue, routingRecommendation } from '../mocks/data'
import type { AIRecommendation, DoctorAssignment, PatientPathway, Priority, QueueEntry, ServiceOrder } from '../types'
import axiosClient, { mockDelay, USE_MOCK_API } from './axiosClient'

export const doctorApi = {
  getAssignment: async (): Promise<DoctorAssignment | null> => USE_MOCK_API ? mockDelay(null) : (await axiosClient.get<DoctorAssignment | null>('/doctor/assignment')).data,
  getQueue: async (): Promise<QueueEntry[]> => USE_MOCK_API ? mockDelay(queue) : (await axiosClient.get<QueueEntry[]>('/doctor/queue')).data,
  createIntake: async (payload: { cccd: string; name: string; age: number; gender: string; pregnancyStatus: string; department?: string; room: string; estimatedWait?: number; symptomReport: { description: string; onset: string; painLevel: number; commonSymptoms: string[]; dangerSigns: string[] } }): Promise<{ visitId: string; queueNumber: string; currentRoom: string; patient: { cccd: string; fullName: string } }> => USE_MOCK_API ? mockDelay({ visitId: `VIS-${Date.now()}`, queueNumber: 'A001', currentRoom: payload.room, patient: { cccd: payload.cccd, fullName: payload.name } }) : (await axiosClient.post('/doctor/intake', payload)).data,
  getVisit: async (visitId: string): Promise<{ queue: QueueEntry; pathway: PatientPathway; recommendation: AIRecommendation }> => USE_MOCK_API ? mockDelay({ queue: queue.find((q) => q.visitId === visitId) ?? queue[0]!, pathway, recommendation: routingRecommendation }) : (await axiosClient.get(`/doctor/visits/${visitId}`)).data,
  updatePriority: async (visitId: string, priority: Priority) => USE_MOCK_API ? mockDelay({ visitId, priority }) : (await axiosClient.patch(`/doctor/visits/${visitId}/priority`, { priority })).data,
  startVisit: async (visitId: string) => USE_MOCK_API ? mockDelay({ visitId, status: 'IN_EXAMINATION' }) : (await axiosClient.post(`/doctor/visits/${visitId}/start`)).data,
  createOrder: async (visitId: string, order: Omit<ServiceOrder, 'id' | 'status'>) => USE_MOCK_API ? mockDelay({ ...order, id: `ORD-${Date.now()}`, status: 'PENDING' }) : (await axiosClient.post(`/doctor/visits/${visitId}/orders`, order)).data,
  completeVisit: async (visitId: string) => USE_MOCK_API ? mockDelay({ visitId, status: 'COMPLETED' }) : (await axiosClient.post(`/doctor/visits/${visitId}/complete`)).data,
}
