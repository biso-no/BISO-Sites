'use server'

import { createAdminClient } from '@repo/api/server'
import { Query } from '@repo/api'
import { NewsItem } from '@/lib/types/news'
import { revalidatePath } from 'next/cache'
import { Campus, ContentTranslations, ContentType, Departments, Locale, News, Status } from '@repo/api/types/appwrite'

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

export async function listNews(params: ListNewsParams = {}): Promise<ContentTranslations[]> {
  const {
    limit = 25,
    status,
    campus,
    locale
  } = params

  try {
    const { db } = await createAdminClient()
    
    const queries = [
      Query.equal('content_type', ContentType.NEWS),
      Query.select(['content_id', '$id', 'locale', 'title', 'description', 'news_ref.*']),
      Query.equal('locale', locale as Locale),
      Query.limit(limit),
      Query.orderDesc('$createdAt')
    ]

    if (status && status !== 'all') {
      queries.push(Query.equal('news_ref.status', status))
    }

    if (campus && campus !== 'all') {
      queries.push(Query.equal('news_ref.campus_id', campus))
    }

    // Get news with their translations using Appwrite's nested relationships
    const newsResponse = await db.listRows('app', 'content_translations', queries)
    const newsItems = newsResponse.rows as unknown as ContentTranslations[]

    return newsItems
  } catch (error) {
    console.error('Error fetching news:', error)
    return []
  }
}

export async function getNewsItem(id: string, locale: 'en' | 'no'): Promise<ContentTranslations | null> {
  try {
    const { db } = await createAdminClient()
    
    // Query content_translations by content_id and locale
    const translationsResponse = await db.listRows('app', 'content_translations', [
      Query.equal('content_type', ContentType.NEWS),
      Query.equal('content_id', id),
      Query.equal('locale', locale),
      Query.select(['content_id', '$id', 'locale', 'title', 'description', 'news_ref.*']),
      Query.limit(1)
    ])
    
    if (translationsResponse.rows.length === 0) {
      return null
    }
    
    return translationsResponse.rows[0] as unknown as ContentTranslations
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
    
    const newsItem = await db.createRow('app', 'news', 'unique()', {
      status: data.status as Status,
      campus_id: data.campus_id,
      campus: data.campus_id as unknown as Campus,
      department_id: data.department_id ?? null,
      department: data.department_id ? (data.department_id as unknown as Departments) : ({ $id: '' } as Departments),
      slug: data.slug ?? null,
      url: data.url ?? null,
      image: data.image ?? null,
      metadata: [],
      sticky: data.sticky || false,
      translation_refs: translationRefs
    }) as News
    
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
    
    const newsItem = await db.updateRow('app', 'news', id, updateData) as unknown as NewsItem
    
    if (!skipRevalidation) {
      revalidatePath('/news')
      revalidatePath('/admin/posts')
    }
    return newsItem
  } catch (error) {
    console.error('Error updating news item:', error)
    return null
  }
}

export async function deleteNewsItem(id: string, skipRevalidation = false): Promise<boolean> {
  try {
    const { db } = await createAdminClient()
    await db.deleteRow('app', 'news', id)
    if (!skipRevalidation) {
      revalidatePath('/news')
      revalidatePath('/admin/posts')
    }
    return true
  } catch (error) {
    console.error('Error deleting news item:', error)
    return false
  }
}

// Helper function to get departments for a specific campus
export async function listDepartments(campusId?: string) {
  const queries = [Query.equal('active', true)]
  
  if (campusId) {
    queries.push(Query.equal('campus_id', campusId))
  }

  try {
    const { db } = await createAdminClient()
    const response = await db.listRows('app', 'departments', queries)
    return response.rows
  } catch (error) {
    console.error('Error fetching departments:', error)
    return []
  }
}

// Helper function to get campuses
export async function listCampuses() {
  try {
    const { db } = await createAdminClient()
    const response = await db.listRows('app', 'campus')
    return response.rows
  } catch (error) {
    console.error('Error fetching campuses:', error)
    return []
  }
}
