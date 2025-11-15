'use server'

import { revalidatePath } from 'next/cache'
import { Query } from '@repo/api'
import { createSessionClient } from '@repo/api/server'
import type {
  Product,
  CreateProductData,
  UpdateProductData,
  ListProductsParams,
  ProductTranslation
} from '@/lib/types/product'
import { generateObject } from 'ai'
import { openai } from '@ai-sdk/openai'
import { z } from 'zod'
import { ContentTranslations, ContentType, Locale, WebshopProducts } from '@repo/api/types/appwrite'

export async function listProducts(params: ListProductsParams = {}): Promise<ContentTranslations[]> {
  try {
    const { db } = await createSessionClient()
    
    const queries = [
      Query.equal('content_type', ContentType.PRODUCT),
      Query.select(['content_id', '$id', 'locale', 'title', 'description', 'product_ref.*']),
      Query.equal('locale', params.locale as Locale ?? Locale.EN),
      Query.orderDesc('$createdAt')
    ]
    
    if (params.status) {
      queries.push(Query.equal('product_ref.status', params.status))
    }
    
    if (params.campus_id) {
      queries.push(Query.equal('product_ref.campus_id', params.campus_id))
    }
    
    if (params.limit) {
      queries.push(Query.limit(params.limit))
    }
    
    if (params.offset) {
      queries.push(Query.offset(params.offset))
    }
    
    const response = await db.listRows<ContentTranslations>('app', 'content_translations', queries)
    const products = response.rows
    
    return products
  } catch (error) {
    console.error('Error listing products:', error)
    return []
  }
}

export async function getProduct(id: string, locale: 'en' | 'no'): Promise<ContentTranslations | null> {
  try {
    const { db } = await createSessionClient()
    
    // Query content_translations by content_id and locale
    const translationsResponse = await db.listRows<ContentTranslations>('app', 'content_translations', [
      Query.equal('content_type', ContentType.PRODUCT),
      Query.equal('content_id', id),
      Query.equal('locale', locale),
      Query.select(['content_id', '$id', 'locale', 'title', 'description', 'product_ref.*']),
      Query.limit(1)
    ])
    
    if (translationsResponse.rows.length === 0) {
      return null
    }
    
    return translationsResponse.rows[0] ?? null
  } catch (error) {
    console.error('Error getting product:', error)
    return null
  }
}

async function getProductBySlug(slug: string, locale: 'en' | 'no'): Promise<ContentTranslations | null> {
  try {
    const { db } = await createSessionClient()
    
    // Get product by slug
    const productsResponse = await db.listRows<WebshopProducts>('app', 'webshop_products', [
      Query.equal('slug', slug),
      Query.limit(1)
    ])
    
    if (productsResponse.rows.length === 0) return null
    
    const product = productsResponse.rows[0]

    if (!product) return null
    
    // Get translation for the requested locale
    const translationsResponse = await db.listRows<ContentTranslations>('app', 'content_translations', [
      Query.equal('content_type', ContentType.PRODUCT),
      Query.equal('content_id', product.$id),
      Query.equal('locale', locale),
      Query.select(['content_id', '$id', 'locale', 'title', 'description', 'product_ref.*']),
      Query.limit(1)
    ])
    
    if (translationsResponse.rows.length === 0) return null
    
    return translationsResponse.rows[0] ?? null
  } catch (error) {
    console.error('Error getting product by slug:', error)
    return null
  }
}

async function createProduct(data: CreateProductData, skipRevalidation = false): Promise<Product | null> {
  try {
    const { db } = await createSessionClient()
    
    // Build translation_refs array from provided translations only
    const translationRefs: ContentTranslations[] = []
    
    if (data.translations.en) {
      translationRefs.push({
        content_type: ContentType.PRODUCT,
        content_id: 'unique()',
        locale: Locale.EN,
        title: data.translations.en.title,
        description: data.translations.en.description,
      } as ContentTranslations)
    }
    
    if (data.translations.no) {
      translationRefs.push({
        content_type: ContentType.PRODUCT,
        content_id: 'unique()',
        locale: Locale.NO,
        title: data.translations.no.title,
        description: data.translations.no.description,
      } as ContentTranslations)
    }
    
    const product = await db.createRow<WebshopProducts>('app', 'webshop_products', 'unique()', {
      slug: data.slug,
      status: data.status,
      campus_id: data.campus_id,
      metadata: data.metadata ? JSON.stringify(data.metadata) : null,
      translation_refs: translationRefs
    })
    
    if (!skipRevalidation) {
      revalidatePath('/shop')
      revalidatePath('/admin/products')
    }
    
    
    return product
  } catch (error) {
    console.error('Error creating product:', error)
    return null
  }
}

