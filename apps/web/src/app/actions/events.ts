'use server'

import { createAdminClient } from '@repo/api/server'
import { Query } from '@repo/api'
import { Event, EventWithTranslations } from '@/lib/types/event'
import { ContentTranslation } from '@/lib/types/content-translation'
import { revalidatePath } from 'next/cache'
import { Campus } from '@/lib/types/campus'

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

// Helper function to get translation for a specific locale
function getEventTranslation(translations: any[], locale: 'en' | 'no'): any | null {
  return translations.find(t => t.locale === locale) || null
}

// Helper function to combine event with its translations
function combineEventWithTranslations(event: Event, locale: 'en' | 'no'): EventWithTranslations {
  const translation = getEventTranslation(event.translations || [], locale)
  const metadata = event.metadata ? JSON.parse(event.metadata) : {}
  
  return {
    ...event,
    title: translation?.title,
    description: translation?.description,
    ...metadata
  }
}

export async function listEvents(params: ListEventsParams = {}): Promise<EventWithTranslations[]> {
  const {
    limit = 25,
    status = 'published',
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

    if (status !== 'all') {
      queries.push(Query.equal('status', status))
    }

    if (campus && campus !== 'all') {
      queries.push(Query.equal('campus_id', campus))
    }

    // Get events with their translations using Appwrite's nested relationships
    const eventsResponse = await db.listRows('app', 'events', queries)
    const events = eventsResponse.rows as unknown as Event[]

    // Process events and apply locale filtering if needed
    let processedEvents = events.map(event => {
      if (locale) {
        return combineEventWithTranslations(event, locale)
      }
      return event as EventWithTranslations
    })

    // Apply search filter on translated content if needed
    if (search && locale) {
      processedEvents = processedEvents.filter(event => 
        event.title?.toLowerCase().includes(search.toLowerCase()) ||
        event.description?.toLowerCase().includes(search.toLowerCase())
      )
    }

    // Filter out events that don't have the requested locale translation
    if (locale) {
      processedEvents = processedEvents.filter(event => event.title) // Has translation for requested locale
    }

    return processedEvents
  } catch (error) {
    console.error('Error fetching events:', error)
    return []
  }
}

export async function getEvent(id: string, locale?: 'en' | 'no'): Promise<EventWithTranslations | null> {
  try {
    const { db } = await createAdminClient()
    
    // Get the main event record - Appwrite will automatically include translation_refs
    const event = await db.getRow('app', 'events', id) as Event
    
    return locale ? combineEventWithTranslations(event, locale) : event as EventWithTranslations
  } catch (error) {
    console.error('Error fetching event:', error)
    return null
  }
}

export async function createEvent(data: CreateEventData, skipRevalidation = false): Promise<Event | null> {
  try {
    const { db } = await createAdminClient()
    
    // Create main event record first
    const eventData = {
      slug: data.slug,
      status: data.status,
      campus_id: data.campus_id,
      metadata: data.metadata ? JSON.stringify(data.metadata) : undefined
    }
    
    const event = await db.createRow('app', 'events', 'unique()', eventData) as Event
    
    // Create translations with proper relationships
    const translationsArray = Object.entries(data.translations)
      .filter(([locale, translation]) => translation)
      .map(([locale, translation]) => ({
        content_type: 'event',
        content_id: event.$id,
        locale,
        title: translation!.title,
        description: translation!.description,
        event_ref: event.$id
      }))
    
    // Create all translations
    if (translationsArray.length > 0) {
      const translationPromises = translationsArray.map(translationData =>
        db.createRow('app', 'content_translations', 'unique()', translationData)
      )
      await Promise.all(translationPromises)
    }
    
    if (!skipRevalidation) {
      revalidatePath('/events')
      revalidatePath('/admin/events')
    }
    
    return event
  } catch (error) {
    console.error('Error creating event:', error)
    return null
  }
}

export async function updateEvent(id: string, data: Partial<CreateEventData>): Promise<Event | null> {
  try {
    const { db } = await createAdminClient()
    
    // Prepare update data
    const eventData: any = {}
    if (data.slug) eventData.slug = data.slug
    if (data.status) eventData.status = data.status
    if (data.campus_id) eventData.campus_id = data.campus_id
    if (data.metadata) eventData.metadata = JSON.stringify(data.metadata)
    
    // If translations are provided, prepare them for nested update
    if (data.translations) {
      const translationsArray = Object.entries(data.translations)
        .filter(([locale, translation]) => translation)
        .map(([locale, translation]) => ({
          content_type: 'event',
          locale,
          title: translation!.title,
          description: translation!.description
        }))
      
      if (translationsArray.length > 0) {
        eventData.translation_refs = translationsArray
      }
    }
    
    const event = await db.updateRow('app', 'events', id, eventData) as Event
    
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
    const { db } = await createAdminClient()
    
    // Delete translations first (though cascade should handle this)
    const translationsResponse = await db.listRows('app', 'content_translations', [
      Query.equal('content_type', 'event'),
      Query.equal('content_id', id)
    ])
    
    const deleteTranslationPromises = translationsResponse.rows.map(translation =>
      db.deleteRow('app', 'content_translations', translation.$id)
    )
    
    await Promise.all(deleteTranslationPromises)
    
    // Delete main event record
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
    const { db } = await createAdminClient()
    
    // Get existing translation
    const existingResponse = await db.listRows('app', 'content_translations', [
      Query.equal('content_type', 'event'),
      Query.equal('content_id', eventId),
      Query.equal('locale', fromLocale)
    ])
    
    if (existingResponse.rows.length === 0) {
      throw new Error('Source translation not found')
    }
    
    const sourceTranslation = existingResponse.rows[0] as unknown as ContentTranslation
    
    // Use your existing AI implementation to translate
    const { generateText } = await import('ai')
    const { openai } = await import('@ai-sdk/openai')
    
    const prompt = `Translate the following event content from ${fromLocale === 'en' ? 'English' : 'Norwegian'} to ${toLocale === 'en' ? 'English' : 'Norwegian'}. Maintain the HTML formatting and professional tone suitable for a student organization event.

Title: ${sourceTranslation.title}

Description: ${sourceTranslation.description}

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
  const { storage } = await createAdminClient()
  const file = formData.get('file') as unknown as File
  const uploaded = await storage.createFile('events', 'unique()', file)
  return uploaded
}

export async function getEventImageViewUrl(fileId: string) {
  const { storage } = await createAdminClient()
  const url = (storage as any).getFileView('events', fileId)
  return typeof url === 'string' ? url : url.href
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
    return response.rows as unknown as Campus[]
  } catch (error) {
    console.error('Error fetching campuses:', error)
    return []
  }
}


