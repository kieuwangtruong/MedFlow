import type { AuthResponse } from '../types'
import axiosClient, { mockDelay, USE_MOCK_API } from './axiosClient'

let backendWarmupRequest: Promise<void> | null = null

function warmupBackend() {
  if (USE_MOCK_API) return Promise.resolve()

  if (!backendWarmupRequest) {
    backendWarmupRequest = axiosClient.get('/health')
      .then(() => undefined)
      .finally(() => {
        backendWarmupRequest = null
      })
  }

  return backendWarmupRequest
}

export const authApi = {
  warmup: warmupBackend,
  login: async (cccd: string, fullName: string): Promise<AuthResponse> => {
    if (!USE_MOCK_API) {
      if (backendWarmupRequest) await backendWarmupRequest.catch(() => undefined)
      return (await axiosClient.post<AuthResponse>('/auth/login', { cccd, fullName })).data
    }

    return mockDelay({
      access_token: 'demo-patient-token',
      user: {
        id: `patient-${cccd}`,
        full_name: fullName,
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
