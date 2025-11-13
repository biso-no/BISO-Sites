'use server'

import { createAdminClient } from '@repo/api/server'
import { Query } from '@repo/api'
import { NewsItem, NewsItemWithTranslations } from '@/lib/types/news'
import { revalidatePath } from 'next/cache'
import { Campus, ContentTranslations, ContentType, Departments, News, Status } from '@repo/api/types/appwrite'
import { NEWS_SELECT_FIELDS, normalizeNewsRow } from './_utils/translatable'

export interface ListNewsParams {
  limit?: number
  status?: string
  campus?: string
  search?: string
  locale?: 'en' | 'no'
}

export interface CreateNewsData {
  status: string
  campus_id: string
  department_id: string
  slug?: string
  url?: string
  image?: string
  sticky?: boolean
  translations: {
    en?: {
      title: string
      content: string
    }
    no?: {
      title: string
      content: string
    }
  }
}


export async function listNews(params: ListNewsParams = {}): Promise<NewsItemWithTranslations[]> {
  const {
    limit = 25,
    status,
    campus,
    search,
  } = params

  try {
    const { db } = await createAdminClient()
    
    const queries = [
      Query.select([...NEWS_SELECT_FIELDS]),
      Query.limit(limit),
      Query.orderDesc('$createdAt')
    ]

    if (status && status !== 'all') {
      queries.push(Query.equal('status', status))
    }

    if (campus && campus !== 'all') {
      queries.push(Query.equal('campus_id', campus))
    }

    if (search?.trim()) {
      queries.push(Query.search('slug', search.trim()))
    }

    const newsResponse = await db.listRows<News>('app', 'news', queries)
    return newsResponse.rows.map(normalizeNewsRow)
  } catch (error) {
    console.error('Error fetching news:', error)
    return []
  }
}

export async function getNewsItem(id: string, locale?: 'en' | 'no'): Promise<NewsItemWithTranslations | null> {
  try {
    const { db } = await createAdminClient()

    const response = await db.listRows<News>('app', 'news', [
      Query.equal('$id', id),
      Query.limit(1),
      Query.select([...NEWS_SELECT_FIELDS])
    ])

    if (response.rows.length === 0) {
      return null
    }

    const record = normalizeNewsRow(response.rows[0])

    if (locale) {
      const selected = record.translations?.[locale]
      if (selected) {
        return {
          ...record,
          title: selected.title,
          content: selected.description,
        }
      }
    }

    return record
  } catch (error) {
    console.error('Error fetching news item:', error)
    return null
  }
}

export async function createNewsItem(data: CreateNewsData, skipRevalidation = false): Promise<News | null> {
  try {
    const { db } = await createAdminClient()
    
    // Build translation_refs array from provided translations only
    const translationRefs: ContentTranslations[] = []
    
    if (data.translations.en) {
      translationRefs.push({
        content_type: ContentType.NEWS,
        content_id: 'unique()',
        locale: Locale.EN,
        title: data.translations.en.title,
        description: data.translations.en.content,
      } as ContentTranslations)
    }
    
    if (data.translations.no) {
      translationRefs.push({
        content_type: ContentType.NEWS,
        content_id: 'unique()',
        locale: Locale.NO,
        title: data.translations.no.title,
        description: data.translations.no.content,
      } as ContentTranslations)
    }
    
    const newsItem = await db.createRow<News>('app', 'news', 'unique()', {
      status: data.status as Status,
      campus_id: data.campus_id,
      campus: data.campus_id,
      department_id: data.department_id ?? null,
      department: data.department_id ? data.department_id : null,
      slug: data.slug ?? null,
      url: data.url ?? null,
      image: data.image ?? null,
      metadata: [],
      sticky: data.sticky || false,
      translation_refs: translationRefs
    })
    
    if (!skipRevalidation) {
      revalidatePath('/news')
      revalidatePath('/admin/posts')
    }
    
    return newsItem
  } catch (error) {
    console.error('Error creating news item:', error)
    return null
  }
}

export async function updateNewsItem(id: string, data: Partial<CreateNewsData>, skipRevalidation = false): Promise<NewsItem | null> {
  try {
    const { db } = await createAdminClient()
    
    // Build update object
    const updateData: Record<string, unknown> = {}
    
    if (data.status !== undefined) updateData.status = data.status
    if (data.campus_id !== undefined) updateData.campus_id = data.campus_id
    if (data.department_id !== undefined) updateData.department_id = data.department_id
    if (data.slug !== undefined) updateData.slug = data.slug
    if (data.url !== undefined) updateData.url = data.url
    if (data.image !== undefined) updateData.image = data.image
    if (data.sticky !== undefined) updateData.sticky = data.sticky
    
    // Build translation_refs array from provided translations only
    if (data.translations) {
      const translationRefs: ContentTranslations[] = []
      
      if (data.translations.en) {
        translationRefs.push({
          content_type: ContentType.NEWS,
          content_id: id,
          locale: Locale.EN,
          title: data.translations.en.title,
          description: data.translations.en.content,
        } as ContentTranslations)
      }
      
      if (data.translations.no) {
        translationRefs.push({
          content_type: ContentType.NEWS,
          content_id: id,
          locale: Locale.NO,
          title: data.translations.no.title,
          description: data.translations.no.content,
        } as ContentTranslations)
      }
      
      if (translationRefs.length > 0) {
        updateData.translation_refs = translationRefs
      }
    }
    
    const newsItem = await db.updateRow<News>('app', 'news', id, updateData)
    return newsItem ?? null
  } catch (error) {
    console.error('Error updating news item:', error)
    return null
  }
}

export async function filterArticles(
  articles: ContentTranslations[],
  category: string,
  searchQuery: string
) {
  const normalizedCategory = category?.toLowerCase()
  const normalizedSearch = searchQuery?.toLowerCase?.() ?? ''

  return articles.filter((article) => {
    const matchesCategory =
      !normalizedCategory ||
      normalizedCategory === 'all' ||
      article.content_type?.toLowerCase() === normalizedCategory
    const title = article.title?.toLowerCase() ?? ''
    const matchesSearch = !normalizedSearch || title.includes(normalizedSearch)
    return matchesCategory && matchesSearch
  })
}