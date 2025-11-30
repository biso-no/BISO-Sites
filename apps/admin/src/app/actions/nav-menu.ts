"use server";

import { ID, type Models, Query } from "@repo/api";
import { createSessionClient } from "@repo/api/server";
import { revalidatePath } from "next/cache";
import { DEFAULT_LOCALE, type Locale, SUPPORTED_LOCALES } from "@/i18n/config";

const DATABASE_ID = "webapp";
const NAV_COLLECTION = "nav_menu";
const NAV_TRANSLATIONS_COLLECTION = "nav_menu_translations";

type AdminDbClient = Awaited<ReturnType<typeof createSessionClient>>["db"];

type NavMenuDocument = Models.Row & {
  slug: string;
  parent_id?: string | null;
  path?: string | null;
  url?: string | null;
  order?: number | null;
  is_external?: boolean | null;
};

type NavMenuTranslationDocument = Models.Row & {
  nav_id: string;
  locale: Locale;
  title: string;
};

export type NavMenuAdminItem = {
  id: string;
  slug: string;
  order: number;
  parentId: string | null;
  path: string | null;
  url: string | null;
  isExternal: boolean;
  translations: Record<Locale, string>;
  children: NavMenuAdminItem[];
};

export type NavMenuAdminTree = {
  tree: NavMenuAdminItem[];
  flat: NavMenuAdminItem[];
};

export type NavMenuStructureItem = {
  id: string;
  parentId: string | null;
  order: number;
};

type MutationResponse = {
  success: boolean;
  error?: string;
};

const normalizeOrderValue = (value: number | null | undefined): number => {
  if (typeof value === "number" && !Number.isNaN(value)) {
    return value;
  }
  return Number.MAX_SAFE_INTEGER;
};

const buildTranslationMap = (
  translations: NavMenuTranslationDocument[]
): Map<string, Record<Locale, string>> => {
  const map = new Map<string, Record<Locale, string>>();

  for (const translation of translations) {
    if (!SUPPORTED_LOCALES.includes(translation.locale)) {
      continue;
    }

    if (!map.has(translation.nav_id)) {
      map.set(translation.nav_id, {} as Record<Locale, string>);
    }

    const group = map.get(translation.nav_id);
    if (group) {
      group[translation.locale] = translation.title;
    }
  }

  return map;
};

const sortAndAttachChildren = (items: NavMenuAdminItem[], locale: Locale) => {
  items.sort((a, b) => {
    const orderDelta =
      normalizeOrderValue(a.order) - normalizeOrderValue(b.order);
    if (orderDelta !== 0) {
      return orderDelta;
    }
    return a.slug.localeCompare(b.slug, locale);
  });

  for (const item of items) {
    sortAndAttachChildren(item.children, locale);
  }
};

const normalizeTranslations = (
  translationEntry: Record<Locale, string> | undefined
) => {
  const normalized = { ...(translationEntry ?? {}) } as Record<Locale, string>;
  for (const supportedLocale of SUPPORTED_LOCALES) {
    if (!normalized[supportedLocale]) {
      normalized[supportedLocale] = "";
    }
  }
  return normalized;
};

const createNavNode = (
  doc: NavMenuDocument,
  translationMap: Map<string, Record<Locale, string>>
): NavMenuAdminItem => {
  const translationEntry = translationMap.get(doc.$id);
  const translations = normalizeTranslations(translationEntry);

  return {
    id: doc.$id,
    slug: doc.slug,
    parentId: doc.parent_id ?? null,
    order: normalizeOrderValue(doc.order),
    path: doc.path ?? null,
    url: doc.url ?? null,
    isExternal: Boolean(doc.is_external) || Boolean(doc.url && !doc.path),
    translations,
    children: [],
  };
};

const buildNodeMap = (
  documents: NavMenuDocument[],
  translationMap: Map<string, Record<Locale, string>>
) => {
  const nodeMap = new Map<string, NavMenuAdminItem>();

  for (const doc of documents) {
    nodeMap.set(doc.$id, createNavNode(doc, translationMap));
  }

  return nodeMap;
};

