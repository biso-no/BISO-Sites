import * as z from "zod";

export const bankDetailsSchema = z.object({
  bank_account: z.string()
    .min(8, "Bank account number must be at least 8 characters")
    .max(34, "Bank account number cannot exceed 34 characters"),
  account_holder: z.string()
    .min(2, "Account holder name must be at least 2 characters")
    .max(100, "Account holder name cannot exceed 100 characters"),
  bank_name: z.string()
    .min(2, "Bank name must be at least 2 characters")
    .max(100, "Bank name cannot exceed 100 characters"),
  swift_code: z.string()
    .min(8, "SWIFT/BIC code must be 8 or 11 characters")
    .max(11, "SWIFT/BIC code must be 8 or 11 characters")
    .optional()
    .or(z.literal("")),
});

export const departmentDetailsSchema = z.object({
  department: z.string().min(1, "Please select a department"),
  campus: z.string().min(1, "Please select a campus"),
  description: z.string()
    .min(10, "Description must be at least 10 characters")
    .max(500, "Description cannot exceed 500 characters"),
});

export const documentDetailsSchema = z.object({
  expense_attachments: z.array(z.any()).min(1, "At least one document is required"),
  total: z.number().min(0, "Total amount must be greater than 0"),
});

export const departmentCampusSchema = z.object({
  department: z.string().min(1, "Department is required"),
  campus: z.string().min(1, "Campus is required"),
});

export const documentSchema = z.object({
  amount: z.number().min(0, "Amount must be positive"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
  description: z.string().min(1, "Description is required"),
  image: z.any(),
  url:z.string(),
  id:z.string()
});

export const documentsStepSchema = z.object({
  documents: z
    .array(documentSchema)
    .min(1, "At least one document is required"),
});

export const descriptionStepSchema = z.object({
  isEventRelated: z.boolean(),
  description: z
    .string()
    .min(10, "Description must be at least 10 characters long"),
});

export const formSchema = z.object({
  documents: z.array(documentSchema),
  bankAccount: z.string(),
  campus: z.string(),
  department: z.string(),
  description: z.string(),
  isEventRelated: z.boolean(),
  hasPrepayment: z.boolean(),
});

export type FormData = z.infer<typeof formSchema>;
export type BankDetailsFormData = z.infer<typeof bankDetailsSchema>;
export type DepartmentDetailsFormData = z.infer<typeof departmentDetailsSchema>;
export type DocumentDetailsFormData = z.infer<typeof documentDetailsSchema>;
