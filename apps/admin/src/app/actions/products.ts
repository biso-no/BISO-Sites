'use server'

import { revalidatePath } from 'next/cache'
import { Query, getStorageFileUrl } from '@repo/api'
import { createSessionClient } from '@repo/api/server'
import type {
  CreateProductData,
  UpdateProductData,
  ListProductsParams,
  ProductTranslation,
  ProductWithTranslations
} from '@/lib/types/product'
import { generateObject } from 'ai'
import { openai } from '@ai-sdk/openai'
import { z } from 'zod'
import { ContentTranslations, ContentType, Locale, WebshopProducts, Status } from '@repo/api/types/appwrite'
import { PRODUCT_SELECT_FIELDS, normalizeProductRow } from './_utils/translatable'

export async function listProducts(params: ListProductsParams = {}): Promise<ProductWithTranslations[]> {
  try {
    const { db } = await createSessionClient()
    
    const queries = [
      Query.select([...PRODUCT_SELECT_FIELDS]),
      Query.orderDesc('$createdAt')
    ]
    
    if (params.status) {
      queries.push(Query.equal('status', params.status))
    }
    
    if (params.campus_id) {
      queries.push(Query.equal('campus_id', params.campus_id))
    }
    
    if (params.limit) {
      queries.push(Query.limit(params.limit))
    }
    
    if (params.offset) {
      queries.push(Query.offset(params.offset))
    }

    if (params.search?.trim()) {
      queries.push(Query.search('slug', params.search.trim()))
    }
    
    const response = await db.listRows<WebshopProducts>('app', 'webshop_products', queries)
    return response.rows.map(normalizeProductRow)
  } catch (error) {
    console.error('Error listing products:', error)
    return []
  }
}

export async function getProduct(id: string): Promise<ProductWithTranslations | null> {
  try {
    const { db } = await createSessionClient()

    const response = await db.listRows<WebshopProducts>('app', 'webshop_products', [
      Query.equal('$id', id),
      Query.limit(1),
      Query.select([...PRODUCT_SELECT_FIELDS])
    ])

    const product = response.rows[0]

    if (!product) {
      return null
    }

    return normalizeProductRow(product)
  } catch (error) {
    console.error('Error getting product:', error)
    return null
  }
}

async function getProductBySlug(slug: string): Promise<ProductWithTranslations | null> {
  try {
    const { db } = await createSessionClient()
    
    const productsResponse = await db.listRows<WebshopProducts>('app', 'webshop_products', [
      Query.equal('slug', slug),
      Query.limit(1),
      Query.select([...PRODUCT_SELECT_FIELDS])
    ])
    
    const product = productsResponse.rows[0]

    if (!product) return null

    return normalizeProductRow(product)
  } catch (error) {
    console.error('Error getting product by slug:', error)
    return null
  }
}

