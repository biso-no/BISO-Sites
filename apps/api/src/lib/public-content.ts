import { Query } from "@repo/api";
import { createPublicClient } from "@repo/api/server";
import type {
  ContentTranslations,
  ContentTranslationsLocale,
  Events,
  News,
} from "@repo/api/types/appwrite";
import { EventsStatus, NewsStatus } from "@repo/api/types/appwrite";

export type PublicLocale = "en" | "no";

const WEB_BASE_URL = "https://biso.no";
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface PublicEventItem {
  campus_id: string;
  campus_name: string | null;
  capacity: number | null;
  category: string | null;
  collection_id: string | null;
  contact_email: string | null;
  contact_name: string | null;
  created_at: string;
  department_id: string | null;
  department_name: string | null;
  description: string;
  end_date: string | null;
  id: string;
  image: string | null;
  is_collection: boolean;
  locale: PublicLocale;
  location: string | null;
  location_mode: string | null;
  member_only: boolean;
  member_price: number | null;
  online_url: string | null;
  price: number | null;
  pricing_mode: string | null;
  registration_deadline: string | null;
  short_description: string | null;
  slug: string | null;
  start_date: string | null;
  status: string;
  tags: string[];
  ticket_url: string | null;
  title: string;
  updated_at: string;
  url: string;
}

export interface PublicNewsItem {
  author: string | null;
  campus_id: string;
  campus_name: string | null;
  content: string;
  created_at: string;
  department_id: string | null;
  department_name: string | null;
  external_url: string | null;
  id: string;
  image: string | null;
  locale: PublicLocale;
  short_description: string | null;
  slug: string | null;
  status: string;
  sticky: boolean;
  title: string;
  updated_at: string;
  url: string;
}

export interface PublicContentQuery {
  campusId?: string;
  locale: PublicLocale;
  page: number;
  perPage: number;
  search?: string;
}

export interface PublicEventsQuery extends PublicContentQuery {
  includePast: boolean;
}

const EVENT_SELECT = [
  "$id",
  "$createdAt",
  "$updatedAt",
  "slug",
  "status",
  "campus_id",
  "department_id",
  "metadata",
  "start_date",
  "end_date",
  "registration_deadline",
  "location",
  "location_mode",
  "online_url",
  "price",
  "member_price",
  "pricing_mode",
  "member_only",
  "capacity",
  "ticket_url",
  "image",
  "category",
  "tags",
  "collection_id",
  "is_collection",
  "contact_name",
  "contact_email",
  "campus.$id",
  "campus.name",
  "department.$id",
  "department.Name",
  "translation_refs.$id",
  "translation_refs.locale",
  "translation_refs.title",
  "translation_refs.description",
  "translation_refs.short_description",
] as const;

const NEWS_SELECT = [
  "$id",
  "$createdAt",
  "$updatedAt",
  "slug",
  "status",
  "campus_id",
  "department_id",
  "sticky",
  "url",
  "image",
  "author",
  "campus.$id",
  "campus.name",
  "department.$id",
  "department.Name",
  "translation_refs.$id",
  "translation_refs.locale",
  "translation_refs.title",
  "translation_refs.description",
  "translation_refs.short_description",
] as const;

function pickTranslation(
  refs: ContentTranslations[] | undefined,
  locale: PublicLocale
): ContentTranslations | undefined {
  if (!refs || refs.length === 0) {
    return;
  }
  return refs.find((ref) => ref.locale === locale) ?? refs[0];
}