const attachParents = (nodeMap: Map<string, NavMenuAdminItem>) => {
  const roots: NavMenuAdminItem[] = [];

  for (const node of nodeMap.values()) {
    if (node.parentId && nodeMap.has(node.parentId)) {
      nodeMap.get(node.parentId)?.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
};

const flattenNavTree = (roots: NavMenuAdminItem[]) => {
  const flat: NavMenuAdminItem[] = [];
  const stack = [...roots];

  while (stack.length) {
    const current = stack.shift();
    if (current) {
      flat.push(current);
      stack.unshift(...current.children);
    }
  }

  return flat;
};

const buildNavTree = (
  documents: NavMenuDocument[],
  translations: NavMenuTranslationDocument[],
  locale: Locale
): NavMenuAdminTree => {
  const translationMap = buildTranslationMap(translations);
  const nodeMap = buildNodeMap(documents, translationMap);
  const roots = attachParents(nodeMap);

  sortAndAttachChildren(roots, locale);

  const flat = flattenNavTree(roots);

  return { tree: roots, flat };
};

const fetchNavData = async (dbClient?: AdminDbClient) => {
  const db = dbClient ?? (await createSessionClient()).db;

  const navDocumentsResponse = await db.listRows<NavMenuDocument>(
    DATABASE_ID,
    NAV_COLLECTION,
    [Query.limit(400)]
  );
  const translationResponse = await db.listRows<NavMenuTranslationDocument>(
    DATABASE_ID,
    NAV_TRANSLATIONS_COLLECTION,
    [Query.limit(800)]
  );

  return {
    db,
    documents: navDocumentsResponse.rows,
    translations: translationResponse.rows,
  };
};

const getSiblings = (documents: NavMenuDocument[], parentId: string | null) =>
  documents
    .filter((doc) => (doc.parent_id ?? null) === parentId)
    .sort(
      (a, b) => normalizeOrderValue(a.order) - normalizeOrderValue(b.order)
    );

const determineNextOrder = (
  documents: NavMenuDocument[],
  parentId: string | null
) => {
  const siblings = getSiblings(documents, parentId);
  if (!siblings.length) {
    return 1;
  }
  const lastSibling = siblings.at(-1);
  return normalizeOrderValue(lastSibling?.order ?? 0) + 1;
};

const upsertTranslation = async ({
  db,
  navId,
  locale,
  title,
}: {
  db: AdminDbClient;
  navId: string;
  locale: Locale;
  title: string;
}) => {
  const trimmedTitle = title.trim();
  const existing = await db.listRows<NavMenuTranslationDocument>(
    DATABASE_ID,
    NAV_TRANSLATIONS_COLLECTION,
    [
      Query.equal("nav_id", navId),
      Query.equal("locale", locale),
      Query.limit(1),
    ]
  );

  if (!trimmedTitle) {
    if (existing.rows.length) {
      await db.deleteRow(
        DATABASE_ID,
        NAV_TRANSLATIONS_COLLECTION,
        existing.rows[0]?.$id
      );
    }
    return;
  }

  if (existing.rows.length) {
    await db.updateRow(
      DATABASE_ID,
      NAV_TRANSLATIONS_COLLECTION,
      existing.rows[0]?.$id,
      {
        title: trimmedTitle,
      }
    );
  } else {
    await db.createRow(DATABASE_ID, NAV_TRANSLATIONS_COLLECTION, ID.unique(), {
      nav_id: navId,
      locale,
      title: trimmedTitle,
      nav_ref: navId,
    });
  }
};

const revalidateNavConsumers = () => {
  revalidatePath("/");
  revalidatePath("/admin/settings");
};

export const listNavMenuAdmin = async (): Promise<NavMenuAdminTree> => {
  const { documents, translations } = await fetchNavData();
  return buildNavTree(documents, translations, DEFAULT_LOCALE);
};

type CreateNavMenuInput = {
  slug: string;
  parentId?: string | null;
  path?: string | null;
  url?: string | null;
  isExternal?: boolean;
  translations: Record<Locale, string>;
};

export const createNavMenuItem = async (
  input: CreateNavMenuInput
): Promise<MutationResponse> => {
  try {
    const { db } = await createSessionClient();
    const trimmedSlug = input.slug.trim();
    if (!trimmedSlug) {
      return { success: false, error: "Slug is required" };
    }

    const existing = await db.listRows(DATABASE_ID, NAV_COLLECTION, [
      Query.equal("slug", trimmedSlug),
      Query.limit(1),
    ]);

    if (existing.rows.length) {
      return { success: false, error: "Slug already exists" };
    }

    const { documents } = await fetchNavData(db);
    const nextOrder = determineNextOrder(documents, input.parentId ?? null);

    const navDoc = await db.createRow(
      DATABASE_ID,
      NAV_COLLECTION,
      trimmedSlug,
      {
        slug: trimmedSlug,
        parent_id: input.parentId ?? null,
        path: input.path?.trim() || null,
        url: input.url?.trim() || null,
        is_external: Boolean(input.isExternal),
        order: nextOrder,
      }
    );

    await Promise.all(
      SUPPORTED_LOCALES.map((locale) =>
        upsertTranslation({
          db,
          navId: navDoc.$id,
          locale,
          title: input.translations?.[locale] ?? "",
        })
      )
    );

    revalidateNavConsumers();
    return { success: true };
  } catch (error) {
    console.error("Failed to create nav item", error);
    return { success: false, error: "Failed to create navigation item" };
  }
};

type UpdateNavMenuInput = {
  id: string;
  parentId?: string | null;
  path?: string | null;
  url?: string | null;
  isExternal?: boolean;
  translations: Record<Locale, string>;
};

export const updateNavMenuItem = async (
  input: UpdateNavMenuInput
): Promise<MutationResponse> => {
  try {
    const { db } = await createSessionClient();

    await db.updateRow(DATABASE_ID, NAV_COLLECTION, input.id, {
      parent_id: input.parentId ?? null,
      path: input.path?.trim() || null,
      url: input.url?.trim() || null,
      is_external: Boolean(input.isExternal),
    });

    await Promise.all(
      SUPPORTED_LOCALES.map((locale) =>
        upsertTranslation({
          db,
          navId: input.id,
          locale,
          title: input.translations?.[locale] ?? "",
        })
      )
    );

    revalidateNavConsumers();
    return { success: true };
  } catch (error) {
    console.error("Failed to update nav item", error);
    return { success: false, error: "Failed to update navigation item" };
  }
};

export const deleteNavMenuItem = async (
  navId: string
): Promise<MutationResponse> => {
  try {
    const { db } = await createSessionClient();
    const { documents } = await fetchNavData(db);

    const hasChildren = documents.some(
      (doc) => (doc.parent_id ?? null) === navId
    );
    if (hasChildren) {
      return {
        success: false,
        error: "Remove or reassign child links before deleting this item",
      };
    }

    const translationsResponse = await db.listRows<NavMenuTranslationDocument>(
      DATABASE_ID,
      NAV_TRANSLATIONS_COLLECTION,
      [Query.equal("nav_id", navId), Query.limit(20)]
    );

    await Promise.all(
      translationsResponse.rows.map((translation) =>
        db.deleteRow(DATABASE_ID, NAV_TRANSLATIONS_COLLECTION, translation.$id)
      )
    );

    await db.deleteRow(DATABASE_ID, NAV_COLLECTION, navId);

    revalidateNavConsumers();
    return { success: true };
  } catch (error) {
    console.error("Failed to delete nav item", error);
    return { success: false, error: "Failed to delete navigation item" };
  }
};

const _moveNavMenuItem = async (
  navId: string,
  direction: "up" | "down"
): Promise<MutationResponse> => {
  try {
    const { db } = await createSessionClient();
    const { documents } = await fetchNavData(db);
    const target = documents.find((doc) => doc.$id === navId);

    if (!target) {
      return { success: false, error: "Navigation item not found" };
    }

    const siblings = getSiblings(documents, target.parent_id ?? null);
    const currentIndex = siblings.findIndex((doc) => doc.$id === navId);
    if (currentIndex === -1) {
      return {
        success: false,
        error: "Navigation item not found among siblings",
      };
    }

    const delta = direction === "up" ? -1 : 1;
    const swapIndex = currentIndex + delta;
    if (swapIndex < 0 || swapIndex >= siblings.length) {
      return {
        success: false,
        error: "Cannot move item further in this direction",
      };
    }

    const updatedOrder = [...siblings];
    const [removed] = updatedOrder.splice(currentIndex, 1);
    if (removed) {
      updatedOrder.splice(swapIndex, 0, removed);
    }

    await Promise.all(
      updatedOrder.map((doc, index) =>
        db.updateRow(DATABASE_ID, NAV_COLLECTION, doc.$id, {
          order: index + 1,
        })
      )
    );

    revalidateNavConsumers();
    return { success: true };
  } catch (error) {
    console.error("Failed to move nav item", error);
    return { success: false, error: "Failed to reorder navigation item" };
  }
};

export const syncNavMenuStructure = async (
  structure: NavMenuStructureItem[]
): Promise<MutationResponse> => {
  try {
    const { db } = await createSessionClient();

    await Promise.all(
      structure.map((item) =>
        db.updateRow(DATABASE_ID, NAV_COLLECTION, item.id, {
          parent_id: item.parentId ?? null,
          order: item.order,
        })
      )
    );

    revalidateNavConsumers();
    return { success: true };
  } catch (error) {
    console.error("Failed to sync nav menu structure", error);
    return { success: false, error: "Failed to persist navigation ordering" };
  }
};
