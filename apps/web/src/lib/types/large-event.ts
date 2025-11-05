import { Models } from "@repo/api";

export interface LargeEvent extends Models.Row {
  slug: string;
  name: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  isActive?: boolean;
  heroOverrideEnabled?: boolean;
  priority?: number;
  primaryColorHex?: string;
  secondaryColorHex?: string;
  textColorHex?: string;
  gradientHex?: string[];
  logoUrl?: string | null;
  backgroundImageUrl?: string | null;
  campusConfigs?: string;
  showcaseType?: string | null;
  contentMetadata?: string | null;
  externalUrl?: string | null;
  ctaText?: string | null;
}

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
  parsedCampusConfigs?: Array<Record<string, unknown>>;
  items?: LargeEventItem[];
}