async function updateProduct(id: string, data: UpdateProductData, skipRevalidation = false): Promise<Product | null> {
  try {
    const { db } = await createSessionClient()
    
    // Build update object
    const updateData: Record<string, unknown> = {}
    
    if (data.slug !== undefined) updateData.slug = data.slug
    if (data.status !== undefined) updateData.status = data.status
    if (data.campus_id !== undefined) updateData.campus_id = data.campus_id
    if (data.metadata !== undefined) updateData.metadata = JSON.stringify(data.metadata)
    
    // Build translation_refs array from provided translations only
    if (data.translations) {
      const translationRefs: ContentTranslations[] = []
      
      if (data.translations.en) {
        translationRefs.push({
          content_type: ContentType.PRODUCT,
          content_id: id,
          locale: Locale.EN,
          title: data.translations.en.title,
          description: data.translations.en.description,
        } as ContentTranslations)
      }
      
      if (data.translations.no) {
        translationRefs.push({
          content_type: ContentType.PRODUCT,
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
    
    const product = await db.updateRow<WebshopProducts>('app', 'webshop_products', id, updateData)
    
    if (!skipRevalidation) {
      revalidatePath('/shop')
      revalidatePath('/admin/products')
    }
    
    return product ?? null
  } catch (error) {
    console.error('Error updating product:', error)
    return null
  }
}

async function deleteProduct(id: string, skipRevalidation = false): Promise<boolean> {
  try {
    const { db } = await createSessionClient()
    
    // Delete the product (translations will be deleted automatically due to cascade)
    await db.deleteRow('app', 'webshop_products', id)
    
    if (!skipRevalidation) {
      revalidatePath('/shop')
      revalidatePath('/admin/products')
    }
    
    return true
  } catch (error) {
    console.error('Error deleting product:', error)
    return false
  }
}

async function updateProductStatus(
  id: string,
  status: Product['status'],
  skipRevalidation = false
): Promise<Product | null> {
  try {
    const { db } = await createSessionClient()

    const product = await db.updateRow<WebshopProducts>('app', 'webshop_products', id, { status })

    if (!skipRevalidation) {
      revalidatePath('/shop')
      revalidatePath('/admin/products')
    }

    return product ?? null
  } catch (error) {
    console.error('Error updating product status:', error)
    return null
  }
}

// AI Translation function
async function translateProductContent(
  content: ProductTranslation,
  fromLocale: 'en' | 'no',
  toLocale: 'en' | 'no'
): Promise<ProductTranslation | null> {
  try {
    const targetLanguage = toLocale === 'en' ? 'English' : 'Norwegian'
    const sourceLanguage = fromLocale === 'en' ? 'English' : 'Norwegian'
    
    const result = await generateObject({
      model: openai('gpt-4o'),
      schema: z.object({
        title: z.string(),
        description: z.string()
      }),
      prompt: `Translate the following product content from ${sourceLanguage} to ${targetLanguage}. 
      Maintain the same tone and marketing appeal. For product descriptions, keep technical specifications 
      and measurements in their original format but translate the descriptive text.
      
      Title: ${content.title}
      Description: ${content.description}
      
      Provide the translation in ${targetLanguage}.`
    })
    
    return {
      title: result.object.title,
      description: result.object.description
    }
  } catch (error) {
    console.error('Error translating product content:', error)
    return null
  }
}

// Get products for public pages (published only)
async function getProducts(status: 'in-stock' | 'all' = 'all', locale: 'en' | 'no' = 'en'): Promise<ContentTranslations[]> {
  return listProducts({
    status: 'published',
    locale,
    limit: 50
  })
}

const PRODUCT_IMAGE_BUCKET = process.env.APPWRITE_PRODUCT_BUCKET_ID || 'product-images'

async function uploadProductImage(formData: FormData) {
  const file = formData.get('file')
  if (!file || !(file instanceof File)) {
    throw new Error('No file provided')
  }

  const { storage } = await createSessionClient()
  const uploaded = await storage.createFile(PRODUCT_IMAGE_BUCKET, 'unique()', file)
  const view = storage.getFile(PRODUCT_IMAGE_BUCKET, uploaded.$id)
  const url = view.href
}
