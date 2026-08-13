import { pathway, queue } from '../mocks/data'
import type { DoctorAssignment, PatientPathway, Priority, QueueEntry, ServiceOrder, ValidatedResult } from '../types'
import axiosClient, { mockDelay, USE_MOCK_API } from './axiosClient'

export const doctorApi = {
  getAssignment: async (): Promise<DoctorAssignment | null> => USE_MOCK_API ? mockDelay(null) : (await axiosClient.get<DoctorAssignment | null>('/doctor/assignment')).data,
  getQueue: async (): Promise<QueueEntry[]> => USE_MOCK_API ? mockDelay(queue) : (await axiosClient.get<QueueEntry[]>('/doctor/queue')).data,
  createIntake: async (payload: { cccd: string; name: string; age: number; gender: string; pregnancyStatus: string; department?: string; room: string; estimatedWait?: number; symptomReport: { description: string; onset: string; painLevel: number; commonSymptoms: string[]; dangerSigns: string[] } }): Promise<{ visitId: string; queueNumber: string; currentRoom: string; patient: { cccd: string; fullName: string } }> => USE_MOCK_API ? mockDelay({ visitId: `VIS-${Date.now()}`, queueNumber: 'A001', currentRoom: payload.room, patient: { cccd: payload.cccd, fullName: payload.name } }) : (await axiosClient.post('/doctor/intake', payload)).data,
  getVisit: async (visitId: string): Promise<{ queue: QueueEntry; pathway: PatientPathway; validatedResults: ValidatedResult[] }> => USE_MOCK_API ? mockDelay({ queue: queue.find((q) => q.visitId === visitId) ?? queue[0]!, pathway, validatedResults: [] }) : (await axiosClient.get(`/doctor/visits/${visitId}`)).data,
  updatePriority: async (visitId: string, priority: Priority) => USE_MOCK_API ? mockDelay({ visitId, priority }) : (await axiosClient.patch(`/doctor/visits/${visitId}/priority`, { priority })).data,
  callVisit: async (visitId: string): Promise<{ visitId: string; queueNumber: string; patientName: string; status: 'CALLED'; calledAt?: string }> => USE_MOCK_API ? mockDelay({ visitId, queueNumber: 'A001', patientName: 'Bệnh nhân demo', status: 'CALLED' }) : (await axiosClient.post(`/doctor/visits/${visitId}/call`)).data,
  startVisit: async (visitId: string) => USE_MOCK_API ? mockDelay({ visitId, status: 'IN_EXAMINATION' }) : (await axiosClient.post(`/doctor/visits/${visitId}/start`)).data,
  createOrder: async (visitId: string, order: Omit<ServiceOrder, 'id' | 'status'>) => USE_MOCK_API ? mockDelay({ ...order, id: `ORD-${Date.now()}`, status: 'PENDING' }) : (await axiosClient.post(`/doctor/visits/${visitId}/orders`, order)).data,
  completeVisit: async (visitId: string) => USE_MOCK_API ? mockDelay({ visitId, status: 'COMPLETED' }) : (await axiosClient.post(`/doctor/visits/${visitId}/complete`)).data,
  validateResult: async (visitId: string) => USE_MOCK_API ? mockDelay({ visitId, status: 'WAITING_REVIEW', resultValidated: true }) : (await axiosClient.post(`/doctor/visits/${visitId}/results/validate`)).data,
}
