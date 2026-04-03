"use client";
import { createUsePuck } from "@puckeditor/core";

const usePuck = createUsePuck();

import {
  FeatureGrid,
  type FeatureGridProps,
  type FeatureItem,
} from "@repo/ui/components/puck/feature-grid";
import {
  LogoGrid,
  type LogoGridProps,
  type LogoItem,
} from "@repo/ui/components/puck/logo-grid";
import {
  type StatItem,
  StatsGrid,
  type StatsGridProps,
} from "@repo/ui/components/puck/stats-grid";
import {
  TeamGrid,
  type TeamGridProps,
  type TeamMember,
} from "@repo/ui/components/puck/team-grid";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { cn } from "@repo/ui/lib/utils";
import { Database, Table, X } from "lucide-react";
import { TABLE_SCHEMAS } from "../data/schemas";
import { ALIGN_OPTIONS, ICON_OPTIONS } from "../puck-tokens";
import type {
  EditorMetadata,
  GridDataBinding,
  GridPreset,
  GridProps,
} from "./types";

export const GridComponents = {
  FeatureGrid: {
    label: "Feature Grid",
    resolveFields: (data: any): any => {
      const variant = data.props.variant ?? "card";
      const base: Record<string, unknown> = {
        title: { type: "text", contentEditable: true } as any,
        subtitle: { type: "textarea", contentEditable: true },
        variant: {
          type: "select",
          options: [
            { label: "Card", value: "card" },
            { label: "Icon", value: "icon" },
            { label: "Simple", value: "simple" },
            { label: "Checklist", value: "checklist" },
            { label: "Project", value: "project" },
            { label: "Process", value: "process" },
            { label: "Benefit scroll (horizontal)", value: "benefit-scroll" },
            { label: "Link tiles (compact)", value: "link-tiles" },
          ],
        },
        align: { type: "radio", options: ALIGN_OPTIONS },
      };

      if (variant !== "benefit-scroll" && variant !== "link-tiles") {
        base.columns = {
          type: "select",
          options: [
            { label: "2", value: 2 },
            { label: "3", value: 3 },
            { label: "4", value: 4 },
          ],
        };
      }

      base.items = {
        type: "array",
        getItemSummary: (item: { title?: string }) => item.title || "Feature",
        arrayFields: {
          title: { type: "text" },
          description: { type: "textarea" },
          badge: { type: "text" },
          icon: { type: "select", options: ICON_OPTIONS },
          href: { type: "link" } as any,
        },
      };

      if (variant === "benefit-scroll") {
        // Benefit scroll items can have bullet lists
        base.items = {
          type: "array",
          getItemSummary: (item: { title?: string }) => item.title || "Benefit",
          arrayFields: {
            title: { type: "text" },
            description: { type: "textarea" },
            icon: { type: "select", options: ICON_OPTIONS },
            bullets: {
              type: "array",
              label: "Bullet points",
              getItemSummary: (item: { text?: string }) =>
                item.text || "Bullet",
              arrayFields: { text: { type: "text" } },
            },
            href: { type: "link" } as any,
          },
        };
      }

      return base;
    },
    render: (props: FeatureGridProps & { variant?: string; items?: any[] }) => {
      const variant = props.variant as string | undefined;
      const items: any[] = (props as any).items ?? [];

      if (variant === "benefit-scroll") {
        return (
          <section className="w-full px-4 py-10">
            {props.title && (
              <h2 className="mb-2 font-bold text-2xl text-gray-900">
                {props.title}
              </h2>
            )}
            {props.subtitle && (
              <p className="mb-6 text-gray-500">{props.subtitle}</p>
            )}
            <div className="-mx-4 flex snap-x snap-mandatory gap-5 overflow-x-auto px-4 pb-4">
              {items.map((item: any, i: number) => (
                <div
                  className="min-w-[280px] max-w-[320px] shrink-0 snap-start rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"
                  key={i}
                >
                  {item.icon && (
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 font-bold text-blue-600 text-lg">
                      {item.icon.charAt(0)}
                    </div>
                  )}
                  <h3 className="font-semibold text-gray-900">{item.title}</h3>
                  {item.description && (
                    <p className="mt-1 text-gray-500 text-sm">
                      {item.description}
                    </p>
                  )}
                  {item.bullets && item.bullets.length > 0 && (
                    <ul className="mt-3 space-y-1.5">
                      {item.bullets.map((b: { text: string }, bi: number) => (
                        <li
                          className="flex items-start gap-2 text-gray-600 text-sm"
                          key={bi}
                        >
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />
                          {b.text}
                        </li>
                      ))}
                    </ul>
                  )}
                  {item.href && (
                    <a
                      className="mt-4 inline-block font-medium text-blue-600 text-sm hover:text-blue-800"
                      href={item.href}
                    >
                      Learn more →
                    </a>
                  )}
                </div>
              ))}
            </div>
          </section>
        );
      }

      if (variant === "link-tiles") {
        return (
          <section className="w-full px-4 py-8">
            {props.title && (
              <h2 className="mb-4 font-semibold text-gray-900 text-lg">
                {props.title}
              </h2>
            )}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {items.map((item: any, i: number) => (
                <a
                  className="group flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 font-medium text-gray-700 text-sm shadow-sm transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                  href={item.href || "#"}
                  key={i}
                >
                  {item.icon && (
                    <span className="text-base text-gray-400 transition group-hover:text-blue-500">
                      {item.icon.charAt(0)}
                    </span>
                  )}
                  <span className="truncate">{item.title}</span>
                </a>
              ))}
            </div>
          </section>
        );
      }

      return <FeatureGrid {...props} />;
    },
    defaultProps: {
      columns: 3,
      variant: "card",
      align: "center",
      items: [
        { title: "Feature 1", description: "Description 1", icon: "Sparkles" },
        { title: "Feature 2", description: "Description 2", icon: "Zap" },
        { title: "Feature 3", description: "Description 3", icon: "Crown" },
      ] as FeatureItem[],
    },
  },
  StatsGrid: {
    label: "Stats Grid",
    fields: {
      columns: {
        type: "select",
        options: [
          { label: "2", value: 2 },
          { label: "3", value: 3 },
          { label: "4", value: 4 },
        ],
      },
      variant: {
        type: "select",
        options: [
          { label: "Simple", value: "simple" },
          { label: "Card", value: "card" },
          { label: "Floating", value: "floating" },
        ],
      },
      align: {
        type: "radio",
        options: ALIGN_OPTIONS,
      },
      items: {
        type: "array",
        getItemSummary: (item: { label?: string }) => item.label || "Stat",
        arrayFields: {
          value: { type: "text" },
          label: { type: "text" },
          description: { type: "text" },
          icon: {
            type: "select",
            options: ICON_OPTIONS,
          },
        },
      },
    },
    render: (props: StatsGridProps) => <StatsGrid {...props} />,
    defaultProps: {
      columns: 4,
      variant: "simple",
      items: [
        { value: "100+", label: "Events" },
        { value: "50+", label: "Partners" },
        { value: "1000+", label: "Members" },
        { value: "24/7", label: "Support" },
      ] as StatItem[],
    },
  },
  TeamGrid: {
    label: "Team Grid",
    fields: {
      columns: {
        type: "select",
        options: [
          { label: "2", value: 2 },
          { label: "3", value: 3 },
          { label: "4", value: 4 },
        ],
      },
      variant: {
        type: "select",
        options: [
          { label: "Card", value: "card" },
          { label: "Minimal", value: "minimal" },
        ],
      },
      members: {
        type: "array",
        getItemSummary: (item: { name?: string }) => item.name || "Member",
        arrayFields: {
          name: { type: "text" },
          role: { type: "text" },
          image: { type: "image" } as any,
          bio: { type: "textarea" },
          email: { type: "text" },
          linkedin: { type: "text" },
        },
      },
    },
    render: (props: TeamGridProps) => <TeamGrid {...props} />,
    defaultProps: {
      columns: 3,
      variant: "card",
      members: [
        {
          name: "John Doe",
          role: "President",
          image:
            "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400",
        },
        {
          name: "Jane Smith",
          role: "VP",
          image:
            "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400",
        },
        {
          name: "Bob Johnson",
          role: "Treasurer",
          image:
            "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400",
        },
      ] as TeamMember[],
    },
  },
  LogoGrid: {
    label: "Logo Grid",
    fields: {
      columns: {
        type: "select",
        options: [
          { label: "3", value: 3 },
          { label: "4", value: 4 },
          { label: "5", value: 5 },
          { label: "6", value: 6 },
        ],
      },
      variant: {
        type: "select",
        options: [
          { label: "Bordered", value: "bordered" },
          { label: "Card", value: "card" },
          { label: "Simple", value: "simple" },
        ],
      },
      grayscale: {
        type: "radio",
        options: [
          { label: "Yes", value: true },
          { label: "No", value: false },
        ],
      },
      items: {
        type: "array",
        getItemSummary: (item: { alt?: string }) => item.alt || "Logo",
        arrayFields: {
          image: { type: "image" } as any,
          alt: { type: "text" },
          href: { type: "link" } as any,
        },
      },
    },
    render: (props: LogoGridProps) => <LogoGrid {...props} />,
    defaultProps: {
      columns: 4,
      variant: "bordered",
      grayscale: true,
      items: [
        {
          alt: "Partner 1",
          image: "https://via.placeholder.com/150x80?text=Logo+1",
        },
        {
          alt: "Partner 2",
          image: "https://via.placeholder.com/150x80?text=Logo+2",
        },
        {
          alt: "Partner 3",
          image: "https://via.placeholder.com/150x80?text=Logo+3",
        },
        {
          alt: "Partner 4",
          image: "https://via.placeholder.com/150x80?text=Logo+4",
        },
      ] as LogoItem[],
    },
  },
} as const;

