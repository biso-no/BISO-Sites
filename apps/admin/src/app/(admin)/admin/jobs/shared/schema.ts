import { z } from "zod";

export const formSchema = z.object({
  slug: z.string().min(1),
  status: z.enum(["draft", "published", "closed"]).default("draft"),
  campus_id: z.string().min(1),
  department_id: z.string().optional(),
  type: z.string().optional(),
  application_deadline: z.string().optional(),
  start_date: z.string().optional(),
  contact_name: z.string().optional(),
  contact_email: z.string().email().optional(),
  apply_url: z.string().url().optional(),
  image: z.string().optional(),
  // Translations
  en_title: z.string().optional(),
  en_description: z.string().optional(),
  no_title: z.string().optional(),
  no_description: z.string().optional(),
});

export type FormValues = z.infer<typeof formSchema>;
