import type { Models } from "@repo/api";
import type { LargeEvent } from "@repo/api/types/appwrite";

export interface LargeEventItem extends Models.Row {
  campusId: string;
  coverImageUrl?: string;
  endTime?: string;
  eventId?: string;
  location?: string;
  sort?: number;
  startTime: string;
  subtitle?: string;
  ticketUrl?: string;
  title: string;
}

export interface ParsedLargeEvent extends LargeEvent {
  gradient?: string[];
  items?: LargeEventItem[];
  parsedCampusConfigs?: Record<string, unknown>[];
  parsedMetadata?: Record<string, unknown>;
}
