import React from 'react'
import { Job } from '@/types'
import { CheckCircle, Clock, AlertCircle } from 'lucide-react'

interface JobProgressProps {
  job: Job & { type: string }
}

export const JobProgress: React.FC<JobProgressProps> = ({ job }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-100 text-green-700'
      case 'PROCESSING':
        return 'bg-blue-100 text-blue-700'
      case 'FAILED':
        return 'bg-red-100 text-red-700'
      default:
        return 'bg-gray-100 text-gray-700'
    }
  }
  
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle size={20} />
      case 'PROCESSING':
        return <Clock size={20} />
      case 'FAILED':
        return <AlertCircle size={20} />
      default:
        return <Clock size={20} />
    }
  }
  
  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-lg">{job.type} Job</h3>
          <p className="text-sm text-gray-600">Video ID: {job.videoId}</p>
        </div>
        <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${getStatusColor(job.status)}`}>
          {getStatusIcon(job.status)}
          <span>{job.status}</span>
        </div>
      </div>
      
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-gray-600">Progress</span>
          <span className="text-sm font-medium">{job.progress}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-primary h-2 rounded-full transition-all"
            style={{ width: `${job.progress}%` }}
          />
        </div>
      </div>
      
      {job.errorMessage && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {job.errorMessage}
        </div>
      )}
      
      {job.retryCount > 0 && (
        <div className="mt-2 text-xs text-gray-600">
          Retried {job.retryCount} times (Max: {job.maxRetries})
        </div>
      )}
    </div>
  )
}
