import React, { useEffect, useState } from 'react'
import { DashboardStats } from '@/types'
import { LoadingSpinner } from '../Common/LoadingSpinner'
import { PerformanceCharts } from './PerformanceCharts'
import { TrendingUp, Eye, BarChart3, Zap } from 'lucide-react'
import { listPipelineJobs } from '@/services/pipelineService'

export const Dashboard: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true)
  const [stats, setStats] = useState<DashboardStats>({
    totalVideos: 0,
    completedVideos: 0,
    totalViews: 0,
    avgEngagement: 0,
  })

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const jobs = await listPipelineJobs()
        if (!active) return
        const completed = jobs.filter((j) => j.state === 'completed').length
        setStats({
          totalVideos: jobs.length,
          completedVideos: completed,
          totalViews: 0,
          avgEngagement: 0,
        })
      } catch {
        if (!active) return
        setStats({
          totalVideos: 0,
          completedVideos: 0,
          totalViews: 0,
          avgEngagement: 0,
        })
      } finally {
        if (active) setIsLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [])

  if (isLoading) {
    return <LoadingSpinner message="Loading analytics..." />
  }

  const engagementPercentage = (stats.avgEngagement * 100).toFixed(1)

  return (
    <div className="max-w-6xl mx-auto animate-slideUp">
      <h1 className="text-3xl font-bold mb-2 text-secondary">Analytics Dashboard</h1>
      <p className="text-gray-500 mb-8">Track your video performance across platforms</p>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Total Videos</p>
              <p className="text-4xl font-bold text-primary mt-1">{stats.totalVideos}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
              <BarChart3 size={24} className="text-primary" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Completed</p>
              <p className="text-4xl font-bold text-green-600 mt-1">{stats.completedVideos}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center">
              <TrendingUp size={24} className="text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Total Views</p>
              <p className="text-4xl font-bold text-blue-600 mt-1">{stats.totalViews.toLocaleString()}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
              <Eye size={24} className="text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Avg Engagement</p>
              <p className="text-4xl font-bold text-yellow-600 mt-1">{engagementPercentage}%</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-yellow-50 flex items-center justify-center">
              <Zap size={24} className="text-yellow-600" />
            </div>
          </div>
        </div>
      </div>

      <PerformanceCharts stats={stats} />
    </div>
  )
}
