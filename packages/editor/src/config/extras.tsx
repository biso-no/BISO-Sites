"use client";

/**
 * Extra blocks that fill coverage gaps found in the page audit.
 *
 * Covers:
 *  ContactCards  – grid of contact person / department cards
 *  DownloadList  – list of downloadable files
 *  NumberedSteps – numbered process steps (vertical or horizontal)
 *  TagList       – inline pill / chip row
 *  AlertCard     – tinted inline info / warning / success card
 *  ChecklistCard – card containing a titled checklist
 */

import {
  CheckCheck,
  Download,
  FileText,
  Mail,
  MapPin,
  Phone,
} from "lucide-react";
import { resolveComponentPermissions } from "./utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ContactCardsProps {
  columns?: 1 | 2 | 3 | 4;
  items?: {
    name: string;
    role?: string;
    email?: string;
    phone?: string;
    location?: string;
    avatar?: string;
    department?: string;
  }[];
  subtitle?: string;
  title?: string;
  variant?: "cards" | "compact" | "horizontal";
}

export interface DownloadListProps {
  items?: {
    name: string;
    description?: string;
    url: string;
    type?: string;
    size?: string;
  }[];
  subtitle?: string;
  title?: string;
  variant?: "list" | "grid";
}

export interface NumberedStepsProps {
  steps?: {
    title: string;
    description?: string;
    icon?: string;
  }[];
  subtitle?: string;
  title?: string;
  variant?: "vertical" | "horizontal" | "cards";
}

export interface TagListProps {
  align?: "left" | "center" | "right";
  size?: "sm" | "md" | "lg";
  tags?: { label: string; href?: string }[];
  title?: string;
  variant?: "default" | "outline" | "solid" | "gradient";
}

export interface AlertCardProps {
  content?: string;
  ctaHref?: string;
  ctaLabel?: string;
  dismissible?: boolean;
  icon?: boolean;
  title?: string;
  variant?: "info" | "warning" | "success" | "error" | "neutral";
}

export interface ChecklistCardProps {
  checkStyle?: "circle" | "square" | "arrow";
  ctaHref?: string;
  ctaLabel?: string;
  description?: string;
  items?: { text: string; checked?: boolean }[];
  title?: string;
  variant?: "default" | "bordered" | "tinted";
}

// ─── Components ───────────────────────────────────────────────────────────────

