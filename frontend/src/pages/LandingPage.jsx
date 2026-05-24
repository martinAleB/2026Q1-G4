import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { LandingFeatures } from '@/components/shared/LandingFeatures'
import { LandingFooter } from '@/components/shared/LandingFooter'
import { LandingHeader } from '@/components/shared/LandingHeader'
import { LandingHero } from '@/components/shared/LandingHero'
import { useAuth } from '@/store/AuthContext'

export default function LandingPage() {
  const { isAuthenticated, needsOnboarding } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (isAuthenticated) {
      if (needsOnboarding) {
        navigate('/onboarding', { replace: true })
      } else {
        navigate('/dashboard', { replace: true })
      }
    }
  }, [isAuthenticated, needsOnboarding, navigate])

  return (
    <div className="flex min-h-screen flex-col">
      <LandingHeader />
      <main className="flex-1">
        <LandingHero />
        <LandingFeatures />
      </main>
      <LandingFooter />
    </div>
  )
}
