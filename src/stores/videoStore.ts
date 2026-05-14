import { create } from 'zustand'
import { Video } from '@/types'

interface VideoStore {
  videos: Video[]
  selectedVideo: Video | null
  isLoading: boolean
  error: string | null
  
  setVideos: (videos: Video[]) => void
  addVideo: (video: Video) => void
  updateVideo: (videoId: string, updates: Partial<Video>) => void
  deleteVideo: (videoId: string) => void
  selectVideo: (video: Video | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
}

export const useVideoStore = create<VideoStore>((set) => ({
  videos: [],
  selectedVideo: null,
  isLoading: false,
  error: null,
  
  setVideos: (videos) => set({ videos }),
  addVideo: (video) => set((state) => ({
    videos: [video, ...state.videos]
  })),
  updateVideo: (videoId, updates) => set((state) => ({
    videos: state.videos.map((v) =>
      v.id === videoId ? { ...v, ...updates } : v
    ),
    selectedVideo: state.selectedVideo?.id === videoId
      ? { ...state.selectedVideo, ...updates }
      : state.selectedVideo
  })),
  deleteVideo: (videoId) => set((state) => ({
    videos: state.videos.filter((v) => v.id !== videoId),
    selectedVideo: state.selectedVideo?.id === videoId ? null : state.selectedVideo
  })),
  selectVideo: (video) => set({ selectedVideo: video }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error })
}))
