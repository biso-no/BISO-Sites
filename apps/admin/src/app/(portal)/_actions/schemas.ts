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

export const eventSchema = z.object({
  title_no: z.string().min(1, "Title (NO) is required"),
  title_en: z.string().min(1, "Title (EN) is required"),
  description_no: z.string().optional().nullable(),
  description_en: z.string().optional().nullable(),
  campus_id: z.string().min(1, "Campus is required"),
  department_id: z.string().optional().nullable(),
  slug: z
    .string()
    .min(1, "Slug is required")
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
  status: z.enum(["draft", "published", "cancelled"]),
  start_date: z.string().optional().nullable(),
  end_date: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  image: z.string().url().optional().nullable().or(z.literal("")),
  price: z.coerce.number().nonnegative().optional().nullable(),
  ticket_url: z.string().url().optional().nullable().or(z.literal("")),
  member_only: z.boolean().default(false),
});
export const EVENTS_PAGE_SIZE = 20;
export type EventFormValues = z.infer<typeof eventSchema>;

export const jobSchema = z.object({
  title_no: z.string().min(1, "Title (NO) is required"),
  title_en: z.string().min(1, "Title (EN) is required"),
  description_no: z.string().min(1, "Description (NO) is required"),
  description_en: z.string().min(1, "Description (EN) is required"),
  campus_id: z.string().min(1, "Campus is required"),
  department_id: z.string().optional().nullable(),
  slug: z
    .string()
    .min(1, "Slug is required")
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
  status: z.enum(["draft", "published", "closed"]),
  employment_type: z.string().optional().nullable(),
  company: z.string().optional().nullable(),
});
export const JOBS_PAGE_SIZE = 20;
export type JobFormValues = z.infer<typeof jobSchema>;

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
  description: z.string().optional().nullable(),
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
});
const _PRODUCTS_PAGE_SIZE = 20;
export type ProductFormValues = z.infer<typeof productSchema>;

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

export type DocumentFormCategory = (typeof DOCUMENT_FORM_CATEGORIES)[number];

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

// Create uses the same schema — SharePoint drive ID and folder path are
// now resolved automatically on the server based on category + language.
export const documentCreateSchema = documentMetadataSchema;

export type DocumentCreateFormValues = z.infer<typeof documentCreateSchema>;
