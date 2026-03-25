"use client";
import { Collection } from "@repo/ui/components/puck/collection/collection";
import {
  type CollectionItem,
  LAYOUT_OPTIONS,
} from "@repo/ui/components/puck/collection/types";
import {
  FilterBar,
  type FilterBarProps,
  type FilterItem,
} from "@repo/ui/components/puck/filter-bar";
import { FilteredEvents } from "@repo/ui/components/puck/filtered-events";
import { FilteredNews } from "@repo/ui/components/puck/filtered-news";
import {
  JobsList,
  type JobItem,
  type JobsListProps,
} from "@repo/ui/components/puck/jobs-list";
import {
  ProductsGrid,
  type ProductsGridItem,
  type ProductsGridProps,
} from "@repo/ui/components/puck/products-grid";
import { TABLE_SCHEMAS } from "../data/schemas";
import { getDynamicContent } from "../get-dynamic-content";
import {
  buildPageScopeFilters,
  deriveJobSlug,
  formatNokPrice,
  getMetaBoolean,
  getMetaString,
  mergeFilters,
  normalizeSubtitle,
} from "./utils";
import type {
  DataSourceValue,
  EditorCollectionProps,
  EditorEventsProps,
  EditorJobsListProps,
  EditorMetadata,
  EditorNewsProps,
  EditorProductsGridProps,
} from "./types";
import type { NewsItem } from "@repo/ui/components/sections/news";
import type { EventItem } from "@repo/ui/components/sections/events";

export const DataDisplayComponents = {
  News: {
    resolveFields: (data: any): any => {
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
    resolveData: async (
      { props }: { props: EditorNewsProps },
      { changed, trigger, metadata }: any
    ) => {
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
        filters: [{ field: "status", operator: "equal", value: "published" }] as DataSourceValue["filters"],
      },
      news: [] as NewsItem[],
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
  Events: {
    resolveFields: (data: any): any => {
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
    resolveData: async (
      { props }: { props: EditorEventsProps },
      { changed, trigger, metadata }: any
    ) => {
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
        ] as DataSourceValue["filters"],
      },
      events: [] as EventItem[],
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
  JobsList: {
    resolveFields: (data: any): any => {
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
    resolveData: async (
      { props }: { props: EditorJobsListProps },
      { changed, trigger, metadata }: any
    ) => {
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
        filters: [{ field: "status", operator: "equal", value: "published" }] as DataSourceValue["filters"],
      },
      jobs: [] as JobItem[],
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
    resolveFields: (data: any): any => {
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
    resolveData: async (
      { props }: { props: EditorProductsGridProps },
      { changed, trigger, metadata }: any
    ) => {
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
        ] as DataSourceValue["filters"],
      },
      products: [] as ProductsGridItem[],
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
        getItemSummary: (item: { label?: string }) => item.label || "Category",
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
      ] as FilterItem[],
    },
  },
  Collection: {
    label: "Collection",
    resolveFields: (data: any): any => {
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
    resolveData: async (
      { props }: { props: EditorCollectionProps },
      { changed, trigger, metadata }: any
    ) => {
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
      items: [] as CollectionItem[],
      emptyMessage: "No items to display",
      emptyDescription: "Check back later.",
    },
  },
} as const;