import { useAuthStore } from '@/stores/authStore'
import { apiService } from './api'
import { jwtDecode } from 'jwt-decode'

export const authService = {
  register: async (email: string, password: string, firstName: string, lastName: string) => {
    try {
      const response = await apiService.register(email, password, firstName, lastName)
      const { token } = response.data
      useAuthStore.getState().setToken(token)
      // const decoded: any = jwtDecode(token)
      return { success: true }
    } catch (error: any) {
      throw error.response?.data?.message || 'Registration failed'
    }
  },
  
  login: async (email: string, password: string) => {
    try {
      const response = await apiService.login(email, password)
      const { token } = response.data
      useAuthStore.getState().setToken(token)
      return { success: true }
    } catch (error: any) {
      throw error.response?.data?.message || 'Login failed'
    }
  },
  
  logout: () => {
    useAuthStore.getState().logout()
  },
  
  isTokenValid: (): boolean => {
    const token = useAuthStore.getState().token
    if (!token) return false
    
    try {
      const decoded: any = jwtDecode(token)
      return decoded.exp * 1000 > Date.now()
    } catch {
      return false
    }
  }
}
