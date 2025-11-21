import type { Models } from "@repo/api";
import type { LargeEvent } from "@repo/api/types/appwrite";

export interface LargeEventItem extends Models.Row {
  eventId?: string;
  campusId: string;
  title: string;
  subtitle?: string;
  startTime: string;
  endTime?: string;
  coverImageUrl?: string;
  location?: string;
  ticketUrl?: string;
  sort?: number;
}

export interface ParsedLargeEvent extends LargeEvent {
  gradient?: string[];
  parsedMetadata?: Record<string, unknown>;
  parsedCampusConfigs?: Record<string, unknown>[];
  items?: LargeEventItem[];
}
