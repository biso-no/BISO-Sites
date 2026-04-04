import { z } from "zod";

export { slugify } from "@/components/forms/slugify";

export const formSchema = z.object({
  slug: z
    .string()
    .min(1, "Slug is required")
    .max(200)
    .regex(
      /^[a-z0-9-]+$/,
      "Slug can only contain lowercase letters, numbers, and hyphens"
    ),
  status: z.enum(["draft", "published", "closed"]),
  campus_id: z.string().min(1, "Campus is required"),
  department_id: z.string().optional(),
  type: z.string().optional(),
  application_deadline: z.string().optional(),
  start_date: z.string().optional(),
  contact_name: z.string().optional(),
  contact_email: z
    .string()
    .email("Must be a valid email")
    .optional()
    .or(z.literal("")),
  apply_url: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  image: z.string().optional(),
  // Translations (nested, matching event/news schema pattern)
  translations: z.object({
    en: z.object({
      title: z
        .string()
        .min(5, "English title must be at least 5 characters")
        .max(100, "English title must be 100 characters or fewer"),
      description: z
        .string()
        .min(20, "English description must be at least 20 characters")
        .max(50_000),
    }),
    no: z.object({
      title: z
        .string()
        .min(5, "Norwegian title must be at least 5 characters")
        .max(100, "Norwegian title must be 100 characters or fewer"),
      description: z
        .string()
        .min(20, "Norwegian description must be at least 20 characters")
        .max(50_000),
    }),
  }),
});

export type FormValues = z.infer<typeof formSchema>;
