import axios from 'axios'
import { useAuthStore } from '../stores/authStore'

export const USE_MOCK_API = import.meta.env.VITE_USE_MOCK_API !== 'false'

const axiosClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api/v1',
  timeout: 15_000,
})

axiosClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

axiosClient.interceptors.response.use((response) => response, (error: unknown) => {
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
