import { buildTranslationMap, ensureTranslationArray } from '@/lib/utils/content-translations'
import { parseJSONSafe } from '@/lib/utils/admin'
import type { AdminEvent, EventMetadata } from '@/lib/types/event'
import type { AdminJob, JobMetadata } from '@/lib/types/job'
import type { ProductMetadata, ProductWithTranslations } from '@/lib/types/product'
import type { NewsItemWithTranslations } from '@/lib/types/news'
import type { ContentTranslations, Events, Jobs, News, WebshopProducts } from '@repo/api/types/appwrite'

type WithTranslations<T> = T & { translation_refs?: ContentTranslations[] }

const FALLBACK_OBJECT = {} as Record<string, unknown>

const parseMetadata = <T extends Record<string, unknown> = Record<string, unknown>>(
  raw: unknown,
  fallback: T = FALLBACK_OBJECT as T
): T => {
  if (!raw) return fallback
  if (typeof raw === 'string') {
    return parseJSONSafe<T>(raw, fallback)
  }
  if (typeof raw === 'object') {
    return raw as T
  }
  return fallback
}

export const EVENT_SELECT_FIELDS = [
  '$id',
  '$createdAt',
  '$updatedAt',
  'slug',
  'status',
  'campus_id',
  'metadata',
  'start_date',
  'end_date',
  'location',
  'price',
  'ticket_url',
  'image',
  'member_only',
  'collection_id',
  'is_collection',
  'collection_pricing',
  'campus.$id',
  'campus.name',
  'translation_refs.$id',
  'translation_refs.content_id',
  'translation_refs.content_type',
  'translation_refs.locale',
  'translation_refs.title',
  'translation_refs.description',
  'translation_refs.additional_fields',
] as const

export const JOB_SELECT_FIELDS = [
  '$id',
  '$createdAt',
  '$updatedAt',
  'slug',
  'status',
  'campus_id',
  'department_id',
  'metadata',
  'translations',
  'translation_refs.$id',
  'translation_refs.content_id',
  'translation_refs.content_type',
  'translation_refs.locale',
  'translation_refs.title',
  'translation_refs.description',
  'translation_refs.short_description',
  'translation_refs.additional_fields',
  'campus.$id',
  'campus.name',
  'department.$id',
  'department.Name',
  'department.campus_id',
] as const

export const PRODUCT_SELECT_FIELDS = [
  '$id',
  '$createdAt',
  '$updatedAt',
  'slug',
  'status',
  'campus_id',
  'category',
  'regular_price',
  'member_price',
  'member_only',
  'image',
  'stock',
  'metadata',
  'translation_refs.$id',
  'translation_refs.content_id',
  'translation_refs.content_type',
  'translation_refs.locale',
  'translation_refs.title',
  'translation_refs.description',
  'translation_refs.short_description',
  'translation_refs.additional_fields',
  'campus.$id',
  'campus.name',
] as const

export const NEWS_SELECT_FIELDS = [
  '$id',
  '$createdAt',
  '$updatedAt',
  'status',
  'campus_id',
  'department_id',
  'slug',
  'url',
  'image',
  'sticky',
  'translation_refs.$id',
  'translation_refs.content_id',
  'translation_refs.content_type',
  'translation_refs.locale',
  'translation_refs.title',
  'translation_refs.description',
  'campus.$id',
  'campus.name',
  'department.$id',
  'department.Name',
  'department.campus_id',
] as const

export const normalizeEventRow = (row: WithTranslations<Events>): AdminEvent => {
  const translationRefs = ensureTranslationArray(row.translation_refs)
  const metadata = parseMetadata<EventMetadata>(row.metadata)

  return {
    ...row,
    translation_refs: translationRefs,
    translations: buildTranslationMap(translationRefs),
    metadata_parsed: metadata,
  }
}

export const normalizeJobRow = (row: WithTranslations<Jobs>): AdminJob => {
  const translationRefs = ensureTranslationArray(row.translation_refs)
  const metadata = parseMetadata<JobMetadata>(row.metadata)
  const metadataRecord =
    typeof row.metadata === 'string'
      ? parseJSONSafe<Record<string, unknown>>(row.metadata, {})
      : (row.metadata ?? null)

  return {
    ...row,
    metadata: metadataRecord ?? null,
    translation_refs: translationRefs,
    translations: buildTranslationMap(translationRefs),
    metadata_parsed: metadata,
  }
}

export const normalizeProductRow = (row: WithTranslations<WebshopProducts>): ProductWithTranslations => {
  const translationRefs = ensureTranslationArray(row.translation_refs)
  const metadata = parseMetadata<ProductMetadata>(row.metadata)
  const metadataString =
    typeof row.metadata === 'string' ? row.metadata : JSON.stringify(row.metadata ?? {})

  return {
    ...row,
    metadata: metadataString,
    translation_refs: translationRefs,
    translations: buildTranslationMap(translationRefs),
    metadata_parsed: metadata,
    price: typeof metadata.price === 'number' ? metadata.price : undefined,
    sku: typeof metadata.sku === 'string' ? metadata.sku : undefined,
    stock_quantity: typeof metadata.stock_quantity === 'number' ? metadata.stock_quantity : undefined,
    category: metadata.category ?? row.category,
    image: (metadata.image as string | undefined) ?? row.image ?? undefined,
    images: Array.isArray(metadata.images) ? metadata.images : undefined,
    weight: typeof metadata.weight === 'number' ? metadata.weight : undefined,
    dimensions: typeof metadata.dimensions === 'string' ? metadata.dimensions : undefined,
    is_digital: metadata.is_digital,
    shipping_required: metadata.shipping_required,
    member_discount_enabled: metadata.member_discount_enabled,
    member_discount_percent:
      typeof metadata.member_discount_percent === 'number'
        ? metadata.member_discount_percent
        : undefined,
    max_per_user: typeof metadata.max_per_user === 'number' ? metadata.max_per_user : undefined,
    max_per_order: typeof metadata.max_per_order === 'number' ? metadata.max_per_order : undefined,
    custom_fields: Array.isArray(metadata.custom_fields) ? metadata.custom_fields : undefined,
    variations: Array.isArray(metadata.variations) ? metadata.variations : undefined,
  } as ProductWithTranslations
}

export const normalizeNewsRow = (row: WithTranslations<News>): NewsItemWithTranslations => {
  const translationRefs = ensureTranslationArray(row.translation_refs)

  return {
    ...row,
    translation_refs: translationRefs,
    translations: buildTranslationMap(translationRefs),
  }
}

