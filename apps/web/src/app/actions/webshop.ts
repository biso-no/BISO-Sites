'use server'

import { createAdminClient, createSessionClient } from '@repo/api/server'
import { Query } from '@repo/api'
import { ContentTranslations, ContentType, Locale, WebshopProducts, Status, Campus } from '@repo/api/types/appwrite'
import { revalidatePath } from 'next/cache'
import { notFound } from 'next/navigation'

export interface ListProductsParams {
  limit?: number
  status?: string
  campus?: string
  category?: string
  locale?: 'en' | 'no'
  memberOnly?: boolean
}

export interface CreateProductData {
  slug: string
  status: 'draft' | 'published' | 'closed'
  campus_id: string
  category: string
  regular_price: number
  member_price?: number
  member_only?: boolean
  image?: string
  stock?: number
  metadata?: {
    product_options?: Array<{
      type: 'select' | 'input'
      label: string
      required: boolean
      options?: string[]
      placeholder?: string
    }>
  }
  translations: {
    en?: {
      title: string
      description: string
      short_description?: string
    }
    no?: {
      title: string
      description: string
      short_description?: string
    }
  }
}

export async function listProducts(params: ListProductsParams = {}): Promise<ContentTranslations[]> {
  const {
    limit = 50,
    status = 'published',
    campus,
    category,
    locale,
    memberOnly
  } = params

  try {
    const { db } = await createSessionClient()
    
    const queries = [
      Query.equal('content_type', ContentType.PRODUCT),
      Query.select(['content_id', '$id', 'locale', 'title', 'description', 'short_description', 'product_ref.*']),
      Query.equal('locale', locale as Locale),
      Query.limit(limit),
      Query.orderDesc('$createdAt')
    ]

    if (status !== 'all') {
      queries.push(Query.equal('product_ref.status', status))
    }

    if (campus && campus !== 'all') {
      queries.push(Query.equal('product_ref.campus_id', campus))
    }

    if (category && category !== 'all') {
      queries.push(Query.equal('product_ref.category', category))
    }

    if (memberOnly !== undefined) {
      queries.push(Query.equal('product_ref.member_only', memberOnly))
    }

    const productsResponse = await db.listRows<ContentTranslations>('app', 'content_translations', queries)
    const products = productsResponse.rows

    return products
  } catch (error) {
    console.error('Error fetching products:', error)
    return []
  }
}

async function getProduct(id: string, locale: 'en' | 'no'): Promise<ContentTranslations | null> {
  try {
    const { db } = await createAdminClient()
    
    const translationsResponse = await db.listRows<ContentTranslations>('app', 'content_translations', [
      Query.equal('content_type', ContentType.PRODUCT),
      Query.equal('content_id', id),
      Query.equal('locale', locale),
      Query.select(['content_id', '$id', 'locale', 'title', 'description', 'short_description', 'product_ref.*']),
      Query.limit(1)
    ])
    
    if (translationsResponse.rows.length === 0) {
      return null
    }
    
    return translationsResponse.rows[0] ?? null
  } catch (error) {
    console.error('Error fetching product:', error)
    return null
  }
}

export async function getProductBySlug(slug: string, locale: 'en' | 'no'): Promise<ContentTranslations | null> {
  try {
    const { db } = await createSessionClient()
    
    const translationsResponse = await db.listRows<ContentTranslations>('app', 'content_translations', [
      Query.equal('content_type', ContentType.PRODUCT),
      Query.equal('locale', locale as Locale),
      Query.equal('product_ref.slug', slug),
      Query.select(['content_id', '$id', 'locale', 'title', 'description', 'short_description', 'product_ref.*']),
      Query.limit(1)
    ])
    
    if (translationsResponse.rows.length === 0) {
      return null
    }
    
    return translationsResponse.rows[0] ?? null
  } catch (error) {
    console.error('Error fetching product by slug:', error)
    return null
  }}

