import { listEvents } from '@/app/actions/events'
import { listNews } from '@/app/actions/news'
import { getLocale } from '@/app/actions/locale'
import { HeroCarousel } from './hero-carousel'
import type { AdminEvent } from '@/lib/types/event'
import type { NewsItemWithTranslations } from '@/lib/types/news'
import type { Locale } from '@repo/api/types/appwrite'
import { pickTranslation } from '@/lib/utils/content-translations'

type FeaturedContent = {
  $id: string
  title?: string | null
  description?: string | null
  content_id: string
  event_ref?: {
    image?: string | null
    start_date?: string | null
    end_date?: string | null
    location?: string | null
    metadata?: Record<string, unknown>
  }
  news_ref?: {
    image?: string | null
  }
}

const mapEventsToFeatured = (events: AdminEvent[], locale: Locale): FeaturedContent[] =>
  events
    .map((event) => {
      const translation = pickTranslation(event, locale)
      if (!translation) return null

      return {
        $id: translation.$id ?? `${event.$id}-${translation.locale ?? locale}`,
        title: translation.title,
        description: translation.description,
        content_id: event.$id,
        event_ref: {
          image: event.image,
          start_date: event.start_date ?? event.metadata_parsed?.start_date ?? null,
          end_date: event.end_date ?? event.metadata_parsed?.end_date ?? null,
          location: event.location ?? event.metadata_parsed?.location ?? null,
          metadata: event.metadata_parsed ?? {},
        },
      } satisfies FeaturedContent
    })
    .filter((item): item is FeaturedContent => Boolean(item))

const mapNewsToFeatured = (news: NewsItemWithTranslations[], locale: Locale): FeaturedContent[] =>
  news
    .map((item) => {
      const translation = pickTranslation(item, locale)
      if (!translation) return null

      return {
        $id: translation.$id ?? `${item.$id}-${translation.locale ?? locale}`,
        title: translation.title,
        description: translation.description,
        content_id: item.$id,
        news_ref: {
          image: item.image ?? null,
        },
      } satisfies FeaturedContent
    })
    .filter((item): item is FeaturedContent => Boolean(item))

export async function HeroSection() {
  const locale = await getLocale()
  
  // Fetch featured events and news
  const [events, news] = await Promise.all([
    listEvents({ status: 'published', limit: 3 }),
    listNews({ status: 'published', limit: 2 }),
  ])

  const featuredContent = [...mapEventsToFeatured(events, locale), ...mapNewsToFeatured(news, locale)].slice(
    0,
    5
  )

  return <HeroCarousel featuredContent={featuredContent} />
}
