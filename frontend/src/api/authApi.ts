import type { AuthResponse } from '../types'
import axiosClient, { mockDelay, USE_MOCK_API } from './axiosClient'

export const authApi = {
  login: async (cccd: string): Promise<AuthResponse> => {
    if (!USE_MOCK_API) return (await axiosClient.post<AuthResponse>('/auth/login', { cccd })).data

    return mockDelay({
      access_token: 'demo-patient-token',
      user: {
        id: `patient-${cccd}`,
        full_name: 'Benh nhan demo',
        role: 'PATIENT',
        cccd,
        patient_token: `pt-demo-${cccd}`,
      },
    })
  },
  staffLogin: async (userName: string, password: string): Promise<AuthResponse> => {
    if (!USE_MOCK_API) {
      return (await axiosClient.post<AuthResponse>('/auth/staff/login', { userName, password })).data
    }

    const role = userName.toLowerCase().includes('admin') ? 'ADMIN' : 'DOCTOR'
    return mockDelay({
      access_token: `demo-${role.toLowerCase()}-staff-token`,
      user: {
        id: `staff-${userName}`,
        full_name: role === 'ADMIN' ? 'Quan tri vien demo' : 'Nhan vien demo',
        role,
        email: userName,
        staff_role: role,
      },
    })
  },
}
