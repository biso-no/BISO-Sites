import { Suspense } from 'react'
import { HeroSection } from '@/components/home/hero-section'
import { AboutSection } from '@/components/home/about-section'
import { EventsSection } from '@/components/home/events-section'
import { NewsSection } from '@/components/home/news-section'
import { JoinUs } from '@/components/home/join-us'
import { 
  HeroSkeleton, 
  AboutSkeleton, 
  EventsSkeleton, 
  NewsSkeleton 
} from '@/components/home/skeletons'

export default async function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      <Suspense fallback={<HeroSkeleton />}>
        <HeroSection />
      </Suspense>
      
      <Suspense fallback={<AboutSkeleton />}>
        <AboutSection />
      </Suspense>
      
      <Suspense fallback={<EventsSkeleton />}>
        <EventsSection />
      </Suspense>
      
      <Suspense fallback={<NewsSkeleton />}>
        <NewsSection />
      </Suspense>
      
      <JoinUs />
    </div>
  )
}
