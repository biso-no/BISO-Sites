"use client";
import {
  type Config,
  registerOverlayPortal,
  type Slot,
} from "@puckeditor/core";
import {
  AccordionBlock,
  type AccordionBlockProps,
} from "@repo/ui/components/puck/accordion";
import {
  ButtonRow,
  type ButtonRowProps,
} from "@repo/ui/components/puck/button-row";
import { Collection } from "@repo/ui/components/puck/collection/collection";
import type { CollectionProps } from "@repo/ui/components/puck/collection/types";
import { LAYOUT_OPTIONS } from "@repo/ui/components/puck/collection/types";
import { Columns, type ColumnsProps } from "@repo/ui/components/puck/columns";
import { CTA, type CTAProps } from "@repo/ui/components/puck/cta";
import { Divider, type DividerProps } from "@repo/ui/components/puck/divider";
import {
  FeatureGrid,
  type FeatureGridProps,
} from "@repo/ui/components/puck/feature-grid";
import {
  FilterBar,
  type FilterBarProps,
} from "@repo/ui/components/puck/filter-bar";
import { FilteredEvents } from "@repo/ui/components/puck/filtered-events";
import { FilteredNews } from "@repo/ui/components/puck/filtered-news";
import { Heading, type HeadingProps } from "@repo/ui/components/puck/heading";
import { Hero, type HeroProps } from "@repo/ui/components/puck/hero";
import {
  Image as PuckImage,
  type ImageProps as PuckImageProps,
} from "@repo/ui/components/puck/image";
import {
  JobsList,
  type JobsListProps,
} from "@repo/ui/components/puck/jobs-list";
import {
  LogoGrid,
  type LogoGridProps,
} from "@repo/ui/components/puck/logo-grid";
import {
  PageHeader,
  type PageHeaderProps,
} from "@repo/ui/components/puck/page-header";
import {
  ProductsGrid,
  type ProductsGridProps,
} from "@repo/ui/components/puck/products-grid";
import {
  RichText,
  type RichTextProps,
} from "@repo/ui/components/puck/rich-text";
import { Section, type SectionProps } from "@repo/ui/components/puck/section";
import { Spacer, type SpacerProps } from "@repo/ui/components/puck/spacer";
import {
  StatsGrid,
  type StatsGridProps,
} from "@repo/ui/components/puck/stats-grid";
import {
  TableOfContents,
  type TableOfContentsProps,
} from "@repo/ui/components/puck/table-of-contents";
import { Tabs, type TabsProps } from "@repo/ui/components/puck/tabs";
import {
  TeamGrid,
  type TeamGridProps,
} from "@repo/ui/components/puck/team-grid";
import { Text, type TextProps } from "@repo/ui/components/puck/text";
import {
  Timeline,
  type TimelineProps,
} from "@repo/ui/components/puck/timeline";
import { About, type AboutProps } from "@repo/ui/components/sections/about";
import type { EventsProps } from "@repo/ui/components/sections/events";
import { JoinUs, type JoinUsProps } from "@repo/ui/components/sections/join-us";
import type { NewsProps } from "@repo/ui/components/sections/news";
import { useEffect, useRef } from "react";
import { TABLE_SCHEMAS } from "./data/schemas";
import { getDynamicContent } from "./get-dynamic-content";
import {
  ALIGN_OPTIONS,
  BUTTON_SIZE_OPTIONS,
  BUTTON_VARIANT_OPTIONS,
  DIVIDER_SPACING_OPTIONS,
  DIVIDER_STYLE_OPTIONS,
  GRADIENT_OPTIONS,
  HEADING_LEVEL_OPTIONS,
  HEADING_SIZE_OPTIONS,
  ICON_OPTIONS,
  IMAGE_ASPECT_OPTIONS,
  IMAGE_ROUNDED_OPTIONS,
  MAX_WIDTH_OPTIONS,
  PADDING_OPTIONS,
  SECTION_BG_OPTIONS,
  TEXT_COLUMNS_OPTIONS,
  TEXT_VARIANT_OPTIONS,
} from "./puck-tokens";

type EditorJoinUsProps = Omit<JoinUsProps, "memberFeatures"> & {
  memberFeatures: { feature: string }[];
};

type EditorCollectionProps = CollectionProps & {
  dataMode?: "manual" | "dynamic";
  dataSource?: {
    table?: string;
    filters?: { field: string; operator: string; value: unknown }[];
    sort?: { field: string; direction: "asc" | "desc" };
    limit?: number;
    offset?: number;
    locale?: string;
  };
  scope?: "page" | "all";
};

type SectionPropsWithSlot = SectionProps & { content?: Slot };
type ColumnsPropsWithSlots = ColumnsProps & {
  "col-0"?: Slot;
  "col-1"?: Slot;
  "col-2"?: Slot;
};

type TabsPropsWithSlots = TabsProps & {
  tab0?: Slot;
  tab1?: Slot;
  tab2?: Slot;
  tab3?: Slot;
};

type HeroPropsWithSlot = HeroProps & {
  rightSlot?: Slot;
  slidesSource?: DataSourceValue;
  statsSource?: DataSourceValue;
  slidesMode?: "manual" | "dynamic";
  statsMode?: "manual" | "dynamic";
  styling?: { padding?: string; className?: string };
};

type DataSourceValue = {
  table?: string;
  filters?: { field: string; operator: string; value: unknown }[];
  sort?: { field: string; direction: "asc" | "desc" };
  limit?: number;
  offset?: number;
  locale?: string;
};

type EditorEventsProps = EventsProps & {
  dataMode?: "manual" | "dynamic";
  dataSource?: DataSourceValue;
  scope?: "page" | "all";
};

type EditorNewsProps = NewsProps & {
  dataMode?: "manual" | "dynamic";
  dataSource?: DataSourceValue;
  scope?: "page" | "all";
};

type EditorJobsListProps = JobsListProps & {
  dataMode?: "manual" | "dynamic";
  dataSource?: DataSourceValue;
  scope?: "page" | "all";
};

type EditorProductsGridProps = ProductsGridProps & {
  dataMode?: "manual" | "dynamic";
  dataSource?: DataSourceValue;
  scope?: "page" | "all";
};

type TimelinePropsWithSlot = TimelineProps & {
  dataMode?: "manual" | "dynamic";
  dataSource?: DataSourceValue;
};

type EditorMetadata = {
  locale?: string;
  page?: { campusId?: string | null; departmentId?: string | null };
};

const resolvedDepartmentIdCache = new Map<string, string>();

async function resolveDepartmentId(rawDepartmentId: string): Promise<string> {
  const cached = resolvedDepartmentIdCache.get(rawDepartmentId);
  if (cached) {
    return cached;
  }

  try {
    // Prefer matching the "Id" (code) field, then fall back to "Name"
    const byCode = await getDynamicContent({
      table: "departments",
      limit: 1,
      filters: [{ field: "Id", operator: "equal", value: rawDepartmentId }],
    });
    const resolvedByCode = byCode[0]?.id;
    if (resolvedByCode) {
      resolvedDepartmentIdCache.set(rawDepartmentId, resolvedByCode);
      return resolvedByCode;
    }

    const byName = await getDynamicContent({
      table: "departments",
      limit: 1,
      filters: [{ field: "Name", operator: "equal", value: rawDepartmentId }],
    });
    const resolvedByName = byName[0]?.id;
    if (resolvedByName) {
      resolvedDepartmentIdCache.set(rawDepartmentId, resolvedByName);
      return resolvedByName;
    }
  } catch {
    // Ignore and fall back to raw ID
  }

  resolvedDepartmentIdCache.set(rawDepartmentId, rawDepartmentId);
  return rawDepartmentId;
}

