import { z } from "zod";
import type { PageCapability } from "../stores/copilot-store";
import type { FormFieldInfo } from "../types";

/**
 * Schema definition for an admin capability
 */
export type CapabilitySchema = {
  id: PageCapability;
  label: string;
  description: string;
  path: string;
  pathPattern?: RegExp;
  formFields: FormFieldInfo[];
  zodSchema: z.ZodObject<z.ZodRawShape>;
  requiredRoles?: string[];
};

/**
 * Event form schema
 */
export const eventSchema = z.object({
  slug: z.string().min(1, "Slug is required"),
  status: z.enum(["draft", "published", "cancelled"]),
  campus_id: z.string().optional(),
  department_id: z.string().optional(),
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
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  location: z.string().optional(),
  price: z.number().optional(),
  ticket_url: z.string().optional(),
  member_only: z.boolean().optional(),
});

/**
 * Event form fields for AI
 */
export const eventFormFields: FormFieldInfo[] = [
  {
    id: "translations.en.title",
    name: "title_en",
    type: "text",
    label: "English Title",
    required: true,
  },
  {
    id: "translations.no.title",
    name: "title_no",
    type: "text",
    label: "Norwegian Title",
    required: true,
  },
  {
    id: "translations.en.description",
    name: "description_en",
    type: "textarea",
    label: "English Description",
    required: true,
  },
  {
    id: "translations.no.description",
    name: "description_no",
    type: "textarea",
    label: "Norwegian Description",
    required: true,
  },
  {
    id: "slug",
    name: "slug",
    type: "text",
    label: "URL Slug",
    required: true,
  },
  {
    id: "start_date",
    name: "start_date",
    type: "date",
    label: "Start Date",
  },
  {
    id: "end_date",
    name: "end_date",
    type: "date",
    label: "End Date",
  },
  {
    id: "location",
    name: "location",
    type: "text",
    label: "Location",
  },
  {
    id: "price",
    name: "price",
    type: "number",
    label: "Price (NOK)",
  },
  {
    id: "ticket_url",
    name: "ticket_url",
    type: "text",
    label: "Ticket URL",
  },
  {
    id: "member_only",
    name: "member_only",
    type: "checkbox",
    label: "Members Only",
  },
  {
    id: "status",
    name: "status",
    type: "select",
    label: "Status",
    options: [
      { value: "draft", label: "Draft" },
      { value: "published", label: "Published" },
      { value: "cancelled", label: "Cancelled" },
    ],
  },
];

/**
 * Job form schema
 */
export const jobSchema = z.object({
  slug: z.string().min(1, "Slug is required"),
  status: z.enum(["draft", "published", "closed"]),
  campus_id: z.string().optional(),
  department_id: z.string().optional(),
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
  deadline: z.string().optional(),
  employment_type: z.string().optional(),
  contact_email: z.string().email().optional(),
});

/**
 * Job form fields for AI
 */
export const jobFormFields: FormFieldInfo[] = [
  {
    id: "translations.en.title",
    name: "title_en",
    type: "text",
    label: "English Title",
    required: true,
  },
  {
    id: "translations.no.title",
    name: "title_no",
    type: "text",
    label: "Norwegian Title",
    required: true,
  },
  {
    id: "translations.en.description",
    name: "description_en",
    type: "textarea",
    label: "English Description",
    required: true,
  },
  {
    id: "translations.no.description",
    name: "description_no",
    type: "textarea",
    label: "Norwegian Description",
    required: true,
  },
  {
    id: "slug",
    name: "slug",
    type: "text",
    label: "URL Slug",
    required: true,
  },
  {
    id: "deadline",
    name: "deadline",
    type: "date",
    label: "Application Deadline",
  },
  {
    id: "employment_type",
    name: "employment_type",
    type: "select",
    label: "Employment Type",
    options: [
      { value: "full-time", label: "Full-time" },
      { value: "part-time", label: "Part-time" },
      { value: "volunteer", label: "Volunteer" },
      { value: "internship", label: "Internship" },
    ],
  },
  {
    id: "contact_email",
    name: "contact_email",
    type: "text",
    label: "Contact Email",
  },
  {
    id: "status",
    name: "status",
    type: "select",
    label: "Status",
    options: [
      { value: "draft", label: "Draft" },
      { value: "published", label: "Published" },
      { value: "closed", label: "Closed" },
    ],
  },
];

/**
 * Product form schema
 */
export const productSchema = z.object({
  slug: z.string().min(1, "Slug is required"),
  status: z.enum(["draft", "published", "archived"]),
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
  price: z.number().min(0),
  stock: z.number().min(0).optional(),
  category: z.string().optional(),
});

/**
 * Product form fields for AI
 */
export const productFormFields: FormFieldInfo[] = [
  {
    id: "translations.en.title",
    name: "title_en",
    type: "text",
    label: "English Title",
    required: true,
  },
  {
    id: "translations.no.title",
    name: "title_no",
    type: "text",
    label: "Norwegian Title",
    required: true,
  },
  {
    id: "translations.en.description",
    name: "description_en",
    type: "textarea",
    label: "English Description",
    required: true,
  },
  {
    id: "translations.no.description",
    name: "description_no",
    type: "textarea",
    label: "Norwegian Description",
    required: true,
  },
  {
    id: "slug",
    name: "slug",
    type: "text",
    label: "URL Slug",
    required: true,
  },
  {
    id: "price",
    name: "price",
    type: "number",
    label: "Price (NOK)",
    required: true,
  },
  {
    id: "stock",
    name: "stock",
    type: "number",
    label: "Stock Quantity",
  },
  {
    id: "category",
    name: "category",
    type: "text",
    label: "Category",
  },
  {
    id: "status",
    name: "status",
    type: "select",
    label: "Status",
    options: [
      { value: "draft", label: "Draft" },
      { value: "published", label: "Published" },
      { value: "archived", label: "Archived" },
    ],
  },
];

