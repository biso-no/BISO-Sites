'use server'

import { createSessionClient } from '@repo/api/server'
import { ID, Query } from '@repo/api'
import { revalidatePath } from 'next/cache'
import type { SitePages, ContentTranslations, Locale } from '@repo/api/types/appwrite'

interface SitePageTranslation {
  title: string
  body: string
}

interface UpsertSitePageInput {
  slug: string
  status: string
  translations: {
    [key in Locale]?: SitePageTranslation
  }
}

export async function getSitePageTranslation(
  slug: string, 
  locale: Locale
): Promise<SitePageTranslation | null> {
  try {
    const { db } = await createSessionClient()
    
    // First, get the site page
    const sitePageResponse = await db.listRows<SitePages>('app', 'site_pages', [
      Query.equal('slug', slug),
      Query.limit(1)
    ])
    
    if (sitePageResponse.rows.length === 0) {
      return null
    }
    
    const sitePage = sitePageResponse.rows[0]
    
    // Get the translation
    const translationResponse = await db.listRows<ContentTranslations>('app', 'content_translations', [
      Query.equal('content_id', sitePage.$id),
      Query.equal('locale', locale),
      Query.limit(1)
    ])
    
    if (translationResponse.rows.length === 0) {
      return null
    }
    
    const translation = translationResponse.rows[0]
    
    return {
      title: translation.title,
      body: translation.description
    }
  } catch (error) {
    console.error('Error getting site page translation:', error)
    return null
  }
}

export async function upsertSitePage(input: UpsertSitePageInput): Promise<boolean> {
  try {
    const { db } = await createSessionClient()
    
    // Check if site page exists
    const existingResponse = await db.listRows<SitePages>('app', 'site_pages', [
      Query.equal('slug', input.slug),
      Query.limit(1)
    ])
    
    let sitePageId: string
    
    if (existingResponse.rows.length > 0) {
      // Update existing
      const existing = existingResponse.rows[0]
      sitePageId = existing.$id
      await db.updateRow('app', 'site_pages', sitePageId, {
        status: input.status
      })
    } else {
      // Create new
      sitePageId = ID.unique()
      await db.createRow('app', 'site_pages', sitePageId, {
        slug: input.slug,
        status: input.status
      })
    }
    
    // Upsert translations
    for (const [locale, translation] of Object.entries(input.translations)) {
      if (!translation) continue
      
      const existingTranslationResponse = await db.listRows<ContentTranslations>('app', 'content_translations', [
        Query.equal('content_id', sitePageId),
        Query.equal('locale', locale),
        Query.limit(1)
      ])
      
      if (existingTranslationResponse.rows.length > 0) {
        // Update existing translation
        await db.updateRow('app', 'content_translations', existingTranslationResponse.rows[0].$id, {
          title: translation.title,
          description: translation.body
        })
      } else {
        // Create new translation
        await db.createRow('app', 'content_translations', ID.unique(), {
          content_id: sitePageId,
          locale: locale,
          title: translation.title,
          description: translation.body,
          content_type: 'site_page' as any
        })
      }
    }
    
    revalidatePath('/admin/settings')
    revalidatePath(`/${input.slug}`)
    return true
  } catch (error) {
    console.error('Error upserting site page:', error)
    return false
  }
}

export async function translateSitePageContent(
  slug: string,
  fromLocale: Locale,
  toLocale: Locale
): Promise<boolean> {
  try {
    const { db } = await createSessionClient()
    
    // Get the site page
    const sitePageResponse = await db.listRows<SitePages>('app', 'site_pages', [
      Query.equal('slug', slug),
      Query.limit(1)
    ])
    
    if (sitePageResponse.rows.length === 0) {
      return false
    }
    
    const sitePage = sitePageResponse.rows[0]
    
    // Get source translation
    const sourceResponse = await db.listRows<ContentTranslations>('app', 'content_translations', [
      Query.equal('content_id', sitePage.$id),
      Query.equal('locale', fromLocale),
      Query.limit(1)
    ])
    
    if (sourceResponse.rows.length === 0) {
      return false
    }
    
    const sourceTranslation = sourceResponse.rows[0]
    
    // Use AI to translate
    const { generateText } = await import('ai')
    const { openai } = await import('@ai-sdk/openai')
    
    const prompt = `Translate the following content from ${fromLocale === 'en' ? 'English' : 'Norwegian'} to ${toLocale === 'en' ? 'English' : 'Norwegian'}. Maintain the HTML formatting and professional tone suitable for a legal/policy page.

Title: ${sourceTranslation.title}

Body: ${sourceTranslation.description}

Please respond with a JSON object containing the translated title and body:
{
  "title": "translated title",
  "body": "translated body"
}`

    const result = await generateText({
      model: openai('gpt-4o'),
      prompt
    })
    
    const translated = JSON.parse(result.text)
    
    // Check if target translation exists
    const targetResponse = await db.listRows<ContentTranslations>('app', 'content_translations', [
      Query.equal('content_id', sitePage.$id),
      Query.equal('locale', toLocale),
      Query.limit(1)
    ])
    
    if (targetResponse.rows.length > 0) {
      // Update existing
      await db.updateRow('app', 'content_translations', targetResponse.rows[0].$id, {
        title: translated.title,
        description: translated.body
      })
    } else {
      // Create new
      await db.createRow('app', 'content_translations', ID.unique(), {
        content_id: sitePage.$id,
        locale: toLocale,
        title: translated.title,
        description: translated.body,
        content_type: 'site_page' as any
      })
    }
    
    revalidatePath('/admin/settings')
    revalidatePath(`/${slug}`)
    return true
  } catch (error) {
    console.error('Error translating site page content:', error)
    return false
  }
}

