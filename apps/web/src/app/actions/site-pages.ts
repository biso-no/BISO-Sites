"use server"

import { createAdminClient } from '@repo/api/server'
import { Query } from '@repo/api'
import type { ContentTranslation } from '@/lib/types/content-translation'

export type SitePageSlug = 'privacy' | 'cookies' | 'terms'

export async function getSitePageBySlug(slug: SitePageSlug) {
  const { db } = await createAdminClient()
  const res = await db.listRows('app', 'site_pages', [
    Query.equal('slug', slug),
    Query.limit(1)
  ])
  return res.rows[0] || null
}

export async function getSitePageTranslation(slug: SitePageSlug, locale: 'en' | 'no') {
  const { db } = await createAdminClient()
  const page = await getSitePageBySlug(slug)
  if (!page) return null

  // Prefer relationship attribute if available
  const tr = await db.listRows('app', 'content_translations', [
    Query.equal('site_page_ref', page.$id),
    Query.equal('locale', locale),
    Query.limit(1)
  ])
  
  // Fallback to legacy fields if relation not yet indexed
  if (tr.rows.length === 0) {
    const fallback = await db.listRows('app', 'content_translations', [
      Query.equal('content_type', 'site_page'),
      Query.equal('content_id', page.$id),
      Query.equal('locale', locale),
      Query.limit(1)
    ])
    if (fallback.rows.length === 0) return null
    const doc = fallback.rows[0] as ContentTranslation
    return { title: doc.title as string | undefined, body: (doc.description as string | undefined) || '' }
  }
  const doc = tr.rows[0] as ContentTranslation | undefined
  if (!doc) return null
  return { title: doc.title as string | undefined, body: (doc.description as string | undefined) || '' }
}

export async function upsertSitePage(data: {
  slug: SitePageSlug
  status?: 'draft' | 'published'
  translations?: Partial<Record<'en' | 'no', { title?: string; body?: string }>>
}) {
  const { db } = await createAdminClient()
  // Ensure page exists
  const existing = await getSitePageBySlug(data.slug)
  const page = existing
    ? await db.updateDocument('app', 'site_pages', existing.$id, { status: data.status || existing.status })
    : await db.createDocument('app', 'site_pages', 'unique()', { slug: data.slug, status: data.status || 'published' })

  // Upsert translations
  if (data.translations) {
    for (const locale of Object.keys(data.translations) as Array<'en' | 'no'>) {
      const t = data.translations[locale]
      if (!t) continue
      const found = await db.listRows('app', 'content_translations', [
        Query.equal('content_type', 'site_page'),
        Query.equal('content_id', page.$id),
        Query.equal('locale', locale),
        Query.limit(1)
      ])
      if (found.rows.length > 0) {
        await db.updateDocument('app', 'content_translations', found.rows[0].$id, {
          title: t.title ?? found.rows[0].title,
          description: t.body ?? found.rows[0].description
        })
      } else {
        await db.createDocument('app', 'content_translations', 'unique()', {
          content_type: 'site_page',
          content_id: page.$id,
          locale,
          title: t.title ?? data.slug,
          description: t.body ?? '',
          site_page_ref: page.$id
        })
      }
    }
  }

  return page
}

export async function translateSitePageContent(
  slug: SitePageSlug,
  fromLocale: 'en' | 'no',
  toLocale: 'en' | 'no'
): Promise<ContentTranslation | null> {
  try {
    const { db } = await createAdminClient()
    const page = await getSitePageBySlug(slug)
    if (!page) throw new Error('Page not found')

    const sourceRes = await db.listRows('app', 'content_translations', [
      Query.equal('content_type', 'site_page'),
      Query.equal('content_id', page.$id),
      Query.equal('locale', fromLocale),
      Query.limit(1)
    ])
    if (sourceRes.rows.length === 0) throw new Error('Source translation not found')
    const source = sourceRes.rows[0] as ContentTranslation

    const { generateObject } = await import('ai')
    const { openai } = await import('@ai-sdk/openai')
    const { z } = await import('zod')

    const targetLanguage = toLocale === 'en' ? 'English' : 'Norwegian'
    const sourceLanguage = fromLocale === 'en' ? 'English' : 'Norwegian'

    const result = await generateObject({
      model: openai('gpt-4o'),
      schema: z.object({ title: z.string(), body: z.string() }),
      prompt: `Translate the following policy page content from ${sourceLanguage} to ${targetLanguage}. Keep headings and paragraphs clear and suitable for a student union.\n\nTitle: ${source.title}\n\nBody:\n${source.description}`
    })

    // Upsert target translation
    const targetRes = await db.listRows('app', 'content_translations', [
      Query.equal('content_type', 'site_page'),
      Query.equal('content_id', page.$id),
      Query.equal('locale', toLocale),
      Query.limit(1)
    ])

    if (targetRes.rows.length > 0) {
      const updated = await db.updateDocument('app', 'content_translations', targetRes.rows[0].$id, {
        title: result.object.title,
        description: result.object.body
      })
      return updated as ContentTranslation
    } else {
      const created = await db.createDocument('app', 'content_translations', 'unique()', {
        content_type: 'site_page',
        content_id: page.$id,
        locale: toLocale,
        title: result.object.title,
        description: result.object.body,
        site_page_ref: page.$id
      })
      return created as ContentTranslation
    }
  } catch (error) {
    console.error('Error translating site page:', error)
    return null
  }
}