async function createProduct(data: CreateProductData, skipRevalidation = false): Promise<WebshopProducts | null> {
  try {
    const { db } = await createAdminClient()
    
    const translationRefs: ContentTranslations[] = []
    
    if (data.translations.en) {
      translationRefs.push({
        content_type: ContentType.PRODUCT,
        content_id: 'unique()',
        locale: Locale.EN,
        title: data.translations.en.title,
        description: data.translations.en.description,
        short_description: data.translations.en.short_description || null,
      } as ContentTranslations)
    }
    
    if (data.translations.no) {
      translationRefs.push({
        content_type: ContentType.PRODUCT,
        content_id: 'unique()',
        locale: Locale.NO,
        title: data.translations.no.title,
        description: data.translations.no.description,
        short_description: data.translations.no.short_description || null,
      } as ContentTranslations)
    }
    
    const product = await db.createRow<WebshopProducts>('app', 'webshop_products', 'unique()', {
      slug: data.slug,
      status: data.status === 'draft' ? Status.DRAFT : data.status === 'published' ? Status.PUBLISHED : Status.CLOSED,
      campus_id: data.campus_id,
      category: data.category,
      regular_price: data.regular_price,
      member_price: data.member_price ?? null,
      member_only: data.member_only ?? false,
      image: data.image ?? null,
      stock: data.stock ?? null,
      metadata: data.metadata ? JSON.stringify(data.metadata) : null,
      departmentId: null,
      translation_refs: translationRefs
    } as any) ?? null
    
    if (!skipRevalidation) {
      revalidatePath('/shop')
      revalidatePath('/admin/shop')
    }
    
    return product
  } catch (error) {
    console.error('Error creating product:', error)
    return null
  }
}

async function updateProduct(id: string, data: Partial<CreateProductData>): Promise<WebshopProducts | null> {
  try {
    const { db } = await createAdminClient()
    
    const updateData: Record<string, unknown> = {}
    
    if (data.slug !== undefined) updateData.slug = data.slug
    if (data.status !== undefined) {
      updateData.status = data.status === 'draft' ? Status.DRAFT : data.status === 'published' ? Status.PUBLISHED : Status.CLOSED
    }
    if (data.campus_id !== undefined) updateData.campus_id = data.campus_id
    if (data.category !== undefined) updateData.category = data.category
    if (data.regular_price !== undefined) updateData.regular_price = data.regular_price
    if (data.member_price !== undefined) updateData.member_price = data.member_price
    if (data.member_only !== undefined) updateData.member_only = data.member_only
    if (data.image !== undefined) updateData.image = data.image
    if (data.stock !== undefined) updateData.stock = data.stock
    if (data.metadata !== undefined) updateData.metadata = data.metadata ? JSON.stringify(data.metadata) : null
    
    if (data.translations) {
      const translationRefs: ContentTranslations[] = []
      
      if (data.translations.en) {
        translationRefs.push({
          content_type: ContentType.PRODUCT,
          content_id: id,
          locale: Locale.EN,
          title: data.translations.en.title,
          description: data.translations.en.description,
          short_description: data.translations.en.short_description || null,
        } as ContentTranslations)
      }
      
      if (data.translations.no) {
        translationRefs.push({
          content_type: ContentType.PRODUCT,
          content_id: id,
          locale: Locale.NO,
          title: data.translations.no.title,
          description: data.translations.no.description,
          short_description: data.translations.no.short_description || null,
        } as ContentTranslations)
      }
      
      if (translationRefs.length > 0) {
        updateData.translation_refs = translationRefs
      }
    }
    
    const product = await db.updateRow('app', 'webshop_products', id, updateData) as WebshopProducts
    
    revalidatePath('/shop')
    revalidatePath('/admin/shop')
    
    return product
  } catch (error) {
    console.error('Error updating product:', error)
    return null
  }
}

async function deleteProduct(id: string): Promise<boolean> {
  try {
    const { db } = await createAdminClient()
    
    const translationsResponse = await db.listRows('app', 'content_translations', [
      Query.equal('content_type', ContentType.PRODUCT),
      Query.equal('content_id', id)
    ])
    
    const deleteTranslationPromises = translationsResponse.rows.map(translation =>
      db.deleteRow('app', 'content_translations', translation.$id)
    )
    
    await Promise.all(deleteTranslationPromises)
    
    await db.deleteRow('app', 'webshop_products', id)
    
    revalidatePath('/shop')
    revalidatePath('/admin/shop')
    
    return true
  } catch (error) {
    console.error('Error deleting product:', error)
    return false
  }
}

