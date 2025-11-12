'use server'

import { createSessionClient } from '@repo/api/server'
import { ID, Query } from '@repo/api'
import { ContentTranslation } from '@/lib/types/content-translation'
import { revalidatePath } from 'next/cache'
import { ContentTranslations, ContentType, Departments, Events, Status, Campus } from '@repo/api/types/appwrite'
import { Locale } from '@repo/api/types/appwrite'

export interface ListEventsParams {
  limit?: number
  status?: string
  campus?: string
  search?: string
  locale?: 'en' | 'no'
}

export interface CreateEventData {
  slug?: string
  status: 'draft' | 'published' | 'cancelled'
  campus_id: string
  member_only?: boolean
  collection_id?: string
  is_collection?: boolean
  collection_pricing?: 'bundle' | 'individual'
  metadata?: {
    start_date?: string
    end_date?: string
    location?: string
    price?: number
    ticket_url?: string
    image?: string
  }
  translations: {
    en?: {
      title: string
      description: string
    }
    no?: {
      title: string
      description: string
    }
  }
}

export async function listEvents(params: ListEventsParams = {}): Promise<ContentTranslations[]> {
  const {
    limit = 25,
    status = 'published',
    campus,
    locale
  } = params

  try {
    const { db } = await createSessionClient()
    
    const queries = [
      Query.equal('content_type', 'event'),
      Query.select(['content_id', '$id', 'locale', 'title', 'description', 'event_ref.*']),
      Query.equal('locale', locale as Locale),
      Query.limit(limit),
      Query.orderDesc('$createdAt')
    ]

    if (status !== 'all') {
      queries.push(Query.equal('event_ref.status', status))
    }

    if (campus && campus !== 'all') {
      queries.push(Query.equal('event_ref.campus_id', campus))
    }

    // Get events with their translations using Appwrite's nested relationships
    const eventsResponse = await db.listRows<ContentTranslations>('app', 'content_translations', queries)
    const events = eventsResponse.rows

    return events
  } catch (error) {
    console.error('Error fetching events:', error)
    return []
  }
}

export async function getEvent(id: string, locale: 'en' | 'no'): Promise<ContentTranslations[] | null> {
  try {
    const { db } = await createSessionClient()
    
    // Query content_translations by content_id and locale
    const translationsResponse = await db.listRows<ContentTranslations>('app', 'content_translations', [
      Query.equal('content_type', ContentType.EVENT),
      Query.equal('content_id', id),
      Query.equal('locale', locale),
      Query.select(['content_id', '$id', 'locale', 'title', 'description', 'event_ref.*']),
      Query.limit(1)
    ])
    
    if (translationsResponse.rows.length === 0) {
      return null
    }
    
    return translationsResponse.rows
  } catch (error) {
    console.error('Error fetching event:', error)
    return null
  }
}

export async function createEvent(data: CreateEventData, skipRevalidation = false) {
  try {
    const { db } = await createSessionClient()

    const eventId = ID.unique()
    
    // Build translation_refs array from provided translations only
    const translationRefs: ContentTranslations[] = []
    
    if (data.translations.en) {
      translationRefs.push({
        content_type: ContentType.EVENT,
        content_id: eventId,
        locale: Locale.EN,
        title: data.translations.en.title,
        description: data.translations.en.description,
      } as ContentTranslations)
    }
    
    if (data.translations.no) {
      translationRefs.push({
        content_type: ContentType.EVENT,
        content_id: eventId,
        locale: Locale.NO,
        title: data.translations.no.title,
        description: data.translations.no.description,
      } as ContentTranslations)
    }
    
    const event = await db.createRow('app', 'events', eventId, {
      campus_id: data.campus_id,
      campus: data.campus_id,
      start_date: data.metadata?.start_date as string | null,
      end_date: data.metadata?.end_date as string | null,
      location: data.metadata?.location as string | null,
      price: data.metadata?.price as number | null,
      ticket_url: data.metadata?.ticket_url as string | null,
      image: data.metadata?.image as string | null,
      status: data.status as Status,
      slug: data.slug as string | null,
      metadata: data.metadata ? JSON.stringify(data.metadata) : null,
      member_only: data.member_only ?? false,
      collection_id: data.collection_id as string | null,
      is_collection: data.is_collection ?? false,
      collection_pricing: data.collection_pricing as 'bundle' | 'individual' | null,
      translation_refs: translationRefs
    }) as Events
    
    if (!skipRevalidation) {
      revalidatePath('/admin/events')
      revalidatePath('/events')
    }
    return event
  } catch (error) {
    console.error('Error creating event:', error)
    return null
  }
}

