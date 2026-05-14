import { create } from 'zustand'
import { Job } from '@/types'

interface JobStore {
  jobs: {
    caption: Job[]
    render: Job[]
    publish: Job[]
  }
  isLoading: boolean
  error: string | null
  
  setJobs: (jobs: JobStore['jobs']) => void
  updateJob: (type: 'caption' | 'render' | 'publish', jobId: string, updates: Partial<Job>) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
}

export const useJobStore = create<JobStore>((set) => ({
  jobs: { caption: [], render: [], publish: [] },
  isLoading: false,
  error: null,
  
  setJobs: (jobs) => set({ jobs }),
  updateJob: (type, jobId, updates) => set((state) => ({
    jobs: {
      ...state.jobs,
      [type]: state.jobs[type].map((j) =>
        j.id === jobId ? { ...j, ...updates } : j
      )
    }
  })),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error })
}))
