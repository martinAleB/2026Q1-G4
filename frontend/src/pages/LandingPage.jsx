import { LandingAbout } from '@/components/shared/LandingAbout'
import { LandingFeatures } from '@/components/shared/LandingFeatures'
import { LandingFooter } from '@/components/shared/LandingFooter'
import { LandingHeader } from '@/components/shared/LandingHeader'
import { LandingHero } from '@/components/shared/LandingHero'
import { LandingPricing } from '@/components/shared/LandingPricing'

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <LandingHeader />
      <main className="flex-1">
        <LandingHero />
        <LandingFeatures />
        <LandingAbout />
        {/*<LandingPricing />*/}
      </main>
      <LandingFooter />
    </div>
  )
}