function toPublicEvent(event: Events, locale: PublicLocale): PublicEventItem {
  const translation = pickTranslation(event.translation_refs, locale);
  return {
    id: event.$id,
    slug: event.slug,
    status: event.status,
    campus_id: event.campus_id,
    campus_name: event.campus?.name ?? null,
    department_id: event.department_id,
    department_name: event.department?.Name ?? null,
    locale,
    title: translation?.title ?? "",
    description: translation?.description ?? "",
    short_description: translation?.short_description ?? null,
    start_date: event.start_date,
    end_date: event.end_date,
    registration_deadline: event.registration_deadline,
    location: event.location,
    location_mode: event.location_mode ?? null,
    online_url: event.online_url,
    price: event.price,
    member_price: event.member_price,
    pricing_mode: event.pricing_mode ?? null,
    member_only: event.member_only,
    capacity: event.capacity ?? null,
    ticket_url: event.ticket_url,
    image: event.image,
    category: event.category ?? null,
    tags: event.tags ?? [],
    is_collection: event.is_collection,
    collection_id: event.collection_id,
    contact_name: event.contact_name,
    contact_email: event.contact_email,
    url: `${WEB_BASE_URL}/events/${event.slug ?? event.$id}`,
    created_at: event.$createdAt,
    updated_at: event.$updatedAt,
  };
}

function toPublicNews(item: News, locale: PublicLocale): PublicNewsItem {
  const translation = pickTranslation(item.translation_refs, locale);
  return {
    id: item.$id,
    slug: item.slug,
    status: item.status,
    campus_id: item.campus_id,
    campus_name: item.campus?.name ?? null,
    department_id: item.department_id,
    department_name: item.department?.Name ?? null,
    locale,
    title: translation?.title ?? "",
    content: translation?.description ?? "",
    short_description: translation?.short_description ?? null,
    sticky: item.sticky ?? false,
    image: item.image,
    author: item.author,
    external_url: item.url,
    url: `${WEB_BASE_URL}/news/${item.slug ?? item.$id}`,
    created_at: item.$createdAt,
    updated_at: item.$updatedAt,
  };
}

export async function listPublicEvents(
  params: PublicEventsQuery
): Promise<{ items: PublicEventItem[]; total: number }> {
  const { db } = await createPublicClient();
  const offset = (params.page - 1) * params.perPage;

  const queries = [
    Query.select([...EVENT_SELECT]),
    Query.equal("status", EventsStatus.PUBLISHED),
    Query.equal(
      "translation_refs.locale",
      params.locale as ContentTranslationsLocale
    ),
  ];

  if (params.campusId && params.campusId !== "all") {
    queries.push(Query.equal("campus_id", params.campusId));
  }

  if (params.search?.trim()) {
    queries.push(Query.search("translation_refs.title", params.search.trim()));
  }

  if (params.includePast) {
    queries.push(Query.orderDesc("start_date"));
  } else {
    // Include events that started within the last day so ongoing
    // multi-day events remain visible.
    const cutoff = new Date(Date.now() - MS_PER_DAY).toISOString();
    queries.push(Query.greaterThanEqual("start_date", cutoff));
    queries.push(Query.orderAsc("start_date"));
  }

  queries.push(Query.offset(offset));
  queries.push(Query.limit(params.perPage));

  const response = await db.listRows<Events>("app", "events", queries);
  return {
    items: response.rows.map((event) => toPublicEvent(event, params.locale)),
    total: response.total,
  };
}

export async function listPublicNews(
  params: PublicContentQuery
): Promise<{ items: PublicNewsItem[]; total: number }> {
  const { db } = await createPublicClient();
  const offset = (params.page - 1) * params.perPage;

  const queries = [
    Query.select([...NEWS_SELECT]),
    Query.equal("status", NewsStatus.PUBLISHED),
    Query.equal(
      "translation_refs.locale",
      params.locale as ContentTranslationsLocale
    ),
  ];

  if (params.campusId && params.campusId !== "all") {
    queries.push(Query.equal("campus_id", params.campusId));
  }

  if (params.search?.trim()) {
    queries.push(Query.search("translation_refs.title", params.search.trim()));
  }

  queries.push(Query.orderDesc("$createdAt"));
  queries.push(Query.offset(offset));
  queries.push(Query.limit(params.perPage));

  const response = await db.listRows<News>("app", "news", queries);
  return {
    items: response.rows.map((item) => toPublicNews(item, params.locale)),
    total: response.total,
  };
}
