import axios, { AxiosInstance } from 'axios'
import { useAuthStore } from '@/stores/authStore'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api'

const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
})

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout()
    }
    return Promise.reject(error)
  }
)

export const apiService = {
  // Auth endpoints
  register: (email: string, password: string, firstName: string, lastName: string) =>
    apiClient.post('/auth/register', { email, password, firstName, lastName }),
  
  login: (email: string, password: string) =>
    apiClient.post('/auth/login', { email, password }),
  
  // Video endpoints
  getVideos: () => apiClient.get('/videos'),
  
  uploadVideo: (title: string, description: string, sourceUrl: string, sourceType: string) =>
    apiClient.post('/videos', { title, description, sourceUrl, sourceType }),
  
  getVideo: (videoId: string) => apiClient.get(`/videos/${videoId}`),
  
  deleteVideo: (videoId: string) => apiClient.delete(`/videos/${videoId}`),
  
  // Job endpoints
  getJobs: () => apiClient.get('/jobs'),
  
  getJob: (jobId: string) => apiClient.get(`/jobs/${jobId}`),
  
  // Dashboard endpoints
  getAnalytics: () => apiClient.get('/dashboard/analytics'),
  
  // OAuth endpoints
  getYouTubeAuthUrl: () => apiClient.get('/auth/youtube'),
  getInstagramAuthUrl: () => apiClient.get('/auth/instagram'),
  getTikTokAuthUrl: () => apiClient.get('/auth/tiktok')
}

export default apiClient