export async function createProduct(data: CreateProductData, skipRevalidation = false): Promise<WebshopProducts | null> {
  try {
    const { db } = await createSessionClient()
    const statusValue =
      data.status === 'draft'
        ? Status.DRAFT
        : data.status === 'published'
          ? Status.PUBLISHED
          : Status.ARCHIVED
    
    // Build translation_refs array with both required translations
    const translationRefs: ContentTranslations[] = [
      {
        content_type: ContentType.PRODUCT,
        content_id: 'unique()',
        locale: Locale.EN,
        title: data.translations.en.title,
        description: data.translations.en.description,
      } as ContentTranslations,
      {
        content_type: ContentType.PRODUCT,
        content_id: 'unique()',
        locale: Locale.NO,
        title: data.translations.no.title,
        description: data.translations.no.description,
      } as ContentTranslations,
    ]
    
    const product = await db.createRow<WebshopProducts>('app', 'webshop_products', 'unique()', {
      slug: data.slug,
      status: statusValue,
      campus_id: data.campus_id,
      // Top-level database fields (required by schema)
      category: data.category,
      regular_price: data.regular_price,
      member_price: data.member_price ?? null,
      member_only: data.member_only ?? false,
      stock: data.stock ?? null,
      image: data.image ?? null,
      // Additional metadata
      metadata: data.metadata ? JSON.stringify(data.metadata) : null,
      // Relationship fields
      campus: data.campus_id,
      departmentId: null,
      department: null,
      translation_refs: translationRefs
    } as any)
    
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

export async function updateProduct(id: string, data: UpdateProductData, skipRevalidation = false): Promise<WebshopProducts | null> {
  try {
    const { db } = await createSessionClient()
    
    // Build update object
    const updateData: Record<string, unknown> = {}
    
    if (data.slug !== undefined) updateData.slug = data.slug
    if (data.status !== undefined) {
      updateData.status =
        data.status === 'draft'
          ? Status.DRAFT
          : data.status === 'published'
            ? Status.PUBLISHED
            : Status.ARCHIVED
    }
    if (data.campus_id !== undefined) updateData.campus_id = data.campus_id
    
    // Top-level database fields
    if (data.category !== undefined) updateData.category = data.category
    if (data.regular_price !== undefined) updateData.regular_price = data.regular_price
    if (data.member_price !== undefined) updateData.member_price = data.member_price
    if (data.member_only !== undefined) updateData.member_only = data.member_only
    if (data.stock !== undefined) updateData.stock = data.stock
    if (data.image !== undefined) updateData.image = data.image
    
    // Metadata JSON
    if (data.metadata !== undefined) updateData.metadata = data.metadata ? JSON.stringify(data.metadata) : null
    
    // Build translation_refs array with both translations if provided
    // For updates, we need to fetch existing translation IDs to properly update them
    if (data.translations) {
      // Fetch existing translations to get their IDs
      const existingProduct = await db.listRows<WebshopProducts>('app', 'webshop_products', [
        Query.equal('$id', id),
        Query.select(['translation_refs.$id', 'translation_refs.locale']),
        Query.limit(1),
      ])
      
      const existingTranslations = existingProduct.rows[0]?.translation_refs || []
      const existingTranslationsArray = Array.isArray(existingTranslations) 
        ? existingTranslations.filter((t): t is ContentTranslations => typeof t !== 'string')
        : []
      
      const enTranslation = existingTranslationsArray.find(t => t.locale === Locale.EN)
      const noTranslation = existingTranslationsArray.find(t => t.locale === Locale.NO)
      
      updateData.translation_refs = [
        {
          ...(enTranslation?.$id ? { $id: enTranslation.$id } : {}),
          content_type: ContentType.PRODUCT,
          content_id: id,
          locale: Locale.EN,
          title: data.translations.en.title,
          description: data.translations.en.description,
        } as ContentTranslations,
        {
          ...(noTranslation?.$id ? { $id: noTranslation.$id } : {}),
          content_type: ContentType.PRODUCT,
          content_id: id,
          locale: Locale.NO,
          title: data.translations.no.title,
          description: data.translations.no.description,
        } as ContentTranslations,
      ]
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

export async function deleteProduct(id: string, skipRevalidation = false): Promise<boolean> {
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
  status: 'draft' | 'published' | 'archived',
  skipRevalidation = false
): Promise<WebshopProducts | null> {
  try {
    const { db } = await createSessionClient()
    const statusValue =
      status === 'draft'
        ? Status.DRAFT
        : status === 'published'
          ? Status.PUBLISHED
          : Status.ARCHIVED

    const product = await db.updateRow<WebshopProducts>('app', 'webshop_products', id, { status: statusValue })

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
export async function translateProductContent(
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
async function getProducts(status: 'in-stock' | 'all' = 'all', locale: 'en' | 'no' = 'en'): Promise<ProductWithTranslations[]> {
  return listProducts({
    status: 'published',
    locale,
    limit: 50
  })
}

const PRODUCT_IMAGE_BUCKET = process.env.APPWRITE_PRODUCT_BUCKET_ID || 'product-images'

export async function uploadProductImage(formData: FormData) {
  const file = formData.get('file')
  if (!file || !(file instanceof File)) {
    throw new Error('No file provided')
  }

  const { storage } = await createSessionClient()
  const uploaded = await storage.createFile(PRODUCT_IMAGE_BUCKET, 'unique()', file)
  const url = getStorageFileUrl(PRODUCT_IMAGE_BUCKET, uploaded.$id)
  return { id: uploaded.$id, url }
}