/**
 * Puck page schema (for page editor)
 */
export const puckPageSchema = z.object({
  content: z.array(
    z.object({
      type: z.string(),
      props: z.record(z.string(), z.unknown()),
    })
  ),
  root: z
    .object({
      props: z.record(z.string(), z.unknown()).optional(),
    })
    .optional(),
});

/**
 * Registry of all admin capabilities
 */
export const CAPABILITY_REGISTRY: Partial<
  Record<PageCapability, CapabilitySchema>
> = {
  "create-event": {
    id: "create-event",
    label: "Create Event",
    description:
      "Create a new event with title, description, date, and location",
    path: "/admin/events/new",
    formFields: eventFormFields,
    zodSchema: eventSchema,
    requiredRoles: ["Admin", "pr"],
  },
  "edit-event": {
    id: "edit-event",
    label: "Edit Event",
    description: "Modify an existing event",
    path: "/admin/events",
    pathPattern: /^\/admin\/events\/[^/]+$/,
    formFields: eventFormFields,
    zodSchema: eventSchema,
    requiredRoles: ["Admin", "pr"],
  },
  "create-job": {
    id: "create-job",
    label: "Create Job",
    description: "Create a new job posting",
    path: "/admin/jobs/new",
    formFields: jobFormFields,
    zodSchema: jobSchema,
    requiredRoles: ["Admin", "hr", "pr"],
  },
  "edit-job": {
    id: "edit-job",
    label: "Edit Job",
    description: "Modify an existing job posting",
    path: "/admin/jobs",
    pathPattern: /^\/admin\/jobs\/[^/]+$/,
    formFields: jobFormFields,
    zodSchema: jobSchema,
    requiredRoles: ["Admin", "hr", "pr"],
  },
  "create-product": {
    id: "create-product",
    label: "Create Product",
    description: "Add a new product to the shop",
    path: "/admin/shop/products/new",
    formFields: productFormFields,
    zodSchema: productSchema,
    requiredRoles: ["Admin", "finance"],
  },
  "edit-product": {
    id: "edit-product",
    label: "Edit Product",
    description: "Modify an existing product",
    path: "/admin/shop/products",
    pathPattern: /^\/admin\/shop\/products\/[^/]+$/,
    formFields: productFormFields,
    zodSchema: productSchema,
    requiredRoles: ["Admin", "finance"],
  },
  "create-post": {
    id: "create-post",
    label: "Create Post",
    description: "Create a new blog post or news article",
    path: "/admin/posts/new",
    formFields: [],
    zodSchema: z.object({}),
    requiredRoles: ["Admin", "pr"],
  },
  "edit-post": {
    id: "edit-post",
    label: "Edit Post",
    description: "Modify an existing post",
    path: "/admin/posts",
    pathPattern: /^\/admin\/posts\/[^/]+$/,
    formFields: [],
    zodSchema: z.object({}),
    requiredRoles: ["Admin", "pr"],
  },
  "create-page": {
    id: "create-page",
    label: "Create Page",
    description: "Create a new website page using the Puck editor",
    path: "/admin/pages",
    formFields: [],
    zodSchema: puckPageSchema,
    requiredRoles: ["Admin", "pr"],
  },
  "edit-page": {
    id: "edit-page",
    label: "Edit Page",
    description: "Edit a website page using the Puck editor",
    path: "/admin/pages",
    pathPattern: /^\/admin\/pages\/[^/]+\/[^/]+\/editor$/,
    formFields: [],
    zodSchema: puckPageSchema,
    requiredRoles: ["Admin", "pr"],
  },
  "view-only": {
    id: "view-only",
    label: "View Only",
    description: "No editing capabilities on this page",
    path: "/admin",
    formFields: [],
    zodSchema: z.object({}),
  },
};

/**
 * Get capability from current path
 */
export function getCapabilityFromPath(path: string): CapabilitySchema | null {
  for (const capability of Object.values(CAPABILITY_REGISTRY)) {
    if (capability.pathPattern?.test(path)) {
      return capability;
    }
    if (capability.path === path) {
      return capability;
    }
  }
  return null;
}

/**
 * Get form fields description for AI prompt
 */
export function getFormFieldsDescription(capability: PageCapability): string {
  const schema = CAPABILITY_REGISTRY[capability];
  if (!schema?.formFields.length) {
    return "No form fields available for this capability.";
  }

  return schema.formFields
    .map(
      (f) =>
        `- ${f.id}: ${f.label} (${f.type}${f.required ? ", required" : ""})`
    )
    .join("\n");
}

/**
 * Get all capabilities as a description for AI prompt
 */
export function getCapabilitiesDescription(): string {
  return Object.values(CAPABILITY_REGISTRY)
    .filter((c) => c.id !== "view-only")
    .map((c) => `- ${c.id}: ${c.description} (path: ${c.path})`)
    .join("\n");
}
