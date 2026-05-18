import {
  EventCategory,
  EventCoverPattern,
  EventLocationMode,
  EventPricingMode,
  EventPublishMode,
  EventStatus,
  type Events,
} from "@repo/api/types/appwrite";
import { z } from "zod";

const nullableTrimmedString = (max: number) =>
  z.preprocess((value) => {
    if (typeof value !== "string") {
      return value;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }, z.string().max(max).nullable().optional());

const nullableDateString = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return value;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  },
  z
    .string()
    .nullable()
    .optional()
    .refine(
      (value) => value == null || !Number.isNaN(Date.parse(value)),
      "Invalid date"
    )
);

export interface EventTranslation {
  $id: string;
  description: string | null;
  locale: string;
  short_description?: string | null;
  title: string;
}

export interface EventCampusRef {
  $id: string;
  name: string;
}

export interface EventDepartmentRef {
  $id: string;
  logo: string | null;
  Name: string;
}

export interface EventRecord
  extends Omit<Events, "campus" | "department" | "translation_refs"> {
  campus: EventCampusRef;
  department: EventDepartmentRef | null;
  translation_refs: EventTranslation[];
}

export const eventUpsertSchema = z.object({
  title_no: z.string().trim().min(1, "Title (NO) is required"),
  title_en: z.string().trim().min(1, "Title (EN) is required"),
  description_no: z.string().trim().optional().nullable(),
  description_en: z.string().trim().optional().nullable(),
  short_description_no: nullableTrimmedString(280),
  short_description_en: nullableTrimmedString(280),
  campus_id: z.string().trim().min(1, "Campus is required"),
  department_id: nullableTrimmedString(50),
  slug: z
    .string()
    .trim()
    .min(1, "Slug is required")
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
  status: z.nativeEnum(EventStatus),
  category: z.nativeEnum(EventCategory).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(60)).max(5).optional().default([]),
  start_date: nullableDateString,
  end_date: nullableDateString,
  registration_deadline: nullableDateString,
  location_mode: z
    .nativeEnum(EventLocationMode)
    .default(EventLocationMode.PHYSICAL),
  location: nullableTrimmedString(300),
  online_url: nullableTrimmedString(500),
  capacity: z.coerce.number().int().min(0).default(0),
  waitlist: z.boolean().default(false),
  cover_pattern: z
    .nativeEnum(EventCoverPattern)
    .default(EventCoverPattern.DOTTED),
  image: z.string().url().nullable().optional().or(z.literal("")),
  pricing_mode: z.nativeEnum(EventPricingMode).default(EventPricingMode.FREE),
  price: z.coerce.number().min(0).nullable().optional(),
  member_price: z.coerce.number().min(0).nullable().optional(),
  ticket_url: z.string().url().nullable().optional().or(z.literal("")),
  member_only: z.boolean().default(false),
  is_collection: z.boolean().default(false),
  notify_push: z.boolean().default(false),
  publish_mode: z.nativeEnum(EventPublishMode).default(EventPublishMode.NOW),
  scheduled_publish_at: nullableDateString,
  contact_name: nullableTrimmedString(120),
  contact_role: nullableTrimmedString(120),
  contact_email: z.preprocess((value) => {
    if (typeof value !== "string") {
      return value;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }, z.email().nullable().optional()),
});

export type EventUpsertInput = z.infer<typeof eventUpsertSchema>;
