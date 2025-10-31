'use server'

import { revalidatePath } from 'next/cache'
import { Query } from '@repo/api'
import { createAdminClient } from '@repo/api/server'
import type {
  Product,
  ProductWithTranslations,
  CreateProductData,
  UpdateProductData,
  ListProductsParams,
  ProductTranslation
} from '@/lib/types/product'
import type { ContentTranslation } from '@/lib/types/content-translation'
import { generateObject } from 'ai'
import { openai } from '@ai-sdk/openai'
import { z } from 'zod'

// Helper function to get translation for a specific locale
function getProductTranslation(product: Product, locale: 'en' | 'no'): ProductTranslation | null {
  if (!product.translation_refs) return null
  
  const translation = product.translation_refs.find((t: any) => t.locale === locale)
  if (!translation) return null
  
  return {
    title: translation.title,
    description: translation.description
  }
}

// Helper function to combine product with translations
function combineProductWithTranslations(product: Product, locale: 'en' | 'no'): ProductWithTranslations {
  const translation = getProductTranslation(product, locale)
  const metadata = product.metadata ? JSON.parse(product.metadata) : {}
  
  return {
    ...product,
    title: translation?.title,
    description: translation?.description,
    price: metadata.price,
    sku: metadata.sku,
    stock_quantity: metadata.stock_quantity,
    category: metadata.category,
    image: metadata.image,
    images: metadata.images,
    weight: metadata.weight,
    dimensions: metadata.dimensions,
    is_digital: metadata.is_digital,
    shipping_required: metadata.shipping_required,
    member_discount_enabled: metadata.member_discount_enabled,
    member_discount_percent: metadata.member_discount_percent,
    max_per_user: metadata.max_per_user,
    max_per_order: metadata.max_per_order,
    custom_fields: metadata.custom_fields,
    variations: metadata.variations
  }
}

export async function listProducts(params: ListProductsParams = {}): Promise<ProductWithTranslations[]> {
  try {
    const { db } = await createAdminClient()
    
    const queries = []
    
    if (params.status) {
      queries.push(Query.equal('status', params.status))
    }
    
    if (params.campus_id) {
      queries.push(Query.equal('campus_id', params.campus_id))
    }
    
    if (params.search) {
      queries.push(Query.search('slug', params.search))
    }
    
    queries.push(Query.orderDesc('$createdAt'))
    
    if (params.limit) {
      queries.push(Query.limit(params.limit))
    }
    
    if (params.offset) {
      queries.push(Query.offset(params.offset))
    }
    
    const response = await db.listRows('app', 'webshop_products', queries)
    const products = response.rows as unknown as Product[]
    
    const locale = params.locale ?? 'en'
    return products.map(product => combineProductWithTranslations(product, locale))
  } catch (error) {
    console.error('Error listing products:', error)
    return []
  }
}

export async function getProduct(id: string, locale?: 'en' | 'no'): Promise<ProductWithTranslations | null> {
  try {
    const { db } = await createAdminClient()
    
    const product = await db.getRow('app', 'webshop_products', id) as unknown as Product
    
    const resolvedLocale = locale ?? 'en'
    return combineProductWithTranslations(product, resolvedLocale)
  } catch (error) {
    console.error('Error getting product:', error)
    return null
  }
}

export async function getProductBySlug(slug: string, locale: 'en' | 'no'): Promise<ProductWithTranslations | null> {
  try {
    const { db } = await createAdminClient()
    
    const response = await db.listRows('app', 'webshop_products', [
      Query.equal('slug', slug),
      Query.limit(1)
    ])
    
    if (response.rows.length === 0) {
      return null
    }
    
    const product = response.rows[0] as unknown as Product
    return combineProductWithTranslations(product, locale)
  } catch (error) {
    console.error('Error getting product by slug:', error)
    return null
  }
}

export async function createProduct(data: CreateProductData, skipRevalidation = false): Promise<Product | null> {
  try {
    const { db } = await createAdminClient()
    
    // Create main product record first
    const productData = {
      slug: data.slug,
      status: data.status,
      campus_id: data.campus_id,
      metadata: data.metadata ? JSON.stringify(data.metadata) : undefined
    }
    
    const product = await db.createRow('app', 'webshop_products', 'unique()', productData) as unknown as Product
    
    // Now create translations with the product ID and relationship
    const translationsArray = Object.entries(data.translations)
      .filter(([locale, translation]) => translation) // Only include non-empty translations
      .map(([locale, translation]) => ({
        content_type: 'product',
        content_id: product.$id, // Set the content_id to the created product's ID
        locale,
        title: translation!.title,
        description: translation!.description,
        product_ref: product.$id // Set the relationship
      }))
    
    // Create all translations
    if (translationsArray.length > 0) {
      const translationPromises = translationsArray.map(translationData =>
        db.createRow('app', 'content_translations', 'unique()', translationData)
      )
      await Promise.all(translationPromises)
    }
    
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

export async function updateProduct(id: string, data: UpdateProductData, skipRevalidation = false): Promise<Product | null> {
  try {
    const { db } = await createAdminClient()
    
    // Update main product record
    const updateData: any = {}
    
    if (data.slug !== undefined) updateData.slug = data.slug
    if (data.status !== undefined) updateData.status = data.status
    if (data.campus_id !== undefined) updateData.campus_id = data.campus_id
    if (data.metadata !== undefined) updateData.metadata = JSON.stringify(data.metadata)
    
    const product = await db.updateRow('app', 'webshop_products', id, updateData) as unknown as Product
    
    // Handle translations if provided
    if (data.translations) {
      // Get existing translations
      const existingTranslations = await db.listRows('app', 'content_translations', [
        Query.equal('content_id', id),
        Query.equal('content_type', 'product')
      ])
      
      for (const [locale, translation] of Object.entries(data.translations)) {
        if (!translation) continue
        
        const existingTranslation = existingTranslations.rows.find(
          (t: any) => t.locale === locale
        )
        
        const translationData = {
          content_type: 'product',
          content_id: id,
          locale,
          title: translation.title,
          description: translation.description,
          product_ref: id
        }
        
        if (existingTranslation) {
          // Update existing translation
          await db.updateRow('app', 'content_translations', existingTranslation.$id, translationData)
        } else {
          // Create new translation
          await db.createRow('app', 'content_translations', 'unique()', translationData)
        }
      }
    }
    
    if (!skipRevalidation) {
      revalidatePath('/shop')
      revalidatePath('/admin/products')
    }
    
    return product
  } catch (error) {
    console.error('Error updating product:', error)
    return null
  }
}

export async function deleteProduct(id: string, skipRevalidation = false): Promise<boolean> {
  try {
    const { db } = await createAdminClient()
    
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

export async function updateProductStatus(
  id: string,
  status: Product['status'],
  skipRevalidation = false
): Promise<Product | null> {
  try {
    const { db } = await createAdminClient()

    const product = await db.updateRow('app', 'webshop_products', id, { status }) as unknown as Product

    if (!skipRevalidation) {
      revalidatePath('/shop')
      revalidatePath('/admin/products')
    }

    return product
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
export async function getProducts(status: 'in-stock' | 'all' = 'all', locale: 'en' | 'no' = 'en'): Promise<ProductWithTranslations[]> {
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

  const { storage } = await createAdminClient()
  const uploaded = await storage.createFile(PRODUCT_IMAGE_BUCKET, 'unique()', file)
  const view = (storage as any).getFileView(PRODUCT_IMAGE_BUCKET, uploaded.$id)
  const url = typeof view === 'string' ? view : view.href

  return {
    fileId: uploaded.$id,
    url
  }
}
