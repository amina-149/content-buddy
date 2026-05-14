import React, { useState } from 'react'
import { useUIStore } from '@/stores/uiStore'
import { Play, Camera, Music2, CheckCircle, Circle } from 'lucide-react'

interface PlatformStatus {
  platform: 'YOUTUBE' | 'INSTAGRAM' | 'TIKTOK'
  isConnected: boolean
  icon: React.ReactNode
  label: string
  bgColor: string
  borderColor: string
}

export const DistributionSetup: React.FC = () => {
  const [platforms, setPlatforms] = useState<PlatformStatus[]>([
    { platform: 'YOUTUBE', isConnected: false, icon: <Play size={32} className="text-red-500" />, label: 'YouTube', bgColor: 'bg-red-50', borderColor: 'border-red-200' },
    { platform: 'INSTAGRAM', isConnected: false, icon: <Camera size={32} className="text-pink-500" />, label: 'Instagram', bgColor: 'bg-pink-50', borderColor: 'border-pink-200' },
    { platform: 'TIKTOK', isConnected: false, icon: <Music2 size={32} />, label: 'TikTok', bgColor: 'bg-gray-900 text-white', borderColor: 'border-gray-800' }
  ])
  const [isLoading, setIsLoading] = useState(false)
  const addNotification = useUIStore((state) => state.addNotification)

  const handleConnect = async (platformLabel: string) => {
    setIsLoading(true)
    addNotification(`Connecting to ${platformLabel}...`, 'info')

    // Simulate OAuth flow
    setTimeout(() => {
      setPlatforms((prev) =>
        prev.map((p) =>
          p.label === platformLabel ? { ...p, isConnected: true } : p
        )
      )
      addNotification(`Successfully connected to ${platformLabel}!`, 'success')
      setIsLoading(false)
    }, 1500)
  }

  return (
    <div className="max-w-4xl mx-auto animate-slideUp">
      <h1 className="text-3xl font-bold mb-2 text-secondary">Distribution Setup</h1>
      <p className="text-gray-500 mb-8">Connect your platform accounts to distribute videos</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {platforms.map((platform) => (
          <div
            key={platform.platform}
            className={`p-8 rounded-xl border-2 ${platform.bgColor} ${platform.borderColor} transition hover:shadow-lg`}
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                {platform.icon}
                <h3 className="font-bold text-xl">{platform.label}</h3>
              </div>
              {platform.isConnected ? (
                <CheckCircle size={24} className="text-green-500" />
              ) : (
                <Circle size={24} className="text-gray-400" />
              )}
            </div>

            <button
              onClick={() => handleConnect(platform.label)}
              disabled={isLoading || platform.isConnected}
              className={`w-full py-2.5 px-4 rounded-lg font-medium transition text-sm ${
                platform.isConnected
                  ? 'bg-green-100 text-green-700 cursor-not-allowed'
                  : 'bg-primary text-white hover:bg-blue-600'
              }`}
            >
              {platform.isConnected ? '✓ Connected' : `Connect ${platform.label}`}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
