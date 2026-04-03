import { BenefitStatus } from "@repo/api/types/appwrite";
import { z } from "zod";

export const benefitFormSchema = z.object({
  campus_id: z.string().min(1, "Campus is required"),
  status: z.nativeEnum(BenefitStatus),
  kind: z.enum(["offer", "perk", "service"]),
  redemption_type: z.enum(["none", "code", "link", "qr", "onsite"]),
  category: z.string().min(1, "Category is required"),
  partner_id: z.string().nullable(),
  partner_name: z.string().nullable(),
  partner_logo_url: z.string().nullable(),
  title_nb: z.string().min(1, "Norwegian title is required"),
  title_en: z.string().min(1, "English title is required"),
  description_nb: z.string().min(1, "Norwegian description is required"),
  description_en: z.string().min(1, "English description is required"),
  teaser_nb: z.string().nullable(),
  teaser_en: z.string().nullable(),
  terms_nb: z.string().nullable(),
  terms_en: z.string().nullable(),
  redemption_value: z.string().nullable(),
  image_url: z.string().nullable(),
  is_featured: z.boolean(),
  publish_start: z.string().nullable(),
  publish_end: z.string().nullable(),
  sort_order: z.number().int().min(0).max(9999),
});

export type BenefitFormValues = z.infer<typeof benefitFormSchema>;