export const ExtrasComponents = {
  // ── ContactCards ────────────────────────────────────────────────────────────
  ContactCards: {
    label: "Contact Cards",
    resolvePermissions: resolveComponentPermissions,
    fields: {
      title: { type: "text", label: "Title" },
      subtitle: { type: "textarea", label: "Subtitle" },
      variant: {
        type: "select",
        label: "Card Style",
        options: [
          { label: "Cards", value: "cards" },
          { label: "Compact (list)", value: "compact" },
          { label: "Horizontal", value: "horizontal" },
        ],
      },
      columns: {
        type: "select",
        label: "Columns",
        options: [
          { label: "1", value: 1 },
          { label: "2", value: 2 },
          { label: "3", value: 3 },
          { label: "4", value: 4 },
        ],
      },
      items: {
        type: "array",
        label: "Contacts",
        getItemSummary: (item: { name?: string }) => item.name || "Contact",
        arrayFields: {
          name: { type: "text", label: "Name" },
          role: { type: "text", label: "Role / Title" },
          department: { type: "text", label: "Department" },
          email: { type: "text", label: "Email" },
          phone: { type: "text", label: "Phone" },
          location: { type: "text", label: "Location" },
          avatar: { type: "image", label: "Avatar" },
        },
        defaultItemProps: {
          name: "Jane Doe",
          role: "Head of Department",
          email: "jane@example.com",
        },
      },
    },
    render: ({
      title,
      subtitle,
      variant = "cards",
      columns = 3,
      items = [],
    }: ContactCardsProps) => {
      const colClass: Record<number, string> = {
        1: "grid-cols-1",
        2: "grid-cols-1 sm:grid-cols-2",
        3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
        4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
      };

      if (variant === "compact") {
        return (
          <section className="w-full px-4 py-10">
            {title && (
              <h2 className="mb-2 font-bold text-2xl text-gray-900">{title}</h2>
            )}
            {subtitle && <p className="mb-6 text-gray-500">{subtitle}</p>}
            <div className="divide-y divide-gray-100 rounded-xl border border-gray-200">
              {items.map((item, i) => (
                <div className="flex items-center gap-4 px-4 py-3" key={i}>
                  {item.avatar ? (
                    <img
                      alt={item.name}
                      className="h-9 w-9 rounded-full object-cover"
                      src={item.avatar}
                    />
                  ) : (
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-600 text-xs">
                      {item.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-gray-900">
                      {item.name}
                    </p>
                    {(item.role || item.department) && (
                      <p className="truncate text-gray-500 text-xs">
                        {[item.role, item.department]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                  </div>
                  {item.email && (
                    <a
                      className="flex items-center gap-1 text-blue-600 text-sm transition-colors hover:text-blue-800"
                      href={`mailto:${item.email}`}
                    >
                      <Mail className="h-4 w-4" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </section>
        );
      }

      if (variant === "horizontal") {
        return (
          <section className="w-full px-4 py-10">
            {title && (
              <h2 className="mb-2 font-bold text-2xl text-gray-900">{title}</h2>
            )}
            {subtitle && <p className="mb-8 text-gray-500">{subtitle}</p>}
            <div className="space-y-4">
              {items.map((item, i) => (
                <div
                  className="flex items-center gap-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
                  key={i}
                >
                  {item.avatar ? (
                    <img
                      alt={item.name}
                      className="h-16 w-16 rounded-full object-cover"
                      src={item.avatar}
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-linear-to-br from-blue-500 to-indigo-600 font-bold text-white text-xl">
                      {item.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 text-lg">
                      {item.name}
                    </h3>
                    {(item.role || item.department) && (
                      <p className="text-gray-500 text-sm">
                        {[item.role, item.department]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-3">
                      {item.email && (
                        <a
                          className="flex items-center gap-1.5 text-blue-600 text-sm hover:text-blue-800"
                          href={`mailto:${item.email}`}
                        >
                          <Mail className="h-3.5 w-3.5" />
                          {item.email}
                        </a>
                      )}
                      {item.phone && (
                        <a
                          className="flex items-center gap-1.5 text-gray-600 text-sm hover:text-gray-900"
                          href={`tel:${item.phone}`}
                        >
                          <Phone className="h-3.5 w-3.5" />
                          {item.phone}
                        </a>
                      )}
                      {item.location && (
                        <span className="flex items-center gap-1.5 text-gray-500 text-sm">
                          <MapPin className="h-3.5 w-3.5" />
                          {item.location}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      }

      // Default: cards
      return (
        <section className="w-full px-4 py-12">
          {(title || subtitle) && (
            <div className="mb-10 text-center">
              {title && (
                <h2 className="mb-2 font-bold text-3xl text-gray-900">
                  {title}
                </h2>
              )}
              {subtitle && <p className="text-gray-500 text-lg">{subtitle}</p>}
            </div>
          )}
          <div className={`grid gap-6 ${colClass[columns] ?? colClass[3]}`}>
            {items.map((item, i) => (
              <div
                className="flex flex-col items-center rounded-2xl border border-gray-100 bg-white p-6 text-center shadow-sm transition hover:shadow-md"
                key={i}
              >
                {item.avatar ? (
                  <img
                    alt={item.name}
                    className="mb-4 h-20 w-20 rounded-full object-cover ring-2 ring-gray-100"
                    src={item.avatar}
                  />
                ) : (
                  <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-linear-to-br from-blue-500 to-indigo-600 font-bold text-2xl text-white">
                    {item.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <h3 className="font-semibold text-gray-900">{item.name}</h3>
                {item.role && (
                  <p className="mt-0.5 text-gray-500 text-sm">{item.role}</p>
                )}
                {item.department && (
                  <p className="mt-0.5 font-medium text-blue-600 text-xs">
                    {item.department}
                  </p>
                )}
                <div className="mt-4 flex w-full flex-col gap-2">
                  {item.email && (
                    <a
                      className="flex items-center justify-center gap-2 rounded-lg border border-gray-200 px-4 py-2 font-medium text-gray-700 text-sm transition hover:bg-gray-50"
                      href={`mailto:${item.email}`}
                    >
                      <Mail className="h-4 w-4 text-gray-400" />
                      Send email
                    </a>
                  )}
                  {item.phone && (
                    <a
                      className="flex items-center justify-center gap-2 rounded-lg border border-gray-200 px-4 py-2 font-medium text-gray-700 text-sm transition hover:bg-gray-50"
                      href={`tel:${item.phone}`}
                    >
                      <Phone className="h-4 w-4 text-gray-400" />
                      {item.phone}
                    </a>
                  )}
                  {item.location && (
                    <span className="flex items-center justify-center gap-1.5 text-gray-400 text-xs">
                      <MapPin className="h-3.5 w-3.5" />
                      {item.location}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      );
    },
    defaultProps: {
      title: "Our Team",
      subtitle: "Get in touch with the right person.",
      variant: "cards" as const,
      columns: 3 as const,
      items: [
        {
          name: "Jane Doe",
          role: "Head of Department",
          email: "jane@example.com",
          department: "Marketing",
        },
        {
          name: "John Smith",
          role: "Student Advisor",
          email: "john@example.com",
          department: "Academics",
        },
      ],
    },
  },

  // ── DownloadList ────────────────────────────────────────────────────────────
  DownloadList: {
    label: "Download List",
    resolvePermissions: resolveComponentPermissions,
    fields: {
      title: { type: "text", label: "Title" },
      subtitle: { type: "textarea", label: "Subtitle" },
      variant: {
        type: "radio",
        label: "Layout",
        options: [
          { label: "List", value: "list" },
          { label: "Grid", value: "grid" },
        ],
      },
      items: {
        type: "array",
        label: "Files",
        getItemSummary: (item: { name?: string }) => item.name || "File",
        arrayFields: {
          name: { type: "text", label: "File Name" },
          description: { type: "text", label: "Description" },
          url: { type: "text", label: "Download URL" },
          type: { type: "text", label: "File Type (e.g. PDF, DOCX)" },
          size: { type: "text", label: "File Size (e.g. 2.4 MB)" },
        },
        defaultItemProps: { name: "Document", url: "#", type: "PDF" },
      },
    },
    render: ({
      title,
      subtitle,
      variant = "list",
      items = [],
    }: DownloadListProps) => {
      const typeColors: Record<string, string> = {
        pdf: "bg-red-50 text-red-700 border-red-200",
        docx: "bg-blue-50 text-blue-700 border-blue-200",
        xlsx: "bg-green-50 text-green-700 border-green-200",
        png: "bg-purple-50 text-purple-700 border-purple-200",
        jpg: "bg-orange-50 text-orange-700 border-orange-200",
        zip: "bg-yellow-50 text-yellow-700 border-yellow-200",
      };

      const typeColor = (t?: string) => {
        const key = (t ?? "").toLowerCase();
        return typeColors[key] ?? "bg-gray-50 text-gray-600 border-gray-200";
      };

      if (variant === "grid") {
        return (
          <section className="w-full px-4 py-10">
            {title && (
              <h2 className="mb-2 font-bold text-2xl text-gray-900">{title}</h2>
            )}
            {subtitle && <p className="mb-6 text-gray-500">{subtitle}</p>}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((item, i) => (
                <a
                  className="group flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-5 transition hover:border-blue-200 hover:shadow-md"
                  download
                  href={item.url || "#"}
                  key={i}
                >
                  <div className="flex items-start justify-between">
                    <FileText className="h-8 w-8 text-gray-400 transition group-hover:text-blue-500" />
                    {item.type && (
                      <span
                        className={`rounded border px-2 py-0.5 font-semibold text-xs uppercase ${typeColor(item.type)}`}
                      >
                        {item.type}
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{item.name}</p>
                    {item.description && (
                      <p className="mt-0.5 text-gray-500 text-sm">
                        {item.description}
                      </p>
                    )}
                    {item.size && (
                      <p className="mt-1 text-gray-400 text-xs">{item.size}</p>
                    )}
                  </div>
                  <div className="mt-auto flex items-center gap-1.5 font-medium text-blue-600 text-sm">
                    <Download className="h-4 w-4" />
                    Download
                  </div>
                </a>
              ))}
            </div>
          </section>
        );
      }

      return (
        <section className="w-full px-4 py-10">
          {title && (
            <h2 className="mb-2 font-bold text-2xl text-gray-900">{title}</h2>
          )}
          {subtitle && <p className="mb-6 text-gray-500">{subtitle}</p>}
          <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
            {items.map((item, i) => (
              <div className="flex items-center gap-4 px-4 py-3.5" key={i}>
                <FileText className="h-5 w-5 shrink-0 text-gray-400" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-gray-900">
                    {item.name}
                  </p>
                  {item.description && (
                    <p className="truncate text-gray-500 text-sm">
                      {item.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {item.size && (
                    <span className="text-gray-400 text-xs">{item.size}</span>
                  )}
                  {item.type && (
                    <span
                      className={`rounded border px-2 py-0.5 font-semibold text-xs uppercase ${typeColor(item.type)}`}
                    >
                      {item.type}
                    </span>
                  )}
                  <a
                    className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 font-medium text-gray-700 text-sm transition hover:border-blue-300 hover:bg-gray-50 hover:text-blue-600"
                    download
                    href={item.url || "#"}
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download
                  </a>
                </div>
              </div>
            ))}
          </div>
        </section>
      );
    },
    defaultProps: {
      title: "Resources",
      subtitle: "Download the files you need.",
      variant: "list" as const,
      items: [
        {
          name: "Brand Guidelines",
          description: "Official brand assets and usage guidelines.",
          url: "#",
          type: "PDF",
          size: "2.4 MB",
        },
        {
          name: "Annual Report 2024",
          description: "Full financial and activity report.",
          url: "#",
          type: "PDF",
          size: "4.1 MB",
        },
      ],
    },
  },

  // ── NumberedSteps ────────────────────────────────────────────────────────────
  NumberedSteps: {
    label: "Numbered Steps",
    resolvePermissions: resolveComponentPermissions,
    fields: {
      title: { type: "text", label: "Title", contentEditable: true } as any,
      subtitle: { type: "textarea", label: "Subtitle", contentEditable: true },
      variant: {
        type: "select",
        label: "Layout",
        options: [
          { label: "Vertical", value: "vertical" },
          { label: "Horizontal", value: "horizontal" },
          { label: "Cards", value: "cards" },
        ],
      },
      steps: {
        type: "array",
        label: "Steps",
        getItemSummary: (item: { title?: string }) => item.title || "Step",
        arrayFields: {
          title: { type: "text", label: "Step Title" },
          description: { type: "textarea", label: "Description" },
        },
        defaultItemProps: {
          title: "Step Title",
          description: "What happens in this step.",
        },
      },
    },
    render: ({
      title,
      subtitle,
      variant = "vertical",
      steps = [],
    }: NumberedStepsProps) => {
      if (variant === "horizontal") {
        return (
          <section className="w-full px-4 py-12">
            {(title || subtitle) && (
              <div className="mb-10 text-center">
                {title && (
                  <h2 className="mb-2 font-bold text-3xl text-gray-900">
                    {title}
                  </h2>
                )}
                {subtitle && (
                  <p className="text-gray-500 text-lg">{subtitle}</p>
                )}
              </div>
            )}
            <div className="mx-auto max-w-5xl">
              <div className="flex items-start gap-0">
                {steps.map((step, i) => (
                  <div className="relative flex-1" key={i}>
                    {i < steps.length - 1 && (
                      <div className="absolute top-5 right-0 left-1/2 h-px bg-gray-200" />
                    )}
                    <div className="flex flex-col items-center px-4 text-center">
                      <div className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 font-bold text-sm text-white shadow">
                        {i + 1}
                      </div>
                      <h3 className="mt-3 font-semibold text-gray-900">
                        {step.title}
                      </h3>
                      {step.description && (
                        <p className="mt-1 text-gray-500 text-sm">
                          {step.description}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        );
      }

      if (variant === "cards") {
        return (
          <section className="w-full px-4 py-12">
            {(title || subtitle) && (
              <div className="mb-10 text-center">
                {title && (
                  <h2 className="mb-2 font-bold text-3xl text-gray-900">
                    {title}
                  </h2>
                )}
                {subtitle && (
                  <p className="text-gray-500 text-lg">{subtitle}</p>
                )}
              </div>
            )}
            <div className="mx-auto grid max-w-5xl gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {steps.map((step, i) => (
                <div
                  className="relative rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"
                  key={i}
                >
                  <span className="absolute -top-3 -left-3 flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 font-bold text-white text-xs shadow-md">
                    {i + 1}
                  </span>
                  <h3 className="mt-2 font-semibold text-gray-900">
                    {step.title}
                  </h3>
                  {step.description && (
                    <p className="mt-2 text-gray-500 text-sm">
                      {step.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        );
      }

      // Vertical (default)
      return (
        <section className="w-full px-4 py-12">
          {(title || subtitle) && (
            <div className="mb-10">
              {title && (
                <h2 className="mb-2 font-bold text-3xl text-gray-900">
                  {title}
                </h2>
              )}
              {subtitle && <p className="text-gray-500 text-lg">{subtitle}</p>}
            </div>
          )}
          <div className="max-w-2xl space-y-0">
            {steps.map((step, i) => (
              <div className="flex gap-5" key={i}>
                <div className="flex flex-col items-center">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 font-bold text-sm text-white">
                    {i + 1}
                  </div>
                  {i < steps.length - 1 && (
                    <div
                      className="mt-1 w-px flex-1 bg-gray-200"
                      style={{ minHeight: "2rem" }}
                    />
                  )}
                </div>
                <div className="pb-8">
                  <h3 className="font-semibold text-gray-900">{step.title}</h3>
                  {step.description && (
                    <p className="mt-1 text-gray-600 text-sm">
                      {step.description}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      );
    },
    defaultProps: {
      title: "How it works",
      subtitle: "Follow these steps to get started.",
      variant: "vertical" as const,
      steps: [
        {
          title: "Create an account",
          description: "Sign up with your student email.",
        },
        {
          title: "Complete your profile",
          description: "Add your details and preferences.",
        },
        {
          title: "Explore opportunities",
          description: "Browse events, jobs, and units.",
        },
      ],
    },
  },

  // ── TagList ──────────────────────────────────────────────────────────────────
  TagList: {
    label: "Tag List",
    fields: {
      title: { type: "text", label: "Label / Prefix" },
      variant: {
        type: "select",
        label: "Style",
        options: [
          { label: "Default (subtle)", value: "default" },
          { label: "Outline", value: "outline" },
          { label: "Solid", value: "solid" },
          { label: "Gradient", value: "gradient" },
        ],
      },
      size: {
        type: "radio",
        label: "Size",
        options: [
          { label: "Small", value: "sm" },
          { label: "Medium", value: "md" },
          { label: "Large", value: "lg" },
        ],
      },
      align: {
        type: "radio",
        label: "Alignment",
        options: [
          { label: "Left", value: "left" },
          { label: "Center", value: "center" },
          { label: "Right", value: "right" },
        ],
      },
      tags: {
        type: "array",
        label: "Tags",
        getItemSummary: (item: { label?: string }) => item.label || "Tag",
        arrayFields: {
          label: { type: "text", label: "Label" },
          href: { type: "text", label: "Link (optional)" },
        },
        defaultItemProps: { label: "Tag" },
      },
    },
    render: ({
      title,
      variant = "default",
      size = "md",
      align = "left",
      tags = [],
    }: TagListProps) => {
      const sizeClass = {
        sm: "px-2.5 py-0.5 text-xs",
        md: "px-3 py-1 text-sm",
        lg: "px-4 py-1.5 text-base",
      };
      const alignClass = {
        left: "justify-start",
        center: "justify-center",
        right: "justify-end",
      };
      const variantClass: Record<string, string> = {
        default: "bg-gray-100 text-gray-700 hover:bg-gray-200",
        outline:
          "border border-gray-300 text-gray-700 hover:border-blue-400 hover:text-blue-600",
        solid: "bg-blue-600 text-white hover:bg-blue-700",
        gradient: "bg-linear-to-r from-blue-600 to-indigo-600 text-white",
      };

      return (
        <div className="px-4 py-3">
          {title && (
            <span className="mr-3 font-medium text-gray-600 text-sm">
              {title}
            </span>
          )}
          <div
            className={`flex flex-wrap gap-2 ${alignClass[align] ?? "justify-start"} ${title ? "mt-2" : ""}`}
          >
            {tags.map((tag, i) => {
              const cls = `inline-flex items-center rounded-full font-medium transition ${sizeClass[size] ?? sizeClass.md} ${variantClass[variant] ?? variantClass.default}`;
              return tag.href ? (
                <a className={cls} href={tag.href} key={i}>
                  {tag.label}
                </a>
              ) : (
                <span className={cls} key={i}>
                  {tag.label}
                </span>
              );
            })}
          </div>
        </div>
      );
    },
    defaultProps: {
      title: "",
      variant: "default" as const,
      size: "md" as const,
      align: "left" as const,
      tags: [
        { label: "Student Union" },
        { label: "Events" },
        { label: "Oslo" },
        { label: "Open to all" },
      ],
    },
  },

  // ── AlertCard ────────────────────────────────────────────────────────────────
  AlertCard: {
    label: "Alert Card",
    fields: {
      title: { type: "text", label: "Title", contentEditable: true } as any,
      content: { type: "textarea", label: "Content", contentEditable: true },
      variant: {
        type: "select",
        label: "Variant",
        options: [
          { label: "Info (blue)", value: "info" },
          { label: "Warning (amber)", value: "warning" },
          { label: "Success (green)", value: "success" },
          { label: "Error (red)", value: "error" },
          { label: "Neutral (gray)", value: "neutral" },
        ],
      },
      icon: {
        type: "radio",
        label: "Show Icon",
        options: [
          { label: "Yes", value: true },
          { label: "No", value: false },
        ],
      },
      ctaLabel: { type: "text", label: "Button Label (optional)" },
      ctaHref: { type: "text", label: "Button Link" },
    },
    render: ({
      title,
      content,
      variant = "info",
      icon = true,
      ctaLabel,
      ctaHref,
    }: AlertCardProps) => {
      const styles: Record<
        string,
        {
          wrapper: string;
          icon: string;
          title: string;
          text: string;
          btn: string;
        }
      > = {
        info: {
          wrapper: "bg-blue-50 border-blue-200",
          icon: "text-blue-500",
          title: "text-blue-800",
          text: "text-blue-700",
          btn: "bg-blue-100 text-blue-700 hover:bg-blue-200",
        },
        warning: {
          wrapper: "bg-amber-50 border-amber-200",
          icon: "text-amber-500",
          title: "text-amber-800",
          text: "text-amber-700",
          btn: "bg-amber-100 text-amber-700 hover:bg-amber-200",
        },
        success: {
          wrapper: "bg-emerald-50 border-emerald-200",
          icon: "text-emerald-500",
          title: "text-emerald-800",
          text: "text-emerald-700",
          btn: "bg-emerald-100 text-emerald-700 hover:bg-emerald-200",
        },
        error: {
          wrapper: "bg-red-50 border-red-200",
          icon: "text-red-500",
          title: "text-red-800",
          text: "text-red-700",
          btn: "bg-red-100 text-red-700 hover:bg-red-200",
        },
        neutral: {
          wrapper: "bg-gray-50 border-gray-200",
          icon: "text-gray-500",
          title: "text-gray-800",
          text: "text-gray-600",
          btn: "bg-gray-100 text-gray-700 hover:bg-gray-200",
        },
      };

      const iconPaths: Record<string, string> = {
        info: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
        warning:
          "M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z",
        success: "M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
        error:
          "M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
        neutral:
          "M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z",
      };

      const s = styles[variant] ?? styles.info;

      return (
        <div className={`w-full rounded-xl border p-5 ${s.wrapper}`}>
          <div className="flex gap-3">
            {icon && (
              <svg
                className={`mt-0.5 h-5 w-5 shrink-0 ${s.icon}`}
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                viewBox="0 0 24 24"
              >
                <path
                  d={iconPaths[variant] ?? iconPaths.info}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
            <div className="flex-1">
              {title && <h4 className={`font-semibold ${s.title}`}>{title}</h4>}
              {content && <p className={`mt-1 text-sm ${s.text}`}>{content}</p>}
              {ctaLabel && ctaHref && (
                <a
                  className={`mt-3 inline-block rounded-md px-3 py-1.5 font-medium text-sm transition ${s.btn}`}
                  href={ctaHref}
                >
                  {ctaLabel}
                </a>
              )}
            </div>
          </div>
        </div>
      );
    },
    defaultProps: {
      title: "Important notice",
      content:
        "Please read this carefully before proceeding. This information is important for your application.",
      variant: "info" as const,
      icon: true,
    },
  },

  // ── ChecklistCard ────────────────────────────────────────────────────────────
  ChecklistCard: {
    label: "Checklist Card",
    resolvePermissions: resolveComponentPermissions,
    fields: {
      title: { type: "text", label: "Title", contentEditable: true } as any,
      description: { type: "textarea", label: "Description" },
      variant: {
        type: "select",
        label: "Card Style",
        options: [
          { label: "Default", value: "default" },
          { label: "Bordered", value: "bordered" },
          { label: "Tinted", value: "tinted" },
        ],
      },
      checkStyle: {
        type: "radio",
        label: "Check Style",
        options: [
          { label: "Circle check", value: "circle" },
          { label: "Square", value: "square" },
          { label: "Arrow", value: "arrow" },
        ],
      },
      items: {
        type: "array",
        label: "Items",
        getItemSummary: (item: { text?: string }) => item.text || "Item",
        arrayFields: {
          text: { type: "text", label: "Item Text" },
          checked: {
            type: "radio",
            label: "Checked",
            options: [
              { label: "Yes", value: true },
              { label: "No", value: false },
            ],
          },
        },
        defaultItemProps: { text: "Item text", checked: false },
      },
      ctaLabel: { type: "text", label: "Button Label (optional)" },
      ctaHref: { type: "text", label: "Button Link" },
    },
    render: ({
      title,
      description,
      variant = "default",
      checkStyle = "circle",
      items = [],
      ctaLabel,
      ctaHref,
    }: ChecklistCardProps) => {
      const wrapperClass =
        variant === "bordered"
          ? "rounded-2xl border-2 border-gray-200 bg-white p-6"
          : variant === "tinted"
            ? "rounded-2xl bg-blue-50 p-6"
            : "rounded-2xl border border-gray-100 bg-white p-6 shadow-sm";

      const CheckIcon = () => {
        if (checkStyle === "square") {
          return (
            <svg
              className="h-4 w-4 text-blue-600"
              fill="currentColor"
              viewBox="0 0 16 16"
            >
              <path className="text-blue-100" d="M2 2h12v12H2z" />
              <path
                d="M5 8l2.5 2.5L11 5.5"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
              />
            </svg>
          );
        }
        if (checkStyle === "arrow") {
          return (
            <svg
              className="h-4 w-4 text-blue-600"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                d="M13 7l5 5m0 0l-5 5m5-5H6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          );
        }
        return <CheckCheck className="h-4 w-4 text-blue-600" />;
      };

      return (
        <div className={`w-full ${wrapperClass}`}>
          {title && (
            <h3 className="font-semibold text-gray-900 text-lg">{title}</h3>
          )}
          {description && (
            <p className="mt-1.5 text-gray-500 text-sm">{description}</p>
          )}
          <ul className="mt-4 space-y-2.5">
            {items.map((item, i) => (
              <li className="flex items-start gap-3" key={i}>
                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                    item.checked === false ? "bg-gray-100" : "bg-blue-100"
                  }`}
                >
                  {item.checked === false ? (
                    <span className="h-2 w-2 rounded-full bg-gray-300" />
                  ) : (
                    <CheckIcon />
                  )}
                </span>
                <span
                  className={`text-sm ${item.checked === false ? "text-gray-500" : "text-gray-700"}`}
                >
                  {item.text}
                </span>
              </li>
            ))}
          </ul>
          {ctaLabel && ctaHref && (
            <a
              className="mt-5 inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 font-medium text-sm text-white transition hover:bg-blue-700"
              href={ctaHref}
            >
              {ctaLabel}
            </a>
          )}
        </div>
      );
    },
    defaultProps: {
      title: "Requirements",
      description: "Make sure you meet the following criteria.",
      variant: "default" as const,
      checkStyle: "circle" as const,
      items: [
        {
          text: "You are enrolled at BI Norwegian Business School",
          checked: true,
        },
        { text: "You are a current semester student", checked: true },
        { text: "You have an active student email address", checked: true },
        { text: "You have not received this grant before", checked: false },
      ],
    },
  },
} as const;
