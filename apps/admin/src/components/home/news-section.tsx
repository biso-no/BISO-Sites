import { listNews } from '@/app/actions/news'
import { getLocale } from '@/app/actions/locale'
import { NewsClient } from './news-client'
import type { NewsItemWithTranslations } from '@/lib/types/news'
import type { ContentTranslations, Locale } from '@repo/api/types/appwrite'
import { pickTranslation } from '@/lib/utils/content-translations'

const mapNewsToClient = (news: NewsItemWithTranslations[], locale: Locale): ContentTranslations[] =>
  news
    .map((item) => {
      const translation = pickTranslation(item, locale)
      if (!translation) return null

      return {
        ...translation,
        $id: translation.$id ?? `${item.$id}-${translation.locale ?? locale}`,
        content_id: item.$id,
        news_ref: {
          ...item,
        },
      } as ContentTranslations
    })
    .filter((item): item is ContentTranslations => Boolean(item))

export async function NewsSection() {
  const locale = await getLocale();
  
  const news = await listNews({
    status: 'published',
    limit: 3,
  });

  return <NewsClient news={mapNewsToClient(news, locale)} />;
}

