import {
  type EventUpsertInput,
  eventUpsertSchema,
} from "@repo/shared/types/events";
import {
  type RecruitmentVacancyUpsertInput,
  recruitmentVacancyUpsertSchema,
} from "@repo/shared/types/recruitment";
import { z } from "zod";

export const benefitSchema = z.object({
  title_nb: z.string().min(1, "Title (NO) is required"),
  title_en: z.string().min(1, "Title (EN) is required"),
  description_nb: z.string().min(1, "Description (NO) is required"),
  description_en: z.string().min(1, "Description (EN) is required"),
  teaser_nb: z.string().optional().nullable(),
  teaser_en: z.string().optional().nullable(),
  campus_id: z.string().min(1, "Campus is required"),
  status: z.enum(["draft", "published", "archived"]),
  kind: z.enum(["offer", "perk", "service"]),
  redemption_type: z.enum(["none", "code", "link", "qr", "onsite"]),
  redemption_value: z.string().optional().nullable(),
  category: z.string().min(1, "Category is required"),
  partner_name: z.string().optional().nullable(),
  image_url: z.string().url().optional().nullable().or(z.literal("")),
  is_featured: z.boolean().default(false),
  is_member_only: z.boolean().default(true),
  publish_start: z.string().optional().nullable(),
  publish_end: z.string().optional().nullable(),
  sort_order: z.coerce.number().int().nonnegative().default(0),
});

export type BenefitFormValues = z.infer<typeof benefitSchema>;

export const eventSchema = eventUpsertSchema;
export const EVENTS_PAGE_SIZE = 20;
export type EventFormValues = EventUpsertInput;

export const jobSchema = recruitmentVacancyUpsertSchema;
export type JobFormValues = RecruitmentVacancyUpsertInput;

export const newsSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional().nullable(),
  campus_id: z.string().min(1, "Campus is required"),
  department_id: z.string().optional().nullable(),
  slug: z
    .string()
    .min(1, "Slug is required")
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
  status: z.enum(["draft", "published"]),
  locale: z.enum(["no", "en"]),
  author: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  image: z.string().url().optional().nullable().or(z.literal("")),
  sticky: z.boolean().default(false),
});
export const NEWS_PAGE_SIZE = 20;
export type NewsFormValues = z.infer<typeof newsSchema>;

export const productSchema = z.object({
  name: z.string().min(1, "Name is required"),
  name_en: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  description_en: z.string().optional().nullable(),
  campus_id: z.string().min(1, "Campus is required"),
  department_id: z.string().optional().nullable(),
  slug: z
    .string()
    .min(1, "Slug is required")
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
  status: z.enum(["draft", "pending_approval", "published", "archived"]),
  category: z.string().optional().nullable(),
  regular_price: z.coerce.number().nonnegative("Price must be 0 or more"),
  member_price: z.coerce.number().nonnegative().optional().nullable(),
  member_only: z.boolean().default(false),
  image: z.string().url().optional().nullable().or(z.literal("")),
  stock: z.coerce.number().int().nonnegative().optional().nullable(),
  variants_json: z.string().optional().nullable(),
  tags: z.array(z.string()).optional().nullable(),
  images: z.array(z.string()).optional().nullable(),
  cover_pattern: z
    .enum(["dotted", "linear", "concentric", "wave", "grid"])
    .optional()
    .nullable(),
  linked_event_id: z.string().optional().nullable(),
  inventory_mode: z.enum(["tracked", "unlimited"]).default("unlimited"),
  short_description: z.string().optional().nullable(),
  finago_account_number: z.coerce
    .number()
    .int()
    .positive()
    .optional()
    .nullable(),
});
const _PRODUCTS_PAGE_SIZE = 20;
export type ProductFormValues = z.infer<typeof productSchema>;

export const announcementSchema = z.object({
  title_en: z.string().min(1, "Title (EN) is required"),
  title_no: z.string().optional().nullable(),
  body_en: z.string().optional().nullable(),
  body_no: z.string().optional().nullable(),
  category: z.enum(["general", "trip", "urgent", "event"]).default("general"),
  audience_type: z
    .enum(["topic", "users", "segment", "broadcast"])
    .default("broadcast"),
  // For "topic": a topic id. For "users": comma-separated user ids or emails
  // (resolved server-side). For "segment": a segment id. For "broadcast": empty.
  audience_value: z.string().optional().nullable(),
  event_id: z.string().optional().nullable(),
  campus_id: z.string().optional().nullable(),
  push: z.boolean().default(true),
  scheduled_at: z.string().optional().nullable(),
});

export const ANNOUNCEMENTS_PAGE_SIZE = 20;
export type AnnouncementFormValues = z.infer<typeof announcementSchema>;

export const segmentMetadataSchema = z.object({
  departure_time: z.string().optional().nullable(),
  pickup_location: z.string().optional().nullable(),
  hotel: z.string().optional().nullable(),
  room_number: z.string().optional().nullable(),
  schedule: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const segmentSchema = z.object({
  event_id: z.string().min(1, "Event is required"),
  kind: z.string().trim().optional().default(""),
  name: z.string().min(1, "Name is required"),
  campus_id: z.string().optional().nullable(),
  capacity: z.coerce.number().int().nonnegative().default(0),
  metadata: segmentMetadataSchema.optional(),
  topic_id: z.string().optional().nullable(),
});

export type SegmentFormValues = z.infer<typeof segmentSchema>;

export const messageSegmentSchema = z.object({
  title_en: z.string().min(1, "Title (EN) is required"),
  title_no: z.string().optional().nullable(),
  body_en: z.string().optional().nullable(),
  body_no: z.string().optional().nullable(),
  category: z.enum(["general", "trip", "urgent", "event"]).default("trip"),
  push: z.boolean().default(true),
});

export type MessageSegmentValues = z.infer<typeof messageSegmentSchema>;

export const MEDIA_BUCKET_ID = "media";

export const DOCUMENTS_PAGE_SIZE = 25;

/**
 * Categories available for selection in the create/edit form.
 * business-regulations and communication-guidelines exist in Appwrite for
 * backward compatibility but are managed on different SharePoint sites, so
 * they are not offered as new-document options here.
 */
export const DOCUMENT_FORM_CATEGORIES = [
  "national-statutes",
  "campus-bylaws",
  "code-of-conduct",
  "authorization-matrix",
  "target-documents",
] as const;

export const documentMetadataSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional().nullable(),
  category: z.enum([
    "national-statutes",
    "campus-bylaws",
    "code-of-conduct",
    "business-regulations",
    "communication-guidelines",
    "authorization-matrix",
    "target-documents",
  ]),
  scope: z.enum(["national", "campus"]),
  campus_id: z.string().optional().nullable(),
  language: z.enum(["no", "en"]),
  version: z.string().optional().nullable(),
  version_number: z.coerce.number().int().positive().default(1),
  status: z.enum(["draft", "published"]),
  sort_order: z.coerce.number().int().nonnegative().default(0),
});

export type DocumentMetadataFormValues = z.infer<typeof documentMetadataSchema>;
