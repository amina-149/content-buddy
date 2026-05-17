import React, { useState } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useUIStore } from '@/stores/uiStore'
import { Layout } from '@/components/Common/Layout'
import { VideoUpload } from '@/components/Upload/VideoUpload'
import { CaptionReview } from '@/components/Caption/CaptionReview'
import { DistributionSetup } from '@/components/Distribution/DistributionSetup'
import { JobMonitor } from '@/components/Monitor/JobMonitor'
import { Dashboard } from '@/components/Analytics/Dashboard'
import './App.css'

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLogin, setIsLogin] = useState(true)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const setToken = useAuthStore((state) => state.setToken)
  const setUser = useAuthStore((state) => state.setUser)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      // Simulate auth — works fully client-side for Vercel deployment
      await new Promise((r) => setTimeout(r, 800))

      if (!email || !password) {
        throw new Error('Please fill in all fields')
      }

      // Create a mock user and token
      const mockUser = {
        id: crypto.randomUUID(),
        email,
        firstName: firstName || email.split('@')[0],
        lastName: lastName || '',
        subscriptionPlan: 'PRO' as const,
      }

      setUser(mockUser)
      setToken('mock-jwt-token-' + Date.now())
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Authentication failed')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary to-secondary flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md animate-fadeIn">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-primary to-blue-700 rounded-2xl mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-secondary">OmniSolve AI</h1>
          <p className="text-gray-500 mt-1 text-sm">Video Captioning & Distribution</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="First Name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition"
              />
              <input
                type="text"
                placeholder="Last Name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition"
              />
            </div>
          )}

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition"
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition"
          />

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 px-4 bg-primary text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium"
          >
            {isLoading ? 'Processing...' : isLogin ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <button
          onClick={() => {
            setIsLogin(!isLogin)
            setError(null)
          }}
          className="w-full mt-4 text-primary hover:text-blue-600 font-medium text-sm"
        >
          {isLogin ? "Don't have an account? Register" : 'Already have an account? Sign In'}
        </button>
      </div>
    </div>
  )
}

export const App: React.FC = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const currentScreen = useUIStore((state) => state.currentScreen)

  if (!isAuthenticated) {
    return <LoginPage />
  }

  const renderScreen = () => {
    switch (currentScreen) {
      case 'upload':
        return <VideoUpload />
      case 'caption':
        return <CaptionReview />
      case 'distribution':
        return <DistributionSetup />
      case 'monitor':
        return <JobMonitor />
      case 'analytics':
        return <Dashboard />
      default:
        return <VideoUpload />
    }
  }

  return <Layout>{renderScreen()}</Layout>
}

export default App
