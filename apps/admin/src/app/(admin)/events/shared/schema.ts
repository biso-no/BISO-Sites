import { z } from "zod";

export const formSchema = z.object({
  // Database schema fields
  slug: z.string().min(1, "Slug is required"),
  status: z.enum(["draft", "published", "cancelled"]),
  campus_id: z.string().min(1, "Campus is required"),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  location: z.string().optional(),
  price: z.number().optional(),
  ticket_url: z
    .string()
    .url("Must be a valid URL")
    .optional()
    .or(z.literal("")),
  image: z.string().optional(),
  member_only: z.boolean(),
  collection_id: z.string().optional(),
  is_collection: z.boolean(),
  collection_pricing: z.enum(["bundle", "individual"]).optional(),
  department_id: z.string().optional(),
  // Metadata fields (non-schema fields)
  metadata: z
    .object({
      start_time: z.string().optional(),
      end_time: z.string().optional(),
      units: z.array(z.string()).optional(),
      images: z.array(z.string()).optional(), // For form UI only
    })
    .optional(),
  // Translations
  translations: z.object({
    en: z.object({
      title: z.string().min(1, "English title is required"),
      description: z.string().min(1, "English description is required"),
    }),
    no: z.object({
      title: z.string().min(1, "Norwegian title is required"),
      description: z.string().min(1, "Norwegian description is required"),
    }),
  }),
});

export type FormValues = z.infer<typeof formSchema>;

const SLUG_REGEX_WHITESPACE = /\s+/g;
const SLUG_REGEX_INVALID_CHARS = /[^\w-]+/g;
const SLUG_REGEX_MULTI_DASH = /--+/g;
const SLUG_REGEX_START_DASH = /^-+/;
const SLUG_REGEX_END_DASH = /-+$/;

// Slugify function
export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(SLUG_REGEX_WHITESPACE, "-")
    .replace(SLUG_REGEX_INVALID_CHARS, "")
    .replace(SLUG_REGEX_MULTI_DASH, "-")
    .replace(SLUG_REGEX_START_DASH, "")
    .replace(SLUG_REGEX_END_DASH, "");
}

export function mapFormValuesToPayload(values: FormValues) {
  const ticketUrl = values.ticket_url?.trim() || undefined;

  return {
    // Database schema fields
    slug: values.slug?.trim(),
    status: values.status,
    campus_id: values.campus_id,
    start_date: values.start_date || undefined,
    end_date: values.end_date || undefined,
    location: values.location || undefined,
    price: values.price,
    ticket_url: ticketUrl,
    image: getPrimaryImage(values),
    member_only: values.member_only ?? false,
    collection_id: values.collection_id?.trim() || undefined,
    is_collection: values.is_collection ?? false,
    collection_pricing: values.collection_pricing || undefined,
    department_id: values.department_id || undefined,
    // Metadata (only non-schema fields)
    metadata: mapMetadata(values.metadata),
    // Translations
    translations: values.translations,
  };
}

function getPrimaryImage(values: FormValues) {
  return values.metadata?.images?.[0] || values.image || undefined;
}

function mapMetadata(metadata: FormValues["metadata"]) {
  return {
    start_time: metadata?.start_time || undefined,
    end_time: metadata?.end_time || undefined,
    units: metadata?.units?.length ? metadata.units : undefined,
  };
}

type EventInput = {
  slug?: string | null;
  status?: string | null;
  campus_id?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  location?: string | null;
  price?: number | null;
  ticket_url?: string | null;
  image?: string | null;
  member_only?: boolean | null;
  collection_id?: string | null;
  is_collection?: boolean | null;
  collection_pricing?: string | null;
  department_id?: string | null;
  metadata_parsed?: any;
  translations?: any;
};

export function getEventDefaultValues(event?: EventInput): Partial<FormValues> {
  const metadata = event?.metadata_parsed ?? {};

  return {
    // Database schema fields
    slug: event?.slug ?? "",
    status: (event?.status as FormValues["status"]) ?? "draft",
    campus_id: event?.campus_id ?? "",
    start_date: event?.start_date ?? "",
    end_date: event?.end_date ?? "",
    location: event?.location ?? "",
    price: event?.price ?? undefined,
    ticket_url: event?.ticket_url ?? "",
    image: event?.image ?? "",
    member_only: event?.member_only ?? false,
    collection_id: event?.collection_id ?? "",
    is_collection: event?.is_collection ?? false,
    collection_pricing:
      (event?.collection_pricing as FormValues["collection_pricing"]) ??
      undefined,
    department_id: event?.department_id ?? "",
    // Metadata fields
    metadata: getMetadataDefaults(metadata, event?.image),
    // Translations
    translations: getTranslationDefaults(event?.translations),
  };
}

function getMetadataDefaults(metadata: any, image?: string | null) {
  return {
    start_time: (metadata.start_time as string) ?? "",
    end_time: (metadata.end_time as string) ?? "",
    units: getDefaultUnits(metadata),
    images: image ? [image] : [],
  };
}

function getDefaultUnits(metadata: any): string[] {
  if (!metadata?.units) {
    return [];
  }
  if (Array.isArray(metadata.units)) {
    return metadata.units.map((value: any) => String(value));
  }
  return [];
}

function getTranslationDefaults(translations: any) {
  const t = translations ?? {
    en: { title: "", description: "" },
    no: { title: "", description: "" },
  };

  return {
    en: {
      title: t.en?.title ?? "",
      description: t.en?.description ?? "",
    },
    no: {
      title: t.no?.title ?? "",
      description: t.no?.description ?? "",
    },
  };
}
