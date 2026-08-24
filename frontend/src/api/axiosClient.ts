import axios from 'axios'
import { useAuthStore } from '../stores/authStore'
import { useVisitStore } from '../stores/visitStore'
import { apiBaseUrl, apiTimeoutMs, safeApiErrorMessage, shouldUseMockApi } from './apiConfig'

export const USE_MOCK_API = shouldUseMockApi(import.meta.env.VITE_USE_MOCK_API, import.meta.env.PROD)

const axiosClient = axios.create({
  baseURL: apiBaseUrl(import.meta.env.VITE_API_BASE_URL),
  timeout: apiTimeoutMs(import.meta.env.VITE_API_TIMEOUT_MS),
})

interface ApiErrorBody {
  error?: {
    code?: string
    message?: string
  }
}

function apiErrorDetails(error: unknown) {
  return axios.isAxiosError<ApiErrorBody>(error) ? error.response?.data?.error : undefined
}

export function isVisitNotFoundError(error: unknown) {
  return axios.isAxiosError(error)
    && error.response?.status === 404
    && apiErrorDetails(error)?.code === 'VISIT_NOT_FOUND'
}

export function apiErrorMessage(error: unknown, fallback: string) {
  const message = apiErrorDetails(error)?.message || (error instanceof Error ? error.message : undefined)
  return safeApiErrorMessage(message, fallback)
}

axiosClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

axiosClient.interceptors.response.use((response) => response, (error: unknown) => {
  if (isVisitNotFoundError(error)) {
    useVisitStore.getState().clearVisit()
  }

  if (axios.isAxiosError(error) && error.response?.status === 401) {
    const requestUrl = error.config?.url ?? ''
    const isAuthRequest = requestUrl.includes('/auth/')

    if (!isAuthRequest) {
      useAuthStore.getState().logout()
      window.location.assign('/login')
    }
  }
  return Promise.reject(error)
})

export const mockDelay = <T>(data: T, ms = 350) => new Promise<T>((resolve) => window.setTimeout(() => resolve(data), ms))
export default axiosClient