export async function updateEvent(id: string, data: Partial<CreateEventData>): Promise<Events | null> {
  try {
    const { db } = await createSessionClient()
    
    // Build update object
    const updateData: Record<string, unknown> = {}
    
    if (data.status !== undefined) updateData.status = data.status as Status
    if (data.slug !== undefined) updateData.slug = data.slug as string | null
    if (data.metadata !== undefined) updateData.metadata = data.metadata ? JSON.stringify(data.metadata) : null
    if (data.campus_id !== undefined) updateData.campus_id = data.campus_id
    if (data.member_only !== undefined) updateData.member_only = data.member_only
    if (data.collection_id !== undefined) updateData.collection_id = data.collection_id as string | null
    if (data.is_collection !== undefined) updateData.is_collection = data.is_collection
    if (data.collection_pricing !== undefined) updateData.collection_pricing = data.collection_pricing as 'bundle' | 'individual' | null
    
    // Build translation_refs array from provided translations only
    if (data.translations) {
      const translationRefs: ContentTranslations[] = []
      
      if (data.translations.en) {
        translationRefs.push({
          content_type: ContentType.EVENT,
          content_id: id,
          locale: Locale.EN,
          title: data.translations.en.title,
          description: data.translations.en.description,
        } as ContentTranslations)
      }
      
      if (data.translations.no) {
        translationRefs.push({
          content_type: ContentType.EVENT,
          content_id: id,
          locale: Locale.NO,
          title: data.translations.no.title,
          description: data.translations.no.description,
        } as ContentTranslations)
      }
      
      if (translationRefs.length > 0) {
        updateData.translation_refs = translationRefs
      }
    }
    
    const event = await db.updateRow('app', 'events', id, updateData) as Events
    
    revalidatePath('/events')
    revalidatePath('/admin/events')
    
    return event
  } catch (error) {
    console.error('Error updating event:', error)
    return null
  }
}

export async function deleteEvent(id: string): Promise<boolean> {
  try {
    const { db } = await createSessionClient()
    
      await db.deleteRow('app', 'events', id)
      revalidatePath('/events')
      revalidatePath('/admin/events')
      return true
} catch (error) {
  console.error('Error deleting event:', error)
  return false
}
}

// AI Translation function for events
export async function translateEventContent(
  eventId: string, 
  fromLocale: 'en' | 'no', 
  toLocale: 'en' | 'no'
): Promise<ContentTranslation | null> {
  try {
    const { db } = await createSessionClient()
    
    // Get existing translation
    const existingResponse = await db.listRows('app', 'content_translations', [
      Query.equal('content_type', ContentType.EVENT),
      Query.equal('content_id', eventId),
      Query.equal('locale', fromLocale)
    ])
    
    if (existingResponse.rows.length === 0) {
      throw new Error('Source translation not found')
    }
    
    const sourceTranslation = existingResponse.rows[0]
    
    // Use your existing AI implementation to translate
    const { generateText } = await import('ai')
    const { openai } = await import('@ai-sdk/openai')
    
    const prompt = `Translate the following event content from ${fromLocale === 'en' ? 'English' : 'Norwegian'} to ${toLocale === 'en' ? 'English' : 'Norwegian'}. Maintain the HTML formatting and professional tone suitable for a student organization event.

Title: ${sourceTranslation?.title}

Description: ${sourceTranslation?.description}

Please respond with a JSON object containing the translated title and description:
{
  "title": "translated title",
  "description": "translated description"
}`

    const result = await generateText({
      model: openai('gpt-4o'),
      prompt
    })
    
    const translated = JSON.parse(result.text)
    
    // Check if translation already exists
    const existingTranslationResponse = await db.listRows('app', 'content_translations', [
      Query.equal('content_type', 'event'),
      Query.equal('content_id', eventId),
      Query.equal('locale', toLocale)
    ])
    
    let translationRecord: ContentTranslation
    
    if (existingTranslationResponse.rows.length > 0) {
      // Update existing translation
      translationRecord = await db.updateRow('app', 'content_translations', existingTranslationResponse.rows[0]!.$id, {
        title: translated.title,
        description: translated.description
      }) as ContentTranslation
    } else {
      // Create new translation
      translationRecord = await db.createRow('app', 'content_translations', 'unique()', {
        content_type: 'event',
        content_id: eventId,
        locale: toLocale,
        title: translated.title,
        description: translated.description,
      }) as ContentTranslation
    }
    
    revalidatePath('/admin/events')
    return translationRecord
  } catch (error) {
    console.error('Error translating event content:', error)
    return null
  }
}

export async function uploadEventImage(formData: FormData) {
  const { storage } = await createSessionClient()
  const file = formData.get('file') as File
  const uploaded = await storage.createFile('events', 'unique()', file)
  return uploaded
}

export async function getEventImageViewUrl(fileId: string) {
  const { storage } = await createSessionClient()
  const url = await storage.getFileView('events', fileId)
  return url
}

// Helper function to get departments for a specific campus
export async function listDepartments(campusId?: string) {
  const queries = [Query.equal('active', true)]
  
  if (campusId) {
    queries.push(Query.equal('campus_id', campusId))
  }

  try {
    const { db } = await createSessionClient()
    const response = await db.listRows<Departments>('app', 'departments', queries)
    return response.rows
  } catch (error) {
    console.error('Error fetching departments:', error)
    return []
  }
}

// Helper function to get campuses
export async function listCampuses() {
  try {
    const { db } = await createSessionClient()
    const response = await db.listRows<Campus>('app', 'campus')
    return response.rows
  } catch (error) {
    console.error('Error fetching campuses:', error)
    return []
  }
}

// Helper function to get collection events
export async function getCollectionEvents(collectionId: string, locale: 'en' | 'no'): Promise<ContentTranslations[]> {
  try {
    const { db } = await createSessionClient()
    
    // Get all events with this collection_id
    const response = await db.listRows<ContentTranslations>('app', 'content_translations', [
      Query.equal('content_type', ContentType.EVENT),
      Query.equal('locale', locale),
      Query.equal('event_ref.collection_id', collectionId),
      Query.select(['content_id', '$id', 'locale', 'title', 'description', 'event_ref.*']),
      Query.orderAsc('event_ref.start_date')
    ])
    
    return response.rows
  } catch (error) {
    console.error('Error fetching collection events:', error)
    return []
  }
}