function mergeFilters(
  base: DataSourceValue["filters"] | undefined,
  extra: DataSourceValue["filters"] | undefined
): DataSourceValue["filters"] {
  const baseFilters = base ?? [];
  const extraFilters = extra ?? [];

  if (baseFilters.length === 0 && extraFilters.length === 0) {
    return [];
  }

  const seen = new Set<string>();
  const merged: DataSourceValue["filters"] = [];

  for (const filter of [...baseFilters, ...extraFilters]) {
    const key = `${filter.field}:${filter.operator}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    merged.push(filter);
  }

  return merged;
}

async function buildPageScopeFilters(
  table: "events" | "news" | "jobs" | "products",
  scope: "page" | "all" | undefined,
  metadata: EditorMetadata | undefined
): Promise<DataSourceValue["filters"]> {
  if (scope !== "page") {
    return [];
  }

  const campusId = metadata?.page?.campusId ?? null;
  const rawDepartmentId = metadata?.page?.departmentId ?? null;

  if (rawDepartmentId) {
    const departmentId = await resolveDepartmentId(rawDepartmentId);
    const departmentField =
      table === "products" ? "departmentId" : "department_id";
    return [{ field: departmentField, operator: "equal", value: departmentId }];
  }

  if (campusId) {
    return [{ field: "campus_id", operator: "equal", value: campusId }];
  }

  return [];
}

const nokFormatter = new Intl.NumberFormat("no-NO", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function formatNokPrice(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return `${nokFormatter.format(value)} NOK`;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return `${nokFormatter.format(parsed)} NOK`;
    }
    return value;
  }

  return;
}

function getMetaString(
  meta: Record<string, unknown>,
  key: string
): string | undefined {
  const value = meta[key];
  return typeof value === "string" ? value : undefined;
}

function getMetaBoolean(
  meta: Record<string, unknown>,
  key: string
): boolean | undefined {
  const value = meta[key];
  return typeof value === "boolean" ? value : undefined;
}

function normalizeSubtitle(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return;
  }

  if (value === "[object Object]") {
    return;
  }

  return value;
}

function deriveJobSlug(
  meta: Record<string, unknown>,
  href: string
): string | undefined {
  const explicit = getMetaString(meta, "slug");
  if (explicit) {
    return explicit;
  }

  if (href.startsWith("/jobs/")) {
    return href.replace("/jobs/", "");
  }

  return;
}

export type Props = {
  Heading: HeadingProps;
  Text: TextProps;
  Image: PuckImageProps;
  ButtonRow: ButtonRowProps;
  Divider: DividerProps;
  Hero: HeroPropsWithSlot;
  About: AboutProps;
  JoinUs: EditorJoinUsProps;
  News: EditorNewsProps;
  Events: EditorEventsProps;
  ProductsGrid: EditorProductsGridProps;
  Section: SectionPropsWithSlot;
  FeatureGrid: FeatureGridProps;
  CTA: CTAProps;
  Columns: ColumnsPropsWithSlots;
  Accordion: AccordionBlockProps;
  Spacer: SpacerProps;
  Tabs: TabsPropsWithSlots;
  StatsGrid: StatsGridProps;
  TeamGrid: TeamGridProps;
  Timeline: TimelinePropsWithSlot;
  LogoGrid: LogoGridProps;
  FilterBar: FilterBarProps;
  JobsList: EditorJobsListProps;
  Collection: EditorCollectionProps;
  RichText: RichTextProps;
  PageHeader: PageHeaderProps;
  TableOfContents: TableOfContentsProps;
};

// Explicitly type the Config with Props to help TS inference
export const config: Config<Props> = {
  root: {
    fields: {
      title: {
        type: "text",
        label: "Page Title",
      },
      slug: {
        type: "text",
        label: "Page Slug",
      },
    },
  },
  categories: {
    basics: {
      title: "Basics",
      components: ["Heading", "Text", "Image", "ButtonRow", "Divider"],
    },
    layout: {
      title: "Layout",
      components: ["Section", "Columns", "Spacer", "Tabs"],
    },
    heroes: {
      title: "Heroes & Headers",
      components: ["Hero", "PageHeader"],
    },
    grids: {
      title: "Grids & Lists",
      components: ["FeatureGrid", "StatsGrid", "TeamGrid", "LogoGrid"],
    },
    content: {
      title: "Content",
      components: ["Accordion", "Timeline", "RichText", "TableOfContents"],
    },
    marketing: {
      title: "Marketing & CTA",
      components: ["CTA", "About", "JoinUs"],
    },
    dataDisplay: {
      title: "Data Display",
      components: [
        "News",
        "Events",
        "JobsList",
        "ProductsGrid",
        "FilterBar",
        "Collection",
      ],
    },
  },
  components: {
    Heading: {
      fields: {
        text: { type: "text", contentEditable: true } as any,
        level: {
          type: "select",
          options: HEADING_LEVEL_OPTIONS,
        },
        size: {
          type: "select",
          options: HEADING_SIZE_OPTIONS,
        },
        align: {
          type: "radio",
          options: ALIGN_OPTIONS,
        },
        id: { type: "text", label: "Anchor ID" },
      },
      render: (props: HeadingProps) => <Heading {...props} />,
      defaultProps: {
        text: "Heading",
        level: 2,
        size: "lg",
        align: "left",
      },
    },
    Text: {
      fields: {
        content: { type: "richtext", contentEditable: true } as any,
        variant: {
          type: "select",
          options: TEXT_VARIANT_OPTIONS,
        },
        columns: {
          type: "radio",
          options: TEXT_COLUMNS_OPTIONS,
        },
        align: {
          type: "radio",
          options: ALIGN_OPTIONS,
        },
      },
      render: (props: TextProps) => <Text {...props} />,
      defaultProps: {
        content: "<p>Write something...</p>",
        variant: "default",
        columns: 1,
        align: "left",
      },
    },
    Image: {
      fields: {
        src: { type: "image" } as any,
        alt: { type: "text" },
        caption: { type: "text" },
        aspect: {
          type: "select",
          options: IMAGE_ASPECT_OPTIONS,
        },
        rounded: {
          type: "select",
          options: IMAGE_ROUNDED_OPTIONS,
        },
        maxWidth: {
          type: "select",
          options: MAX_WIDTH_OPTIONS,
        },
        align: {
          type: "radio",
          options: ALIGN_OPTIONS,
        },
      },
      render: (props: PuckImageProps) => <PuckImage {...props} />,
      defaultProps: {
        src: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200",
        alt: "Image",
        aspect: "auto",
        rounded: "md",
        maxWidth: "default",
        align: "center",
      },
    },
    ButtonRow: {
      fields: {
        align: {
          type: "radio",
          options: ALIGN_OPTIONS,
        },
        size: {
          type: "select",
          options: BUTTON_SIZE_OPTIONS,
        },
        buttons: {
          type: "array",
          getItemSummary: (item: { label?: string }) => item.label || "Button",
          arrayFields: {
            label: { type: "text" },
            href: { type: "link" } as any,
            variant: {
              type: "select",
              options: BUTTON_VARIANT_OPTIONS,
            },
          },
          defaultItemProps: {
            label: "Button",
            href: "/",
            variant: "default",
          },
        },
      },
      render: (props: ButtonRowProps) => <ButtonRow {...props} />,
      defaultProps: {
        align: "left",
        size: "md",
        buttons: [
          { label: "Get started", href: "/", variant: "default" },
          { label: "Learn more", href: "/about", variant: "outline" },
        ],
      },
    },
    Divider: {
      fields: {
        style: {
          type: "select",
          options: DIVIDER_STYLE_OPTIONS,
        },
        spacing: {
          type: "select",
          options: DIVIDER_SPACING_OPTIONS,
        },
      },
      render: (props: DividerProps) => <Divider {...props} />,
      defaultProps: {
        style: "line",
        spacing: "md",
      },
    },
    Accordion: {
      fields: {
        type: {
          type: "radio",
          options: [
            { label: "Single Open", value: "single" },
            { label: "Allow Multiple", value: "multiple" },
          ],
        },
        items: {
          type: "array",
          getItemSummary: (item) => item.title || "Item",
          arrayFields: {
            title: { type: "text" },
            content: { type: "textarea" },
          },
        },
      },
      render: (props: AccordionBlockProps) => <AccordionBlock {...props} />,
      defaultProps: {
        type: "single",
        items: [
          { title: "Question 1", content: "Answer to question 1." },
          { title: "Question 2", content: "Answer to question 2." },
        ],
      },
    },
    Spacer: {
      fields: {
        size: {
          type: "select",
          options: [
            { label: "Extra Small (16px)", value: "xs" },
            { label: "Small (32px)", value: "sm" },
            { label: "Medium (64px)", value: "md" },
            { label: "Large (96px)", value: "lg" },
            { label: "Extra Large (128px)", value: "xl" },
            { label: "Huge (192px)", value: "2xl" },
          ],
        },
      },
      render: (props: SpacerProps) => <Spacer {...props} />,
      defaultProps: {
        size: "md",
      },
    },
    Tabs: {
      fields: {
        tabs: {
          type: "array",
          getItemSummary: (item) => item.label || "Tab",
          arrayFields: {
            label: { type: "text" },
            value: { type: "text" },
          },
        },
        tab0: { type: "slot" },
        tab1: { type: "slot" },
        tab2: { type: "slot" },
        tab3: { type: "slot" },
      },
      render: ({
        tab0: Tab0,
        tab1: Tab1,
        tab2: Tab2,
        tab3: Tab3,
        tabs,
        ...props
      }) => {
        const ref = useRef<HTMLDivElement>(null);
        useEffect(() => registerOverlayPortal(ref.current), []);
        return (
          <Tabs
            ref={ref as any}
            {...props}
            tab0={Tab0 && <Tab0 />}
            tab1={Tab1 && <Tab1 />}
            tab2={Tab2 && <Tab2 />}
            tab3={Tab3 && <Tab3 />}
            tabs={tabs}
          />
        );
      },
      defaultProps: {
        tabs: [
          { label: "Overview", value: "overview" },
          { label: "Details", value: "details" },
        ],
      },
    },
    Columns: {
      fields: {
        layout: {
          type: "select",
          options: [
            { label: "Two Columns (1:1)", value: "1:1" },
            { label: "Two Columns (2:1)", value: "2:1" },
            { label: "Two Columns (1:2)", value: "1:2" },
            { label: "Three Columns (1:1:1)", value: "1:1:1" },
          ],
        },
        gap: {
          type: "select",
          options: [
            { label: "Small", value: "sm" },
            { label: "Medium", value: "md" },
            { label: "Large", value: "lg" },
          ],
        },
        verticalAlign: {
          type: "select",
          options: [
            { label: "Top", value: "top" },
            { label: "Center", value: "center" },
            { label: "Bottom", value: "bottom" },
          ],
        },
        "col-0": { type: "slot" },
        "col-1": { type: "slot" },
        "col-2": { type: "slot" },
      },
      render: ({
        "col-0": Col0,
        "col-1": Col1,
        "col-2": Col2,
        layout = "1:1",
        ...props
      }) => {
        const colCount = layout.split(":").length;
        return (
          <Columns layout={layout} {...props}>
            {Col0 && <Col0 />}
            {Col1 && <Col1 />}
            {colCount > 2 && Col2 && <Col2 />}
          </Columns>
        );
      },
      defaultProps: {
        layout: "1:1",
        gap: "md",
        verticalAlign: "top",
      },
    },
    FeatureGrid: {
      fields: {
        title: { type: "text", contentEditable: true } as any,
        subtitle: { type: "textarea", contentEditable: true },
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
            { label: "Icon", value: "icon" },
            { label: "Simple", value: "simple" },
            { label: "Checklist", value: "checklist" },
            { label: "Project", value: "project" },
            { label: "Process", value: "process" },
          ],
        },
        align: {
          type: "radio",
          options: ALIGN_OPTIONS,
        },
        items: {
          type: "array",
          getItemSummary: (item) => item.title || "Feature",
          arrayFields: {
            title: { type: "text" },
            description: { type: "textarea" },
            badge: { type: "text" },
            icon: {
              type: "select",
              options: ICON_OPTIONS,
            },
            href: { type: "link" } as any,
          },
        },
      },
      render: (props: FeatureGridProps) => <FeatureGrid {...props} />,
      defaultProps: {
        columns: 3,
        variant: "card",
        align: "center",
        items: [
          {
            title: "Feature 1",
            description: "Description 1",
            icon: "Sparkles",
          },
          { title: "Feature 2", description: "Description 2", icon: "Zap" },
          { title: "Feature 3", description: "Description 3", icon: "Crown" },
        ],
      },
    },
    StatsGrid: {
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
          getItemSummary: (item) => item.label || "Stat",
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
        ],
      },
    },
    TeamGrid: {
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
          getItemSummary: (item) => item.name || "Member",
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
        ],
      },
    },
    Timeline: {
      resolveFields: (data) => {
        const fields: any = {
          title: { type: "text", contentEditable: true } as any,
          subtitle: { type: "textarea", contentEditable: true },
          align: {
            type: "radio",
            options: ALIGN_OPTIONS,
          },
          mode: {
            type: "select",
            options: [
              { label: "Alternating", value: "alternating" },
              { label: "Left Aligned", value: "left" },
              { label: "Right Aligned", value: "right" },
            ],
          },
          dataMode: {
            type: "radio",
            label: "Data Source",
            options: [
              { label: "Manual", value: "manual" },
              { label: "Dynamic", value: "dynamic" },
            ],
          },
        };

        if (data.props.dataMode === "dynamic") {
          fields.dataSource = {
            type: "data-source",
            label: "Milestones Source",
            schemas: TABLE_SCHEMAS.filter((s) => s.id === "milestones"),
            showSort: false,
            showLimit: true,
            maxLimit: 50,
          };
        } else {
          fields.items = {
            type: "array",
            getItemSummary: (item: any) => item.title || "Timeline Item",
            arrayFields: {
              date: { type: "text" },
              title: { type: "text" },
              description: { type: "textarea" },
              image: { type: "image" },
              icon: {
                type: "select",
                options: ICON_OPTIONS,
              },
            },
            defaultItemProps: {
              date: "2024",
              title: "New Milestone",
              description: "Description",
              icon: "Sparkles",
            },
          };
        }

        return fields;
      },
      resolveData: async ({ props }, { changed, trigger, metadata }) => {
        const { dataMode, dataSource } = props;
        const resolvedProps: Partial<TimelinePropsWithSlot> = {};

        const shouldResolve =
          trigger === "insert" ||
          trigger === "load" ||
          trigger === "force" ||
          trigger === "move" ||
          Boolean(changed.dataMode || changed.dataSource);

        if (!shouldResolve) {
          return { props: {} };
        }

        if (dataMode === "dynamic" && dataSource) {
          try {
            const locale =
              (metadata as { locale?: string })?.locale ?? dataSource.locale;
            const items = await getDynamicContent({
              ...dataSource,
              table: "milestones",
              locale,
            });
            resolvedProps.items = items.map((item) => ({
              date: item.date || "",
              title: item.title,
              description: item.description || "",
              image: item.image,
              icon: item.icon,
            }));
          } catch (e) {
            console.error("Failed to resolve timeline items", e);
          }
        }

        return { props: resolvedProps };
      },
      render: (props: TimelineProps) => <Timeline {...props} />,
      defaultProps: {
        title: "Our History",
        subtitle: "A timeline of our journey and milestones.",
        align: "center",
        mode: "alternating",
        dataMode: "manual",
        items: [
          {
            date: "2024",
            title: "Milestone 1",
            description: "Description of the milestone.",
            icon: "Rocket",
          },
          {
            date: "2023",
            title: "Milestone 2",
            description: "Description of the milestone.",
            icon: "Trophy",
          },
        ],
      },
    },
    LogoGrid: {
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
          getItemSummary: (item) => item.alt || "Logo",
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
        ],
      },
    },
    CTA: {
      fields: {
        title: { type: "text", contentEditable: true } as any,
        description: { type: "textarea", contentEditable: true },
        variant: {
          type: "select",
          options: [
            { label: "Default", value: "default" },
            { label: "Card", value: "card" },
            { label: "Brand", value: "brand" },
            { label: "Dark", value: "dark" },
          ],
        },
        align: {
          type: "radio",
          options: ALIGN_OPTIONS,
        },
        buttons: {
          type: "array",
          arrayFields: {
            label: { type: "text" },
            href: { type: "link" } as any,
            variant: {
              type: "select",
              options: [
                { label: "Default", value: "default" },
                { label: "Outline", value: "outline" },
                { label: "Ghost", value: "ghost" },
                { label: "White", value: "white" },
              ],
            },
          },
          defaultItemProps: {
            label: "Button",
            href: "#",
            variant: "default",
          },
        },
      },
      render: (props: CTAProps) => <CTA {...props} />,
      defaultProps: {
        title: "Ready to join?",
        description: "Get started today.",
        variant: "brand",
        buttons: [{ label: "Join Now", href: "/join", variant: "white" }],
      },
    },
    Section: {
      fields: {
        backgroundColor: {
          type: "select",
          options: SECTION_BG_OPTIONS,
        },
        padding: {
          type: "select",
          options: PADDING_OPTIONS,
        },
        maxWidth: {
          type: "select",
          options: MAX_WIDTH_OPTIONS,
        },
        id: { type: "text" },
        content: { type: "slot" },
      },
      render: ({ content: Content, ...props }) => (
        <Section {...props}>{Content && <Content />}</Section>
      ),
      defaultProps: {
        backgroundColor: "white",
        padding: "md",
        maxWidth: "default",
      },
    },
    Hero: {
      resolveFields: (data, { metadata }) => {
        const isGlobalAdmin = Boolean(
          (metadata as { user?: { isGlobalAdmin?: boolean } })?.user
            ?.isGlobalAdmin
        );
        const fields: any = {
          layout: {
            type: "select",
            options: [
              { label: "Center", value: "center" },
              { label: "Left", value: "left" },
              { label: "Split", value: "split" },
              { label: "Carousel", value: "carousel" },
            ],
          },
          height: {
            type: "select",
            options: [
              { label: "Full Screen", value: "full" },
              { label: "Large", value: "large" },
              { label: "Medium", value: "medium" },
              { label: "Small", value: "small" },
            ],
          },
          title: { type: "text" },
          subtitle: { type: "textarea", contentEditable: true },
          badge: { type: "text" },
          backgroundImage: { type: "image" },
          image: { type: "image" },
          overlay: {
            type: "radio",
            options: [
              { label: "Yes", value: true },
              { label: "No", value: false },
            ],
          },
          buttons: {
            type: "array",
            arrayFields: {
              label: { type: "text" },
              href: { type: "link" },
              variant: {
                type: "select",
                options: [
                  { label: "Default", value: "default" },
                  { label: "Outline", value: "outline" },
                  { label: "Ghost", value: "ghost" },
                  { label: "Link", value: "link" },
                  { label: "Glass", value: "glass" },
                  { label: "Gradient", value: "gradient" },
                ],
              },
            },
            defaultItemProps: {
              label: "New Button",
              href: "#",
              variant: "default",
            },
          },
          styling: {
            type: "object",
            label: "Styling & Design",
            objectFields: {
              padding: {
                type: "select",
                options: [
                  { label: "Default", value: "default" },
                  { label: "Small", value: "py-8" },
                  { label: "Medium", value: "py-16" },
                  { label: "Large", value: "py-24" },
                ],
              },
            },
          },
        };

        if (isGlobalAdmin) {
          fields.styling.objectFields.className = {
            type: "text",
            label: "Custom CSS Class",
          };
        }

        // Conditional fields
        if (data.props.layout === "split") {
          fields.rightSlot = { type: "slot" };
        }

        if (data.props.layout === "carousel") {
          fields.slidesMode = {
            type: "radio",
            label: "Slides Source",
            options: [
              { label: "Manual", value: "manual" },
              { label: "Dynamic", value: "dynamic" },
            ],
          };

          if (data.props.slidesMode === "dynamic") {
            fields.slidesSource = {
              type: "data-source",
              label: "Slides Source",
              schemas: TABLE_SCHEMAS.filter((s) =>
                ["events", "news", "pages", "products"].includes(String(s.id))
              ),
            };
          } else {
            fields.slides = {
              type: "array",
              getItemSummary: (item: any) => item.title || "Slide",
              arrayFields: {
                title: { type: "text" },
                subtitle: { type: "textarea" },
                image: { type: "image" },
                buttons: {
                  type: "array",
                  arrayFields: {
                    label: { type: "text" },
                    href: { type: "link" },
                    variant: {
                      type: "select",
                      options: [
                        { label: "Default", value: "default" },
                        { label: "Outline", value: "outline" },
                        { label: "Ghost", value: "ghost" },
                        { label: "Link", value: "link" },
                        { label: "Glass", value: "glass" },
                        { label: "Gradient", value: "gradient" },
                      ],
                    },
                  },
                  defaultItemProps: {
                    label: "New Button",
                    href: "#",
                    variant: "default",
                  },
                },
              },
              defaultItemProps: {
                title: "New Slide",
                subtitle: "Description",
                buttons: [],
              },
            };
          }
        }

        // Stats
        fields.statsMode = {
          type: "radio",
          label: "Stats Source",
          options: [
            { label: "Manual", value: "manual" },
            { label: "Dynamic", value: "dynamic" },
          ],
        };

        if (data.props.statsMode === "dynamic") {
          fields.statsSource = {
            type: "data-source",
            label: "Stats Source",
            schemas: TABLE_SCHEMAS,
          };
        } else {
          fields.stats = {
            type: "array",
            getItemSummary: (item: any) => item.label,
            arrayFields: {
              value: { type: "text" },
              label: { type: "text" },
            },
          };
          fields.statsVariant = {
            type: "radio",
            options: [
              { label: "Pills", value: "pills" },
              { label: "Simple", value: "simple" },
            ],
          };
        }

        // Highlights
        fields.highlights = {
          type: "array",
          getItemSummary: (item: any) => item.text,
          arrayFields: {
            text: { type: "text" },
            icon: {
              type: "select",
              options: ICON_OPTIONS,
            },
          },
        };

        return fields;
      },
      resolveData: async ({ props }, { changed, trigger, metadata }) => {
        const { slidesMode, slidesSource, statsMode, statsSource } = props;
        const resolvedProps: Partial<HeroPropsWithSlot> = {};

        const shouldResolveSlides =
          slidesMode === "dynamic" &&
          Boolean(slidesSource) &&
          (trigger === "insert" ||
            trigger === "load" ||
            trigger === "force" ||
            trigger === "move" ||
            Boolean(changed.slidesMode || changed.slidesSource));

        if (shouldResolveSlides) {
          try {
            const locale =
              (metadata as { locale?: string })?.locale ?? slidesSource?.locale;
            const items = await getDynamicContent({
              ...slidesSource,
              locale,
            });
            resolvedProps.slides = items.map((item) => ({
              title: item.title,
              subtitle: item.subtitle || "",
              image: item.image,
              buttons: item.href
                ? [{ label: "Learn More", href: item.href, variant: "default" }]
                : [],
            }));
          } catch (e) {
            console.error("Failed to resolve slides", e);
          }
        }

        const shouldResolveStats =
          statsMode === "dynamic" &&
          Boolean(statsSource) &&
          (trigger === "insert" ||
            trigger === "load" ||
            trigger === "force" ||
            trigger === "move" ||
            Boolean(changed.statsMode || changed.statsSource));

        if (shouldResolveStats) {
          try {
            const locale =
              (metadata as { locale?: string })?.locale ?? statsSource?.locale;
            const items = await getDynamicContent({
              ...statsSource,
              locale,
            });
            resolvedProps.stats = items.map((item) => ({
              value: item.value || "0",
              label: item.label || item.title,
            }));
          } catch (e) {
            console.error("Failed to resolve stats", e);
          }
        }

        return { props: resolvedProps };
      },
      fields: {
        layout: {
          type: "select",
          options: [
            { label: "Center", value: "center" },
            { label: "Left", value: "left" },
            { label: "Split", value: "split" },
            { label: "Carousel", value: "carousel" },
          ],
        },
        // Default initial fields if needed, but resolveFields handles mostly
      },
      render: ({ rightSlot: RightSlot, ...props }) => (
        <Hero rightSlot={RightSlot && <RightSlot />} {...props} />
      ),
      defaultProps: {
        layout: "center",
        height: "medium",
        title: "Hero Title",
        subtitle: "This is a generic hero component that can be customized.",
        buttons: [{ label: "Get Started", href: "/", variant: "default" }],
        overlay: true,
        slides: [],
        slidesMode: "manual",
        stats: [],
        statsMode: "manual",
        highlights: [],
      },
    },
    About: {
      resolveFields: (data, { metadata }): any => {
        const isGlobalAdmin = Boolean(
          (metadata as { user?: { isGlobalAdmin?: boolean } })?.user
            ?.isGlobalAdmin
        );

        const currentGradients = Array.isArray((data.props as any).values)
          ? ((data.props as any).values as any[])
              .map((v) => (typeof v?.gradient === "string" ? v.gradient : null))
              .filter(Boolean)
          : [];

        const extraGradientOptions = currentGradients
          .filter(
            (value: string) =>
              !GRADIENT_OPTIONS.some((opt) => opt.value === value)
          )
          .map((value: string) => ({
            label: `Custom: ${value}`,
            value,
          }));

        const gradientOptions = [...GRADIENT_OPTIONS, ...extraGradientOptions];

        return {
          stats: {
            type: "array",
            arrayFields: {
              number: { type: "text" },
              label: { type: "text" },
              iconName: {
                type: "select",
                options: [
                  { label: "Calendar", value: "Calendar" },
                  { label: "Briefcase", value: "Briefcase" },
                  { label: "Rocket", value: "Rocket" },
                  { label: "Trophy", value: "Trophy" },
                ],
              },
            },
          },
          values: {
            type: "array",
            arrayFields: {
              title: { type: "text" },
              description: { type: "textarea" },
              iconName: {
                type: "select",
                options: [
                  { label: "Megaphone", value: "Megaphone" },
                  { label: "Link", value: "Link" },
                  { label: "Sparkles", value: "Sparkles" },
                ],
              },
              gradient: isGlobalAdmin
                ? { type: "text", label: "Gradient (classes)" }
                : { type: "select", options: gradientOptions },
            },
          },
          mainContent: {
            type: "object",
            objectFields: {
              tag: { type: "text" },
              titleLine1: { type: "text", contentEditable: true } as any,
              titleLine2: { type: "text", contentEditable: true } as any,
              paragraph1: { type: "textarea", contentEditable: true },
              paragraph2: { type: "textarea", contentEditable: true },
            },
          },
          videoUrl: { type: "text" },
        };
      },
      render: (props: AboutProps) => <About {...props} />,
      defaultProps: {
        stats: [
          { number: "100+", label: "Events", iconName: "Calendar" },
          { number: "50+", label: "Jobs", iconName: "Briefcase" },
          { number: "20+", label: "Societies", iconName: "Rocket" },
        ],
        values: [
          {
            title: "Impact",
            description: "We make an impact.",
            iconName: "Megaphone",
            gradient: "from-[#3DA9E0] to-[#001731]",
          },
        ],
        mainContent: {
          tag: "About",
          titleLine1: "Premier Student",
          titleLine2: "Community",
          paragraph1: "We are the student union...",
          paragraph2: "Join us today.",
        },
      },
    },
    JoinUs: {
      resolveFields: (data, { metadata }): any => {
        const isGlobalAdmin = Boolean(
          (metadata as { user?: { isGlobalAdmin?: boolean } })?.user
            ?.isGlobalAdmin
        );

        const currentGradients = Array.isArray((data.props as any).durations)
          ? ((data.props as any).durations as any[])
              .map((v) => (typeof v?.gradient === "string" ? v.gradient : null))
              .filter(Boolean)
          : [];

        const extraGradientOptions = currentGradients
          .filter(
            (value: string) =>
              !GRADIENT_OPTIONS.some((opt) => opt.value === value)
          )
          .map((value: string) => ({
            label: `Custom: ${value}`,
            value,
          }));

        const gradientOptions = [...GRADIENT_OPTIONS, ...extraGradientOptions];

        return {
          tag: { type: "text" },
          titleLine1: { type: "text" },
          titleLine2: { type: "text" },
          subtitle: { type: "textarea" },
          heroBadge: { type: "text" },
          heroSubtitle: { type: "textarea" },
          memberFeaturesHeader: { type: "text" },
          memberFeatures: {
            type: "array",
            arrayFields: {
              feature: { type: "text" },
            },
          },
          benefits: {
            type: "array",
            arrayFields: {
              text: { type: "text" },
              iconName: {
                type: "select",
                options: [
                  { label: "Sparkles", value: "Sparkles" },
                  { label: "Gift", value: "Gift" },
                  { label: "Crown", value: "Crown" },
                  { label: "Zap", value: "Zap" },
                  { label: "Check", value: "Check" },
                ],
              },
            },
          },
          durations: {
            type: "array",
            arrayFields: {
              name: { type: "text" },
              price: { type: "text" },
              period: { type: "text" },
              savings: { type: "text" },
              popular: {
                type: "radio",
                options: [
                  { label: "Yes", value: true },
                  { label: "No", value: false },
                ],
              },
              gradient: isGlobalAdmin
                ? { type: "text", label: "Gradient (classes)" }
                : { type: "select", options: gradientOptions },
            },
          },
          cta: {
            type: "object",
            objectFields: {
              title: { type: "text" },
              subtitle: { type: "textarea" },
              buttonText: { type: "text" },
            },
          },
        };
      },
      render: (props: EditorJoinUsProps) => {
        const componentProps = {
          ...props,
          memberFeatures:
            props.memberFeatures?.map((f: { feature: string }) => f.feature) ||
            [],
        };
        return <JoinUs {...componentProps} />;
      },
      defaultProps: {
        tag: "Membership",
        titleLine1: "Join the",
        titleLine2: "Community",
        subtitle: "Unlock exclusive benefits.",
        heroBadge: "Why Join?",
        heroSubtitle: "Being a member pays off.",
        memberFeaturesHeader: "All memberships include:",
        memberFeatures: [{ feature: "Event Access" }, { feature: "Discounts" }],
        benefits: [{ text: "Social Events", iconName: "Sparkles" }],
        durations: [
          {
            name: "1 Year",
            price: "200 NOK",
            period: "/year",
            popular: true,
            gradient: "from-purple-600 to-pink-600",
          },
        ],
        cta: {
          title: "Not sure?",
          subtitle: "Contact us.",
          buttonText: "Contact",
        },
      },
    },
    News: {
      resolveFields: (data): any => {
        const fields: Record<string, unknown> = {
          dataMode: {
            type: "radio",
            label: "Data Source",
            options: [
              { label: "Manual Entry", value: "manual" },
              { label: "Dynamic (Database)", value: "dynamic" },
            ],
          },
        };

        if (data.props.dataMode === "dynamic") {
          fields.scope = {
            type: "radio",
            label: "Scope",
            options: [
              { label: "This page", value: "page" },
              { label: "All content", value: "all" },
            ],
          };
          fields.dataSource = {
            type: "data-source",
            label: "News Source",
            schemas: TABLE_SCHEMAS.filter((s) => s.id === "news"),
            showLimit: true,
            showSort: true,
            maxLimit: 50,
          };
        } else {
          fields.news = {
            type: "array",
            getItemSummary: (item: { title?: string }) =>
              item.title || "Article",
            arrayFields: {
              title: { type: "text" },
              description: { type: "textarea" },
              image: { type: "image" },
              content_id: { type: "text" },
              $id: { type: "text" },
              $createdAt: { type: "text" },
            },
          };
        }

        fields.labels = {
          type: "object",
          objectFields: {
            empty: { type: "text" },
            emptyDescription: { type: "text" },
            cta: { type: "text" },
            stayUpdated: { type: "text" },
            titleDefault: { type: "text" },
            readMore: { type: "text" },
            viewAllNews: { type: "text" },
          },
        };

        return fields;
      },
      resolveData: async ({ props }, { changed, trigger, metadata }) => {
        const shouldResolve =
          trigger === "insert" ||
          trigger === "load" ||
          trigger === "force" ||
          trigger === "move" ||
          Boolean(changed.dataMode || changed.dataSource || changed.scope);

        if (!shouldResolve) {
          return { props: {} };
        }

        if (props.dataMode !== "dynamic" || !props.dataSource?.table) {
          return { props: {} };
        }

        try {
          const editorMetadata = metadata as EditorMetadata | undefined;
          const locale = editorMetadata?.locale ?? props.dataSource.locale;
          const scopeFilters = await buildPageScopeFilters(
            "news",
            props.scope,
            editorMetadata
          );

          const items = await getDynamicContent({
            ...props.dataSource,
            table: "news",
            locale,
            filters: mergeFilters(props.dataSource.filters, scopeFilters),
            limit: props.dataSource.limit ?? 6,
          });

          const news = items.map((item) => ({
            $id: item.id || "",
            content_id: item.id || "",
            title: item.title,
            description: item.description || "",
            image: item.image || "",
            $createdAt: item.date || new Date().toISOString(),
          }));

          return { props: { news } };
        } catch (e) {
          console.error("Failed to resolve news", e);
          return { props: {} };
        }
      },
      render: (props: EditorNewsProps) => <FilteredNews {...props} />,
      defaultProps: {
        dataMode: "dynamic",
        scope: "page",
        dataSource: {
          table: "news",
          limit: 6,
          sort: { field: "$createdAt", direction: "desc" },
          filters: [{ field: "status", operator: "equal", value: "published" }],
        },
        news: [],
        labels: {
          empty: "No news yet",
          emptyDescription: "Check back later.",
          cta: "Update",
          stayUpdated: "Stay",
          titleDefault: "Updated",
          readMore: "Read More",
          viewAllNews: "View All News",
        },
      },
    },
    FilterBar: {
      fields: {
        title: { type: "text" },
        showSearch: {
          type: "radio",
          options: [
            { label: "Yes", value: true },
            { label: "No", value: false },
          ],
        },
        categories: {
          type: "array",
          getItemSummary: (item) => item.label || "Category",
          arrayFields: {
            label: { type: "text" },
            value: { type: "text" },
          },
        },
      },
      render: (props: FilterBarProps) => <FilterBar {...props} />,
      defaultProps: {
        showSearch: true,
        categories: [
          { label: "Social", value: "Social" },
          { label: "Career", value: "Career" },
          { label: "Academic", value: "Academic" },
        ],
      },
    },
    JobsList: {
      resolveFields: (data): any => {
        const fields: Record<string, unknown> = {
          dataMode: {
            type: "radio",
            label: "Data Source",
            options: [
              { label: "Manual Entry", value: "manual" },
              { label: "Dynamic (Database)", value: "dynamic" },
            ],
          },
        };

        if (data.props.dataMode === "dynamic") {
          fields.scope = {
            type: "radio",
            label: "Scope",
            options: [
              { label: "This page", value: "page" },
              { label: "All content", value: "all" },
            ],
          };
          fields.dataSource = {
            type: "data-source",
            label: "Jobs Source",
            schemas: TABLE_SCHEMAS.filter((s) => s.id === "jobs"),
            showLimit: true,
            showSort: true,
            maxLimit: 100,
          };
        } else {
          fields.jobs = {
            type: "array",
            getItemSummary: (item: { title?: string }) => item.title || "Job",
            arrayFields: {
              title: { type: "text" },
              department: { type: "text" },
              location: { type: "text" },
              type: { type: "text" },
              paid: {
                type: "radio",
                options: [
                  { label: "Yes", value: true },
                  { label: "No", value: false },
                ],
              },
              category: { type: "text" },
              description: { type: "textarea" },
              slug: { type: "text" },
              deadline: { type: "text" },
            },
          };
        }

        fields.labels = {
          type: "object",
          objectFields: {
            viewDetails: { type: "text" },
            paid: { type: "text" },
            volunteer: { type: "text" },
            deadline: { type: "text" },
            noJobs: { type: "text" },
          },
        };

        return fields;
      },
      resolveData: async ({ props }, { changed, trigger, metadata }) => {
        const shouldResolve =
          trigger === "insert" ||
          trigger === "load" ||
          trigger === "force" ||
          trigger === "move" ||
          Boolean(changed.dataMode || changed.dataSource || changed.scope);

        if (!shouldResolve) {
          return { props: {} };
        }

        if (props.dataMode !== "dynamic" || !props.dataSource?.table) {
          return { props: {} };
        }

        try {
          const editorMetadata = metadata as EditorMetadata | undefined;
          const locale = editorMetadata?.locale ?? props.dataSource.locale;
          const scopeFilters = await buildPageScopeFilters(
            "jobs",
            props.scope,
            editorMetadata
          );

          const items = await getDynamicContent({
            ...props.dataSource,
            table: "jobs",
            locale,
            filters: mergeFilters(props.dataSource.filters, scopeFilters),
            limit: props.dataSource.limit ?? 12,
          });

          const jobs = items.map((item) => {
            const meta = (item.metadata ?? {}) as Record<string, unknown>;

            const href = typeof item.href === "string" ? item.href : "";
            const slug = deriveJobSlug(meta, href);
            const subtitle = normalizeSubtitle(item.subtitle);
            const department = getMetaString(meta, "department") ?? subtitle;
            const paid =
              getMetaBoolean(meta, "paid") ??
              String(item.badge).toLowerCase() === "paid";
            const deadline = getMetaString(meta, "deadline") ?? item.date;
            const location = getMetaString(meta, "location") ?? item.location;
            const type = getMetaString(meta, "type") ?? item.category;
            const category = getMetaString(meta, "category") ?? item.category;

            return {
              title: item.title,
              department,
              location,
              type,
              paid,
              category,
              description: item.description,
              slug,
              deadline,
            };
          });

          return { props: { jobs } };
        } catch (e) {
          console.error("Failed to resolve jobs", e);
          return { props: {} };
        }
      },
      render: (props: EditorJobsListProps) => <JobsList {...props} />,
      defaultProps: {
        dataMode: "dynamic",
        scope: "page",
        dataSource: {
          table: "jobs",
          limit: 12,
          sort: { field: "$createdAt", direction: "desc" },
          filters: [{ field: "status", operator: "equal", value: "published" }],
        },
        jobs: [],
        labels: {
          viewDetails: "View Details",
          paid: "Paid",
          volunteer: "Volunteer",
          deadline: "Deadline:",
          noJobs: "No positions found.",
        },
      },
    },
    ProductsGrid: {
      resolveFields: (data): any => {
        const fields: Record<string, unknown> = {
          title: { type: "text", contentEditable: true } as any,
          subtitle: { type: "textarea", contentEditable: true },
          variant: {
            type: "select",
            options: [
              { label: "Grid", value: "grid" },
              { label: "Carousel", value: "carousel" },
            ],
          },
          columns: {
            type: "select",
            options: [
              { label: "2", value: 2 },
              { label: "3", value: 3 },
              { label: "4", value: 4 },
            ],
          },
          dataMode: {
            type: "radio",
            label: "Data Source",
            options: [
              { label: "Manual Entry", value: "manual" },
              { label: "Dynamic (Database)", value: "dynamic" },
            ],
          },
        };

        if (data.props.dataMode === "dynamic") {
          fields.scope = {
            type: "radio",
            label: "Scope",
            options: [
              { label: "This page", value: "page" },
              { label: "All content", value: "all" },
            ],
          };
          fields.dataSource = {
            type: "data-source",
            label: "Products Source",
            schemas: TABLE_SCHEMAS.filter((s) => s.id === "products"),
            showLimit: true,
            showSort: true,
            maxLimit: 50,
          };
        } else {
          fields.products = {
            type: "array",
            getItemSummary: (item: { title?: string }) =>
              item.title || "Product",
            arrayFields: {
              id: { type: "text" },
              title: { type: "text" },
              image: { type: "image" },
              href: { type: "link" },
              price: { type: "text" },
              badge: { type: "text" },
            },
            defaultItemProps: () => ({
              id: crypto.randomUUID(),
              title: "New Product",
              href: "/shop",
            }),
          };
        }

        return fields;
      },
      resolveData: async ({ props }, { changed, trigger, metadata }) => {
        const shouldResolve =
          trigger === "insert" ||
          trigger === "load" ||
          trigger === "force" ||
          trigger === "move" ||
          Boolean(changed.dataMode || changed.dataSource || changed.scope);

        if (!shouldResolve) {
          return { props: {} };
        }

        if (props.dataMode !== "dynamic" || !props.dataSource?.table) {
          return { props: {} };
        }

        try {
          const editorMetadata = metadata as EditorMetadata | undefined;
          const locale = editorMetadata?.locale ?? props.dataSource.locale;
          const scopeFilters = await buildPageScopeFilters(
            "products",
            props.scope,
            editorMetadata
          );

          const items = await getDynamicContent({
            ...props.dataSource,
            table: "products",
            locale,
            filters: mergeFilters(props.dataSource.filters, scopeFilters),
            limit: props.dataSource.limit ?? 12,
          });

          const products = items.map((item) => {
            const meta = (item.metadata ?? {}) as Record<string, unknown>;

            let stock: number | undefined;
            if (typeof meta.stock === "number") {
              stock = meta.stock;
            } else if (typeof meta.stock === "string") {
              stock = Number(meta.stock);
            }

            const price = formatNokPrice(meta.price);

            return {
              id: item.id || crypto.randomUUID(),
              title: item.title,
              image: item.image,
              href: item.href,
              price,
              badge: stock === 0 ? "Out of stock" : item.category,
            };
          });

          return { props: { products } };
        } catch (e) {
          console.error("Failed to resolve products", e);
          return { props: {} };
        }
      },
      render: (props: EditorProductsGridProps) => <ProductsGrid {...props} />,
      defaultProps: {
        title: "Shop",
        subtitle: "Popular items from the webshop.",
        variant: "grid",
        columns: 3,
        dataMode: "dynamic",
        scope: "page",
        dataSource: {
          table: "products",
          limit: 8,
          sort: { field: "$createdAt", direction: "desc" },
          filters: [
            { field: "status", operator: "equal", value: "published" },
            { field: "stock", operator: "greaterThan", value: 0 },
          ],
        },
        products: [],
      },
    },
    Events: {
      resolveFields: (data): any => {
        const fields: Record<string, unknown> = {
          dataMode: {
            type: "radio",
            label: "Data Source",
            options: [
              { label: "Manual Entry", value: "manual" },
              { label: "Dynamic (Database)", value: "dynamic" },
            ],
          },
        };

        if (data.props.dataMode === "dynamic") {
          fields.scope = {
            type: "radio",
            label: "Scope",
            options: [
              { label: "This page", value: "page" },
              { label: "All content", value: "all" },
            ],
          };
          fields.dataSource = {
            type: "data-source",
            label: "Events Source",
            schemas: TABLE_SCHEMAS.filter((s) => s.id === "events"),
            showLimit: true,
            showSort: true,
            maxLimit: 50,
          };
        } else {
          fields.events = {
            type: "array",
            getItemSummary: (item: { title?: string }) => item.title || "Event",
            arrayFields: {
              title: { type: "text" },
              image: { type: "image" },
              start_date: { type: "text" },
              end_date: { type: "text" },
              location: { type: "text" },
              category: {
                type: "select",
                options: [
                  { label: "Social", value: "Social" },
                  { label: "Career", value: "Career" },
                  { label: "Academic", value: "Academic" },
                ],
              },
              attendees: { type: "number" },
              content_id: { type: "text" },
              $id: { type: "text" },
            },
          };
        }

        fields.labels = {
          type: "object",
          objectFields: {
            empty: { type: "text" },
            emptyDescription: { type: "text" },
            upcomingEvents: { type: "text" },
            dontMissOut: { type: "text" },
            amazingExperiences: { type: "text" },
            description: { type: "textarea" },
            registerNow: { type: "text" },
            viewAllEvents: { type: "text" },
          },
        };

        return fields;
      },
      resolveData: async ({ props }, { changed, trigger, metadata }) => {
        const shouldResolve =
          trigger === "insert" ||
          trigger === "load" ||
          trigger === "force" ||
          trigger === "move" ||
          Boolean(changed.dataMode || changed.dataSource || changed.scope);

        if (!shouldResolve) {
          return { props: {} };
        }

        if (props.dataMode !== "dynamic" || !props.dataSource?.table) {
          return { props: {} };
        }

        try {
          const editorMetadata = metadata as EditorMetadata | undefined;
          const locale = editorMetadata?.locale ?? props.dataSource.locale;
          const scopeFilters = await buildPageScopeFilters(
            "events",
            props.scope,
            editorMetadata
          );

          const items = await getDynamicContent({
            ...props.dataSource,
            table: "events",
            locale,
            filters: mergeFilters(props.dataSource.filters, scopeFilters),
            limit: props.dataSource.limit ?? 6,
          });

          const events = items.map((item) => ({
            $id: item.id || "",
            content_id: item.id || "",
            title: item.title,
            image: item.image,
            start_date: item.date,
            location: item.location,
            category: item.category,
          }));

          return { props: { events } };
        } catch (e) {
          console.error("Failed to resolve events", e);
          return { props: {} };
        }
      },
      render: (props: EditorEventsProps) => <FilteredEvents {...props} />,
      defaultProps: {
        dataMode: "dynamic",
        scope: "page",
        dataSource: {
          table: "events",
          limit: 6,
          sort: { field: "start_date", direction: "asc" },
          filters: [
            { field: "start_date", operator: "greaterThan", value: "$now" },
            { field: "status", operator: "equal", value: "published" },
          ],
        },
        events: [],
        labels: {
          empty: "No events",
          emptyDescription: "Check back later",
          upcomingEvents: "Upcoming Events",
          dontMissOut: "Don't miss out on",
          amazingExperiences: "amazing experiences",
          description: "Join us at our events.",
          registerNow: "Register Now",
          viewAllEvents: "View All Events",
        },
      },
    },
    Collection: {
      label: "Collection",
      resolveFields: (data): any => {
        const fields: Record<string, unknown> = {
          title: { type: "text", label: "Title" },
          subtitle: { type: "textarea", label: "Subtitle" },
          layout: {
            type: "select",
            label: "Layout",
            options: LAYOUT_OPTIONS,
          },
          columns: {
            type: "select",
            label: "Columns",
            options: [
              { label: "2 Columns", value: 2 },
              { label: "3 Columns", value: 3 },
              { label: "4 Columns", value: 4 },
              { label: "5 Columns", value: 5 },
              { label: "6 Columns", value: 6 },
            ],
          },
          dataMode: {
            type: "radio",
            label: "Data Source",
            options: [
              { label: "Manual Entry", value: "manual" },
              { label: "Dynamic (Database)", value: "dynamic" },
            ],
          },
        };

        if (data.props.dataMode === "dynamic") {
          fields.dataSource = {
            type: "data-source",
            label: "Data Source",
            schemas: TABLE_SCHEMAS,
            showLimit: true,
            showSort: true,
            maxLimit: 100,
          };
        } else {
          fields.items = {
            type: "array",
            label: "Items",
            getItemSummary: (item: { title?: string }) => item.title || "Item",
            arrayFields: {
              title: { type: "text", label: "Title" },
              subtitle: { type: "text", label: "Subtitle" },
              description: { type: "textarea", label: "Description" },
              image: { type: "image", label: "Image" },
              icon: { type: "text", label: "Icon (e.g., star, heart, users)" },
              href: { type: "text", label: "Link URL" },
              date: { type: "text", label: "Date" },
              badge: { type: "text", label: "Badge" },
            },
          };
        }

        // Display options
        fields.emptyMessage = { type: "text", label: "Empty Message" };
        fields.ctaLabel = { type: "text", label: "CTA Button Label" };
        fields.ctaHref = { type: "text", label: "CTA Button Link" };

        // Layout-specific options
        if (data.props.layout === "logo-grid") {
          fields.grayscale = {
            type: "radio",
            label: "Grayscale",
            options: [
              { label: "Yes", value: true },
              { label: "No", value: false },
            ],
          };
        }

        if (data.props.layout === "card-grid") {
          fields.cardVariant = {
            type: "select",
            label: "Card Style",
            options: [
              { label: "Default", value: "default" },
              { label: "Bordered", value: "bordered" },
              { label: "Elevated", value: "elevated" },
            ],
          };
          fields.imageAspect = {
            type: "select",
            label: "Image Aspect",
            options: [
              { label: "Video (16:9)", value: "video" },
              { label: "Square", value: "square" },
              { label: "Portrait (3:4)", value: "portrait" },
            ],
          };
        }

        return fields;
      },
      resolveData: async ({ props }, { changed, trigger, metadata }) => {
        const shouldResolve =
          trigger === "insert" ||
          trigger === "load" ||
          trigger === "force" ||
          trigger === "move" ||
          Boolean(changed.dataMode || changed.dataSource);

        if (!shouldResolve) {
          return { props: {} };
        }

        if (props.dataMode !== "dynamic" || !props.dataSource?.table) {
          return { props: {} };
        }

        try {
          const items = await getDynamicContent({
            ...props.dataSource,
            locale:
              (metadata as EditorMetadata | undefined)?.locale ??
              props.dataSource.locale,
          });

          const collectionItems = items.map((item) => ({
            id: item.id || crypto.randomUUID(),
            title: item.title,
            subtitle: item.subtitle,
            description: item.description,
            image: item.image,
            href: item.href,
            date: item.date,
            badge: item.badge,
          }));

          return { props: { items: collectionItems } };
        } catch (e) {
          console.error("Failed to resolve collection", e);
          return { props: {} };
        }
      },
      render: (props: EditorCollectionProps) => <Collection {...props} />,
      defaultProps: {
        layout: "card-grid",
        dataMode: "manual",
        items: [],
        emptyMessage: "No items to display",
        emptyDescription: "Check back later.",
      },
    },
    RichText: {
      fields: {
        content: {
          type: "textarea",
          label: "Content (Markdown)",
        },
        variant: {
          type: "select",
          options: [
            { label: "Default", value: "default" },
            { label: "Compact", value: "compact" },
            { label: "Legal Document", value: "legal" },
          ],
        },
        columns: {
          type: "radio",
          options: [
            { label: "Single Column", value: 1 },
            { label: "Two Columns", value: 2 },
          ],
        },
      },
      render: (props: RichTextProps) => <RichText {...props} />,
      defaultProps: {
        content:
          "## Section Title\n\nThis is a paragraph of text. You can use **bold** and *italic* formatting.\n\n### Subsection\n\n- List item 1\n- List item 2\n- List item 3\n\nLearn more at [our website](https://example.com).",
        variant: "default",
        columns: 1,
      },
    },
    PageHeader: {
      fields: {
        title: { type: "text" },
        subtitle: { type: "textarea" },
        lastUpdated: { type: "text", label: "Last Updated Date" },
        breadcrumbs: {
          type: "array",
          getItemSummary: (item) => item.label || "Breadcrumb",
          arrayFields: {
            label: { type: "text" },
            href: { type: "text" },
          },
        },
        variant: {
          type: "select",
          options: [
            { label: "Default (Left)", value: "default" },
            { label: "Centered", value: "centered" },
            { label: "Minimal", value: "minimal" },
          ],
        },
        showDivider: {
          type: "radio",
          options: [
            { label: "Yes", value: true },
            { label: "No", value: false },
          ],
        },
      },
      render: (props: PageHeaderProps) => <PageHeader {...props} />,
      defaultProps: {
        title: "Privacy Policy",
        subtitle:
          "This policy describes how we collect, use, and protect your personal information.",
        lastUpdated: "November 2024",
        breadcrumbs: [{ label: "Privacy Policy" }],
        variant: "default",
        showDivider: true,
      },
    },
    TableOfContents: {
      fields: {
        title: { type: "text" },
        items: {
          type: "array",
          getItemSummary: (item) => item.title || "Section",
          arrayFields: {
            title: { type: "text" },
            anchor: { type: "text", label: "Anchor ID (without #)" },
            level: {
              type: "select",
              options: [
                { label: "Level 1 (Main)", value: 1 },
                { label: "Level 2 (Sub)", value: 2 },
                { label: "Level 3 (Nested)", value: 3 },
              ],
            },
          },
        },
        variant: {
          type: "select",
          options: [
            { label: "Default", value: "default" },
            { label: "Card", value: "card" },
            { label: "Sticky Sidebar", value: "sticky" },
          ],
        },
        showIcon: {
          type: "radio",
          options: [
            { label: "Yes", value: true },
            { label: "No", value: false },
          ],
        },
      },
      render: (props: TableOfContentsProps) => <TableOfContents {...props} />,
      defaultProps: {
        title: "Table of Contents",
        items: [
          { title: "Introduction", anchor: "introduction", level: 1 },
          { title: "Data Collection", anchor: "data-collection", level: 1 },
          { title: "Personal Information", anchor: "personal-info", level: 2 },
          { title: "Your Rights", anchor: "your-rights", level: 1 },
          { title: "Contact Us", anchor: "contact", level: 1 },
        ],
        variant: "card",
        showIcon: true,
      },
    },
  },
};

export default config;