// ─── Grid Data Picker ────────────────────────────────────────────────
//
// A custom field rendered when Grid.dataMode === "table".
// Reads user permissions from Puck's metadata (EditorMetadata) to filter
// which tables are shown, matching the same logic as the old DataSources panel.
//
// Visual reference for the Grid component layouts:
//   - "cards"    → apps/web/src/app/(public)/campus/components/overview/ (event/news cards)
//   - "masonry"  → apps/web/src/app/(public)/news/page.tsx (article grid)
//   - "featured" → apps/web/src/components/home/hero-section.tsx (hero + feature grid)

function GridDataPicker({
  value,
  onChange,
}: {
  value: GridDataBinding | null | undefined;
  onChange: (next: GridDataBinding | null) => void;
}) {
  const appState = usePuck((s) => s.appState);
  const metadata = (appState as { metadata?: EditorMetadata }).metadata;
  const isAdmin = metadata?.user?.isGlobalAdmin ?? false;
  const isCampusAdmin = metadata?.user?.isCampusAdmin ?? false;

  // Same RBAC filtering as the removed DataSources panel
  const availableSchemas =
    isAdmin || isCampusAdmin
      ? TABLE_SCHEMAS
      : TABLE_SCHEMAS.filter((s) =>
          ["news", "events", "jobs", "departments"].includes(s.id)
        );

  if (value?.tableId) {
    // Show currently bound table with a clear button
    const schema = TABLE_SCHEMAS.find((s) => s.id === value.tableId);
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 p-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10">
            <Table className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-medium text-foreground text-sm">
              {schema?.label ?? value.tableId}
            </div>
            <div className="truncate text-muted-foreground text-xs">
              {schema?.description ?? "Connected table"}
            </div>
          </div>
          <Button
            className="h-7 w-7 shrink-0"
            onClick={() => onChange(null)}
            size="icon"
            variant="ghost"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
        <p className="text-muted-foreground text-xs">
          The grid will render placeholder cards in the editor. Live data loads
          on the public site.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-muted-foreground text-xs">
        Select a table to bind this grid to live data.
      </p>
      <div className="grid gap-1.5">
        {availableSchemas.map((schema) => (
          <button
            className={cn(
              "flex w-full items-center gap-3 rounded-lg border border-border bg-card p-3 text-left",
              "transition-colors hover:border-primary/40 hover:bg-primary/5",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            )}
            key={schema.id}
            onClick={() =>
              onChange({
                tableId: schema.id,
                tableLabel: schema.label,
                limit: 6,
                sortField: schema.defaultSort?.field,
                sortDirection: schema.defaultSort?.direction,
              })
            }
            type="button"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gray-100 dark:bg-gray-800">
              <Database className="h-4 w-4 text-gray-500" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-medium text-foreground text-sm">
                {schema.label}
              </div>
              <div className="truncate text-muted-foreground text-xs">
                {schema.description}
              </div>
            </div>
            <Badge className="shrink-0" variant="secondary">
              {schema.fields.length} fields
            </Badge>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Grid Preset Preview ─────────────────────────────────────────────

function GridPresetPreview({
  preset,
  columns = 3,
  items,
  dataMode,
  dataSource,
  title,
  subtitle,
}: GridProps) {
  const resolvedItems =
    dataMode === "table" && dataSource
      ? // Placeholder skeletons for data-bound mode
        Array.from({ length: Math.min(dataSource.limit ?? 6, 6) }, (_, i) => ({
          title: undefined,
          description: undefined,
          image: undefined,
          badge: undefined,
          href: undefined,
          _placeholder: true as const,
          _index: i,
        }))
      : (items ?? []).map((item) => ({
          ...item,
          _placeholder: false as const,
          _index: 0,
        }));

  const isBound = dataMode === "table" && dataSource;

  return (
    <div className="w-full space-y-4 py-6">
      {(title || subtitle) && (
        <div className="space-y-1 text-center">
          {title && (
            <div className="font-bold text-foreground text-xl">{title}</div>
          )}
          {subtitle && (
            <div className="text-muted-foreground text-sm">{subtitle}</div>
          )}
        </div>
      )}

      {isBound && (
        <div className="flex items-center justify-center gap-2 rounded-md border border-primary/40 border-dashed bg-primary/5 px-3 py-1.5">
          <Database className="h-3.5 w-3.5 text-primary" />
          <span className="font-medium text-primary text-xs">
            Bound to <strong>{dataSource!.tableLabel}</strong> — showing
            placeholders
          </span>
        </div>
      )}

      {preset === "featured" ? (
        // Featured: large hero + smaller cells
        <div className="grid grid-cols-3 gap-3">
          <GridCard item={resolvedItems[0]} large />
          <div className="col-span-1 grid grid-rows-2 gap-3">
            {resolvedItems.slice(1, 3).map((item, i) => (
              <GridCard item={item} key={i} />
            ))}
          </div>
        </div>
      ) : preset === "masonry" ? (
        // Masonry: alternating heights
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
        >
          {resolvedItems.map((item, i) => (
            <GridCard item={item} key={i} tall={i % 3 === 0} />
          ))}
        </div>
      ) : (
        // Cards (default): uniform grid
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
        >
          {resolvedItems.map((item, i) => (
            <GridCard item={item} key={i} />
          ))}
        </div>
      )}
    </div>
  );
}

function GridCard({
  item,
  large,
  tall,
}: {
  item: {
    title?: string;
    description?: string;
    image?: string;
    badge?: string;
    _placeholder?: boolean;
  };
  large?: boolean;
  tall?: boolean;
}) {
  const isPlaceholder = item._placeholder;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-card",
        large && "col-span-2"
      )}
    >
      <div
        className={cn(
          "w-full bg-muted",
          large ? "h-48" : tall ? "h-36" : "h-28",
          isPlaceholder && "animate-pulse"
        )}
      >
        {!isPlaceholder && item.image && (
          <img
            alt={item.title ?? ""}
            className="h-full w-full object-cover"
            src={item.image}
          />
        )}
      </div>
      <div className="space-y-1 p-3">
        {isPlaceholder ? (
          <>
            <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
            <div className="h-2.5 w-1/2 animate-pulse rounded bg-muted" />
          </>
        ) : (
          <>
            {item.badge && (
              <Badge className="mb-1 text-[10px]" variant="secondary">
                {item.badge}
              </Badge>
            )}
            {item.title && (
              <div className="font-semibold text-foreground text-sm leading-snug">
                {item.title}
              </div>
            )}
            {item.description && (
              <div className="line-clamp-2 text-muted-foreground text-xs">
                {item.description}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Grid Puck Component ─────────────────────────────────────────────

// The Grid component's `fields` object has many field type literals that TypeScript widens
// to `string` in the static declaration. The `as any` cast on the export suppresses the
// resulting Config<Props> mismatch — all field types are runtime-correct. Track in:
// TODO: migrate GridComponent.Grid.fields to use `as const` on each type property.
export const GridComponent = {
  Grid: {
    label: "Grid",
    fields: {
      preset: {
        type: "select",
        label: "Layout Preset",
        options: [
          { label: "Cards — equal columns", value: "cards" },
          { label: "Masonry — variable heights", value: "masonry" },
          { label: "Featured — hero + supporting", value: "featured" },
        ],
      },
      columns: {
        type: "select",
        label: "Columns",
        options: [
          { label: "2", value: 2 },
          { label: "3", value: 3 },
          { label: "4", value: 4 },
        ],
      } as any,
      title: { type: "text", label: "Title", contentEditable: true } as any,
      subtitle: {
        type: "textarea",
        label: "Subtitle",
        contentEditable: true,
      } as any,
      dataMode: {
        type: "select",
        label: "Data Mode",
        options: [
          { label: "Manual — populate items by hand", value: "manual" },
          { label: "Load from table — bind to live data", value: "table" },
        ],
      },
      // dataSource is conditionally shown via resolveFields
      dataSource: {
        type: "custom",
        label: "Table",
        render: ({
          value,
          onChange,
        }: {
          value: GridDataBinding | null;
          onChange: (v: GridDataBinding | null) => void;
        }) => <GridDataPicker onChange={onChange} value={value} />,
      },
      items: {
        type: "array" as const,
        label: "Items",
        getItemSummary: (item: { title?: string }) => item.title || "Item",
        arrayFields: {
          title: { type: "text" as const },
          description: { type: "textarea" as const },
          image: { type: "image" } as any,
          badge: { type: "text" as const },
          href: { type: "link" } as any,
        },
      },
    },
    // Hide dataSource when manual, hide items when bound to a table
    resolveFields: async (
      data: { props: GridProps },
      { fields }: { fields: Record<string, unknown> }
    ) => {
      const mode = data.props?.dataMode ?? "manual";
      const { dataSource, items, ...base } = fields as any;
      if (mode === "table") {
        return { ...base, dataSource };
      }
      return { ...base, items };
    },
    render: (props: GridProps) => <GridPresetPreview {...props} />,
    defaultProps: {
      preset: "cards" as GridPreset,
      columns: 3,
      dataMode: "manual",
      dataSource: null,
      title: "",
      subtitle: "",
      items: [
        { title: "Item 1", description: "Description for item 1" },
        { title: "Item 2", description: "Description for item 2" },
        { title: "Item 3", description: "Description for item 3" },
      ],
    } satisfies GridProps,
  },
};
