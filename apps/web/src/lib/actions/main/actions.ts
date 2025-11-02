'use server'

import { createSessionClient } from "@repo/api/server"
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type Locale } from "@/i18n/config"
import { Models, Query } from "@repo/api"

type NavTranslationDocument = Models.Row & {
  nav_id: string
  locale: Locale
  title: string
}

type NavMenuDocument = Models.Row & {
  slug: string
  parent_id?: string | null
  path?: string | null
  url?: string | null
  order?: number | null
  is_external?: boolean | null
  translation_refs?: NavTranslationDocument[]
}

export interface NavTreeItem {
  id: string
  slug: string
  title: string
  href: string
  path?: string | null
  url?: string | null
  order?: number | null
  isExternal: boolean
  parentId?: string | null
  children: NavTreeItem[]
}

interface GetNavItemsResponse {
  locale: Locale
  items: NavTreeItem[]
}

const FALLBACK_LOCALE: Record<Locale, Locale> = {
  en: "no",
  no: "en",
}

const resolveLocale = (maybeLocale?: Locale): Locale => {
  if (maybeLocale && SUPPORTED_LOCALES.includes(maybeLocale)) {
    return maybeLocale
  }
  return DEFAULT_LOCALE
}

const sortTree = (items: NavTreeItem[], locale: Locale) => {
  items.sort((a, b) => {
    const orderDelta = (a.order ?? 0) - (b.order ?? 0)
    if (orderDelta !== 0) return orderDelta
    return a.title.localeCompare(b.title, locale)
  })

  items.forEach((item) => sortTree(item.children, locale))
}

export async function getNavItems(locale?: Locale): Promise<GetNavItemsResponse> {
  const { db } = await createSessionClient()
  const resolvedLocale = resolveLocale(locale)
  const fallbackLocale = FALLBACK_LOCALE[resolvedLocale] ?? DEFAULT_LOCALE

  const navResponse = await db.listRows<NavMenuDocument>("webapp", "nav_menu", [
    Query.limit(200),
    Query.orderAsc("order"),
    Query.orderAsc("slug"),
  ])

  const navItems = navResponse.rows

  const translationMap = new Map<string, Record<Locale, string>>()

  navItems.forEach((doc) => {
    const translations = Array.isArray(doc.translation_refs) ? doc.translation_refs : []
    const localizedEntries = translations.reduce((acc, translation) => {
      if (SUPPORTED_LOCALES.includes(translation.locale)) {
        acc[translation.locale] = translation.title
      }
      return acc
    }, {} as Record<Locale, string>)

    translationMap.set(doc.$id, localizedEntries)
  })

  const nodeMap = new Map<string, NavTreeItem>()

  navItems.forEach((doc) => {
    const localized = translationMap.get(doc.$id) || {} as Record<Locale, string>
    const title =
      localized[resolvedLocale] ??
      (fallbackLocale !== resolvedLocale ? localized[fallbackLocale] : undefined) ??
      doc.slug

    const isExternal = Boolean(doc.is_external) || Boolean(doc.url && !doc.path)
    const href = isExternal ? doc.url ?? "#" : doc.path ?? doc.url ?? "#"

    nodeMap.set(doc.$id, {
      id: doc.$id,
      slug: doc.slug,
      title,
      href,
      path: doc.path,
      url: doc.url,
      order: doc.order,
      parentId: doc.parent_id,
      isExternal,
      children: [],
    })
  })

  const roots: NavTreeItem[] = []

  navItems.forEach((doc) => {
    const node = nodeMap.get(doc.$id)
    if (!node) return

    if (doc.parent_id && nodeMap.has(doc.parent_id)) {
      nodeMap.get(doc.parent_id)!.children.push(node)
    } else {
      roots.push(node)
    }
  })

  sortTree(roots, resolvedLocale)

  return {
    locale: resolvedLocale,
    items: roots,
  }
}
