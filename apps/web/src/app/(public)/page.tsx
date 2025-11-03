import { listEvents } from '../actions/events'
import { listNews } from '../actions/news'
import { listJobs } from '../actions/jobs'
import { getProducts } from '../actions/products'
import { getLocale } from '../actions/locale'
import { HomePageClient } from './_components/home-page-client'
import type { EventWithTranslations } from '../../lib/types/event'
import type { JobWithTranslations } from '../../lib/types/job'
import type { NewsItemWithTranslations } from '../../lib/types/news'
import type { ProductWithTranslations } from '../../lib/types/product'
import { Navigation } from '@/components/layout/nav'
import { Hero } from '@/components/home/hero'
import { About } from '@/components/home/about'
import { Events } from '@/components/home/events'
import { News } from '@/components/home/news'
import { JoinUs } from '@/components/home/join-us'
import { Footer } from '@/components/layout/footer'

export default async function HomePage() {
  // Get user's preferred locale from their account preferences
  const locale = await getLocale()
  
  const [events, news, jobs, products] = await Promise.all([
    listEvents({ status: 'published', limit: 24, locale }),
    listNews({ status: 'published', limit: 8, locale }),
    listJobs({ status: 'published', limit: 24, locale }),
    getProducts('in-stock', locale),
  ])

  const safeEvents = Array.isArray(events) ? (events as EventWithTranslations[]) : []
  const safeNews = Array.isArray(news) ? (news as NewsItemWithTranslations[]) : []
  const safeJobs = Array.isArray(jobs) ? (jobs as JobWithTranslations[]) : []
  const safeProducts = Array.isArray(products) ? (products as ProductWithTranslations[]) : []

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
