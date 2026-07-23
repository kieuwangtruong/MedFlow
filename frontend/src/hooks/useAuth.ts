import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { authApi } from '../api/authApi'
import { useAuthStore } from '../stores/authStore'
import { useVisitStore } from '../stores/visitStore'

export const useAuth = () => {
  const navigate = useNavigate()
  const { user, token, setAuth, logout: clearAuth } = useAuthStore()
  const clearVisit = useVisitStore((state) => state.clearVisit)
  const login = useMutation({
    mutationFn: ({ cccd }: { cccd: string }) => authApi.login(cccd),
    onSuccess: ({ access_token, user: nextUser, active_visit: activeVisit }) => {
      if (activeVisit) useVisitStore.getState().setVisit(activeVisit.visitId, activeVisit.queueNumber)
      else clearVisit()
      setAuth(access_token, nextUser)
      navigate(`/${nextUser.role.toLowerCase()}`)
    },
  })
  const staffLogin = useMutation({
    mutationFn: ({ userName, password }: { userName: string; password: string }) =>
      authApi.staffLogin(userName, password),
    onSuccess: ({ access_token, user: nextUser }) => {
      clearVisit()
      setAuth(access_token, nextUser)
      navigate(`/${nextUser.role.toLowerCase()}`)
    },
  })
  const logout = () => {
    clearVisit()
    clearAuth()
    navigate('/login')
  }
  return { user, token, login, staffLogin, logout, isAuthenticated: Boolean(token && user) }
}
