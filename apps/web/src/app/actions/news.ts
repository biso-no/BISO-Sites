'use server'

import { createAdminClient } from '@repo/api/server'
import { Query } from '@repo/api'
import { NewsItem, NewsItemWithTranslations } from '@/lib/types/news'
import { ContentTranslation } from '@/lib/types/content-translation'
import { revalidatePath } from 'next/cache'

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

// Helper function to get translation for a specific locale
function getNewsTranslation(translations: any[], locale: 'en' | 'no'): any | null {
  return translations.find(t => t.locale === locale) || null
}

// Helper function to combine news with its translations
function combineNewsWithTranslations(news: NewsItem, locale: 'en' | 'no'): NewsItemWithTranslations {
  const translation = getNewsTranslation(news.translation_refs || [], locale)
  
  return {
    ...news,
    title: translation?.title,
    content: translation?.description // Note: using description field from translations
  }
}

export async function listNews(params: ListNewsParams = {}): Promise<NewsItemWithTranslations[]> {
  const {
    limit = 25,
    status,
    campus,
    search,
    locale
  } = params

  try {
    const { db } = await createAdminClient()
    
    const queries = [
      Query.limit(limit),
      Query.orderDesc('$createdAt')
    ]

    if (status && status !== 'all') {
      queries.push(Query.equal('status', status))
    }

    if (campus && campus !== 'all') {
      queries.push(Query.equal('campus_id', campus))
    }

    // Get news with their translations using Appwrite's nested relationships
    const newsResponse = await db.listRows('app', 'news', queries)
    const newsItems = newsResponse.rows as unknown as NewsItem[]

    // Process news and apply locale filtering if needed
    let processedNews = newsItems.map(news => {
      if (locale) {
        return combineNewsWithTranslations(news, locale)
      }
      return news as NewsItemWithTranslations
    })

    // Apply search filter on translated content if needed
    if (search && locale) {
      processedNews = processedNews.filter(news => 
        news.title?.toLowerCase().includes(search.toLowerCase()) ||
        news.content?.toLowerCase().includes(search.toLowerCase())
      )
    }

    // Filter out news that don't have the requested locale translation
    if (locale) {
      processedNews = processedNews.filter(news => news.title) // Has translation for requested locale
    }

    return processedNews
  } catch (error) {
    console.error('Error fetching news:', error)
    return []
  }
}

export async function getNewsItem(id: string, locale?: 'en' | 'no'): Promise<NewsItemWithTranslations | null> {
  try {
    const { db } = await createAdminClient()
    
    // Get the main news record - Appwrite will automatically include translation_refs
    const newsItem = await db.getRow('app', 'news', id) as NewsItem
    
    return locale ? combineNewsWithTranslations(newsItem, locale) : newsItem as NewsItemWithTranslations
  } catch (error) {
    console.error('Error fetching news item:', error)
    return null
  }
}

export async function createNewsItem(data: CreateNewsData, skipRevalidation = false): Promise<NewsItem | null> {
  try {
    const { db } = await createAdminClient()
    
    // Create main news record first
    const newsData = {
      status: data.status,
      campus_id: data.campus_id,
      department_id: data.department_id,
      slug: data.slug,
      url: data.url,
      image: data.image,
      sticky: data.sticky || false
    }
    
    const newsItem = await db.createRow('app', 'news', 'unique()', newsData) as NewsItem
    
    // Create translations with proper relationships
    const translationsArray = Object.entries(data.translations)
      .filter(([locale, translation]) => translation)
      .map(([locale, translation]) => ({
        content_type: 'news',
        content_id: newsItem.$id,
        locale,
        title: translation!.title,
        description: translation!.content, // Note: storing content in description field
        news_ref: newsItem.$id
      }))
    
    // Create all translations
    if (translationsArray.length > 0) {
      const translationPromises = translationsArray.map(translationData =>
        db.createRow('app', 'content_translations', 'unique()', translationData)
      )
      await Promise.all(translationPromises)
    }
    
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

export async function updateNewsItem(id: string, data: Partial<NewsItem>, skipRevalidation = false): Promise<NewsItem | null> {
  try {
    const { db } = await createAdminClient()
    const newsItem = await db.updateRow('app', 'news', id, data) as unknown as NewsItem
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
