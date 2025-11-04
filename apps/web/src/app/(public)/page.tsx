import { Hero } from '@/components/home/hero'
import { About } from '@/components/home/about'
import { Events } from '@/components/home/events'
import { News } from '@/components/home/news'
import { JoinUs } from '@/components/home/join-us'

export default async function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      <Hero />
      <About />
      <Events />
      <News />
      <JoinUs />
    </div>
  )
}
