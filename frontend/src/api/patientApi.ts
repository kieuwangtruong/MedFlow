import { notifications, pathway, peakForecasts, serviceResults } from '../mocks/data'
import type { Notification, PatientPathway, PeakHourForecast, ServiceResult, SymptomReport } from '../types'
import axiosClient, { mockDelay, USE_MOCK_API } from './axiosClient'

export const patientApi = {
  getPeakHours: async (): Promise<PeakHourForecast[]> => {
    if (USE_MOCK_API) return mockDelay(peakForecasts)
    const response = await axiosClient.post<{ forecasts: PeakHourForecast[] }>('/ai/forecasts', { days: 1 })
    return response.data.forecasts
  },
  getNotifications: async (): Promise<Notification[]> => USE_MOCK_API ? mockDelay(notifications) : (await axiosClient.get<Notification[]>('/notifications')).data,
  checkin: async (payload: object): Promise<{ visitId: string; queueNumber: string; currentRoom?: string | null; requiresSymptoms?: boolean; existing?: boolean }> => USE_MOCK_API ? mockDelay({ visitId: 'VIS-260718-042', queueNumber: '--', currentRoom: null, requiresSymptoms: true }, 650) : (await axiosClient.post('/checkins', payload)).data,
  kioskCheckin: async (cccd: string): Promise<{ visitId: string; queueNumber: string; currentRoom?: string | null; requiresSymptoms?: boolean }> => USE_MOCK_API ? mockDelay({ visitId: `VIS-${cccd.slice(-6)}`, queueNumber: '--', currentRoom: null, requiresSymptoms: true }, 650) : (await axiosClient.post('/kiosk/checkins', { cccd, examinationType: 'GENERAL', patientType: 'INSURANCE' })).data,
  submitSymptoms: async (visitId: string, payload: SymptomReport): Promise<void> => { if (USE_MOCK_API) return mockDelay(undefined, 500); await axiosClient.post(`/visits/${visitId}/symptoms`, payload) },
  confirmRouting: async (visitId: string, payload: { department: string; room: string; estimatedWait?: number; source?: string }): Promise<{ visitId: string; queueNumber: string; currentRoom: string }> => USE_MOCK_API ? mockDelay({ visitId, queueNumber: 'A001', currentRoom: payload.room }, 400) : (await axiosClient.post(`/visits/${visitId}/routing`, payload)).data,
  getPathway: async (visitId: string): Promise<PatientPathway> => USE_MOCK_API ? mockDelay({ ...pathway, visitId }) : (await axiosClient.get<PatientPathway>(`/visits/${visitId}/pathway`)).data,
  getResults: async (visitId: string): Promise<ServiceResult[]> => USE_MOCK_API ? mockDelay(serviceResults) : (await axiosClient.get<ServiceResult[]>(`/visits/${visitId}/results`)).data,
}
