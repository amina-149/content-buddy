export interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  subscriptionPlan: 'FREE' | 'PRO' | 'ENTERPRISE'
  profilePictureUrl?: string
}

export interface Video {
  id: string
  userId: string
  title: string
  description: string
  sourceUrl: string
  sourceType: 'YOUTUBE' | 'INSTAGRAM' | 'TIKTOK' | 'UPLOAD' | 'URL'
  downloadedFilePath: string
  status: 'PENDING' | 'DOWNLOADING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
  defaultLanguage: string
  captions: Caption[]
  renderedVideos: RenderedVideo[]
  publishingHistory: PublishingHistory[]
  createdAt: string
  updatedAt: string
}

export interface Caption {
  id: string
  videoId: string
  language: string
  srtContent: string
  vttContent: string
  accuracy: number
  isAuto: boolean
}

export interface RenderedVideo {
  id: string
  videoId: string
  platform: 'YOUTUBE' | 'INSTAGRAM' | 'TIKTOK'
  filePath: string
  fileSize: number
  resolution: string
  quality: 'hd' | 'sd' | 'mobile'
  format: string
  codec: string
}

export interface PublishingHistory {
  id: string
  videoId: string
  platform: 'YOUTUBE' | 'INSTAGRAM' | 'TIKTOK'
  platformVideoId: string
  platformUrl: string
  viewCount: number
  engagementRate: number
  publishedAt: string
}

export interface Job {
  id: string
  userId: string
  videoId: string
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
  progress: number
  errorMessage?: string
  retryCount: number
  maxRetries: number
  nextRetryAt?: string
}

export interface DashboardStats {
  totalVideos: number
  completedVideos: number
  totalViews: number
  avgEngagement: number
}

export interface PlatformCredential {
  platform: 'YOUTUBE' | 'INSTAGRAM' | 'TIKTOK'
  isConnected: boolean
  lastUsedAt?: string
}
