import { Models } from '@repo/api'
import type { ContentTranslations } from '@repo/api/types/appwrite'
import type { TranslationMap } from '@/lib/utils/content-translations'

export interface NewsItem extends Models.Row {
  status: string
  campus_id: string
  department_id: string
  slug?: string
  url?: string
  image?: string
  sticky?: boolean
  locale?: 'en' | 'no' // Keep for backwards compatibility
  // Relationship references (populated at runtime)
  campus?: { $id: string; name: string }
  department?: { $id: string; Name: string; campus_id: string }
  translation_refs?: ContentTranslations[]
  translations?: TranslationMap<ContentTranslations>
}

// Helper interface for working with news data including translations
export interface NewsItemWithTranslations extends NewsItem {
  // Convenience properties for the current locale
  title?: string
  content?: string
}
