import type { TableSchema } from "./types";

/**
 * Schema definitions for all available data tables
 * Used by DataSourcePicker to show available fields and filters
 */
export const TABLE_SCHEMAS: TableSchema[] = [
  {
    id: "events",
    label: "Events",
    description: "Upcoming and past events",
    fields: [
      { name: "title", type: "string", label: "Title" },
      { name: "description", type: "string", label: "Description" },
      { name: "image", type: "string", label: "Image" },
      { name: "start_date", type: "date", label: "Start Date" },
      { name: "end_date", type: "date", label: "End Date" },
      { name: "location", type: "string", label: "Location" },
      { name: "category", type: "string", label: "Category" },
      { name: "price", type: "number", label: "Price" },
      { name: "status", type: "string", label: "Status" },
    ],
    defaultSort: { field: "start_date", direction: "asc" },
    presetFilters: [
      {
        label: "Upcoming Events",
        filters: [
          { field: "start_date", operator: "greaterThan", value: "$now" },
          { field: "status", operator: "equal", value: "published" },
        ],
      },
      {
        label: "Past Events",
        filters: [
          { field: "start_date", operator: "lessThan", value: "$now" },
          { field: "status", operator: "equal", value: "published" },
        ],
      },
      {
        label: "Featured Events",
        filters: [{ field: "featured", operator: "equal", value: true }],
      },
    ],
  },
  {
    id: "news",
    label: "News",
    description: "News articles and announcements",
    fields: [
      { name: "title", type: "string", label: "Title" },
      { name: "description", type: "string", label: "Description" },
      { name: "image", type: "string", label: "Image" },
      { name: "status", type: "string", label: "Status" },
      { name: "sticky", type: "boolean", label: "Sticky" },
      { name: "$createdAt", type: "date", label: "Created At" },
    ],
    defaultSort: { field: "$createdAt", direction: "desc" },
    presetFilters: [
      {
        label: "Published",
        filters: [{ field: "status", operator: "equal", value: "published" }],
      },
      {
        label: "Sticky/Featured",
        filters: [{ field: "sticky", operator: "equal", value: true }],
      },
    ],
  },
  {
    id: "jobs",
    label: "Jobs",
    description: "Job listings and positions",
    fields: [
      { name: "title", type: "string", label: "Title" },
      { name: "description", type: "string", label: "Description" },
      { name: "department", type: "string", label: "Department" },
      { name: "location", type: "string", label: "Location" },
      { name: "type", type: "string", label: "Type" },
      { name: "status", type: "string", label: "Status" },
      { name: "deadline", type: "date", label: "Deadline" },
    ],
    defaultSort: { field: "$createdAt", direction: "desc" },
    presetFilters: [
      {
        label: "Open Positions",
        filters: [{ field: "status", operator: "equal", value: "published" }],
      },
      {
        label: "Active Deadline",
        filters: [{ field: "deadline", operator: "greaterThan", value: "$now" }],
      },
    ],
  },
  {
    id: "partners",
    label: "Partners",
    description: "Partner organizations and sponsors",
    fields: [
      { name: "name", type: "string", label: "Name" },
      { name: "image_url", type: "string", label: "Logo" },
      { name: "url", type: "string", label: "Website" },
      { name: "level", type: "string", label: "Level" },
    ],
    defaultSort: { field: "name", direction: "asc" },
    presetFilters: [
      {
        label: "National Partners",
        filters: [{ field: "level", operator: "equal", value: "national" }],
      },
      {
        label: "Campus Partners",
        filters: [{ field: "level", operator: "equal", value: "campus" }],
      },
    ],
  },
  {
    id: "departments",
    label: "Departments",
    description: "Student organizations and committees",
    fields: [
      { name: "Name", type: "string", label: "Name" },
      { name: "logo", type: "string", label: "Logo" },
      { name: "type", type: "string", label: "Type" },
      { name: "active", type: "boolean", label: "Active" },
    ],
    defaultSort: { field: "Name", direction: "asc" },
    presetFilters: [
      {
        label: "Active Only",
        filters: [{ field: "active", operator: "equal", value: true }],
      },
    ],
  },
  {
    id: "team",
    label: "Team Members",
    description: "Board members and staff from departments",
    fields: [
      { name: "name", type: "string", label: "Name" },
      { name: "role", type: "string", label: "Role" },
      { name: "imageUrl", type: "string", label: "Photo" },
    ],
    defaultSort: { field: "name", direction: "asc" },
  },
  {
    id: "products",
    label: "Shop Products",
    description: "Webshop products",
    fields: [
      { name: "title", type: "string", label: "Title" },
      { name: "description", type: "string", label: "Description" },
      { name: "image", type: "string", label: "Image" },
      { name: "regular_price", type: "number", label: "Price" },
      { name: "category", type: "string", label: "Category" },
      { name: "status", type: "string", label: "Status" },
      { name: "stock", type: "number", label: "Stock" },
    ],
    defaultSort: { field: "$createdAt", direction: "desc" },
    presetFilters: [
      {
        label: "Available",
        filters: [
          { field: "status", operator: "equal", value: "published" },
          { field: "stock", operator: "greaterThan", value: 0 },
        ],
      },
    ],
  },
  {
    id: "memberships",
    label: "Memberships",
    description: "Membership plans and pricing",
    fields: [
      { name: "name", type: "string", label: "Name" },
      { name: "price", type: "number", label: "Price" },
      { name: "category", type: "string", label: "Category" },
      { name: "status", type: "boolean", label: "Active" },
    ],
    defaultSort: { field: "price", direction: "asc" },
    presetFilters: [
      {
        label: "Available for Purchase",
        filters: [{ field: "canPurchase", operator: "equal", value: true }],
      },
    ],
  },
  {
    id: "pages",
    label: "Pages",
    description: "Published CMS pages",
    fields: [
      { name: "title", type: "string", label: "Title" },
      { name: "slug", type: "string", label: "Slug" },
      { name: "status", type: "string", label: "Status" },
    ],
    defaultSort: { field: "title", direction: "asc" },
    presetFilters: [
      {
        label: "Published",
        filters: [{ field: "status", operator: "equal", value: "published" }],
      },
    ],
  },
];

export function getTableSchema(tableId: string): TableSchema | undefined {
  return TABLE_SCHEMAS.find((s) => s.id === tableId);
}

export function getTableOptions(): { label: string; value: string }[] {
  return TABLE_SCHEMAS.map((s) => ({
    label: s.label,
    value: s.id,
  }));
}
