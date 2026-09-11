import axios from 'axios'
import type { AuthResponse } from '../types'
import axiosClient, { mockDelay, USE_MOCK_API } from './axiosClient'
import { isTransientHttpStatus } from './apiConfig'

let backendWarmupRequest: Promise<void> | null = null
let aiWarmupRequest: Promise<void> | null = null

const WARMUP_RETRY_DELAYS_MS = [2_000, 5_000, 10_000]
const WARMUP_REQUEST_TIMEOUT_MS = 20_000

function delay(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms))
}

async function probeService(path: string) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      await axiosClient.get(path, { timeout: WARMUP_REQUEST_TIMEOUT_MS })
      return
    } catch (error) {
      const status = axios.isAxiosError(error) ? error.response?.status : undefined
      const retryDelay = WARMUP_RETRY_DELAYS_MS[attempt]
      if (retryDelay === undefined || !isTransientHttpStatus(status)) throw error
      await delay(retryDelay)
    }
  }
}

function warmupAiInBackground() {
  if (!aiWarmupRequest) {
    aiWarmupRequest = probeService('/ai/health')
      .catch(() => undefined)
      .finally(() => {
        aiWarmupRequest = null
      })
  }
}

function warmupBackend() {
  if (USE_MOCK_API) return Promise.resolve()

  if (!backendWarmupRequest) {
    backendWarmupRequest = probeService('/health')
      .then(() => {
        warmupAiInBackground()
      })
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
      await Promise.race([warmupBackend(), delay(2_000)]).catch(() => undefined)
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
      await Promise.race([warmupBackend(), delay(2_000)]).catch(() => undefined)
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
