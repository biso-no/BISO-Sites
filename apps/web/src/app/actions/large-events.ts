"use server"

import { Query } from "@repo/api"
import { createAdminClient } from "@repo/api/server"
import type {
  LargeEvent,
  LargeEventItem,
  ParsedLargeEvent
} from "@/lib/types/large-event"

type ListParams = {
  limit?: number
  activeOnly?: boolean
  showcaseTypes?: string[]
}

const parseJsonSafely = <T>(value?: string | string[] | null): T | undefined => {
  if (!value) return undefined
  try {
    return JSON.parse(typeof value === "string" ? value : JSON.stringify(value)) as T
  } catch (error) {
    console.error("Failed to parse JSON field for large event", error)
    return undefined
  }
}

const toParsedEvent = (event: LargeEvent): ParsedLargeEvent => {
  const gradient =
    Array.isArray(event.gradientHex) && event.gradientHex.length
      ? event.gradientHex
      : parseJsonSafely<string[]>(event.gradientHex as unknown as string)

  return {
    ...event,
    gradient,
    parsedMetadata: parseJsonSafely<Record<string, unknown>>(event.contentMetadata),
    parsedCampusConfigs: parseJsonSafely<Array<Record<string, unknown>>>(event.campusConfigs)
  }
}

export async function listLargeEvents(params: ListParams = {}): Promise<ParsedLargeEvent[]> {
  const { limit = 25, activeOnly = true, showcaseTypes } = params
  try {
    const { db } = await createAdminClient()

    const queries = [Query.orderDesc("priority"), Query.limit(limit)]

    if (activeOnly) {
      queries.push(Query.equal("isActive", true))
    }

    if (Array.isArray(showcaseTypes) && showcaseTypes.length) {
      queries.push(Query.equal("showcaseType", showcaseTypes))
    }

    const response = await db.listRows("app", "large_event", queries)
    return response.rows.map((doc) => toParsedEvent(doc as unknown as LargeEvent))
  } catch (error) {
    console.error("Failed to list large events", error)
    return []
  }
}

export async function getLargeEventBySlug(slug: string): Promise<ParsedLargeEvent | null> {
  if (!slug) return null
  try {
    const { db } = await createAdminClient()

    const response = await db.listRows("app", "large_event", [
      Query.equal("slug", slug),
      Query.limit(1)
    ])

    if (response.total === 0) {
      return null
    }

    const parsed = toParsedEvent(response.rows[0] as unknown as LargeEvent)

    const items = await db.listRows("app", "large_event_item", [
      Query.equal("eventId", parsed.$id),
      Query.orderAsc("sort"),
      Query.orderAsc("startTime"),
      Query.limit(100)
    ])

    parsed.items = items.rows as unknown as LargeEventItem[]
    return parsed
  } catch (error) {
    console.error("Failed to fetch large event", error)
    return null
  }
}

export async function getLargeEventItems(eventId: string): Promise<LargeEventItem[]> {
  if (!eventId) return []
  try {
    const { db } = await createAdminClient()

    const response = await db.listRows("app", "large_event_item", [
      Query.equal("eventId", eventId),
      Query.orderAsc("sort"),
      Query.orderAsc("startTime"),
      Query.limit(100)
    ])

    return response.rows as unknown as LargeEventItem[]
  } catch (error) {
    console.error("Failed to fetch large event items", error)
    return []
  }
}
