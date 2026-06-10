import { z } from "zod";

/**
 * Validation schema for the expense/profile bank+contact details form.
 * Shared by the web and admin profile forms — keep in sync with the
 * `users` table attributes in packages/api/appwrite.config.json.
 */
export const profileFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address").optional(),
  phone: z
    .string()
    .min(8, "Phone number must be at least 8 characters")
    .optional(),
  address: z.string().min(3, "Address is required").optional(),
  city: z.string().min(2, "City is required").optional(),
  zip: z.string().min(4, "ZIP/Postal code is required").optional(),
  bank_account: z
    .string()
    .min(8, "Bank account must be at least 8 characters")
    .optional(),
  swift: z.string().optional(),
});

export type ProfileFormValues = z.infer<typeof profileFormSchema>;

export type ProfileFormInitialData = {
  [Key in keyof ProfileFormValues]?: ProfileFormValues[Key] | null;
};
