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
import { TABLE_SCHEMAS } from "../../data/schemas";
import { getDynamicContent } from "../../get-dynamic-content";
import {
  DATA_MODE_FIELD,
  buildExternalDataSourceField,
  shouldResolveDynamic,
} from "../helpers/dynamic-data";
import {
  buildLockedScopeField,
  getEffectiveScope,
  getScopeFieldForUser,
  isDepartmentUser,
  type ScopeUser,
} from "../helpers/permission-scope";
import {
  buildPageScopeFilters,
  deriveJobSlug,
  formatNokPrice,
  getMetaBoolean,
  getMetaString,
  mergeFilters,
  normalizeSubtitle,
  resolveComponentPermissions,
} from "../utils";
import type {
  ArticleDetailProps,
  DataSourceValue,
  DepartmentsGridProps,
  EditorCollectionProps,
  EditorEventsProps,
  EditorJobsListProps,
  EditorMetadata,
  EditorNewsProps,
  EditorProductsGridProps,
  EventDetailProps,
  EventsCalendarProps,
} from "../types";
import type { NewsItem } from "@repo/ui/components/sections/news";
import type { EventItem } from "@repo/ui/components/sections/events";
import { DataBlockPlaceholder } from "../data-block-placeholder";

export const DataDisplayComponents = {
  News: {
    label: "News",
    resolvePermissions: resolveComponentPermissions,
    resolveFields: (data: any, { metadata }: any): any => {
      const user = (metadata as any)?.user as ScopeUser | undefined;
      const fields: Record<string, unknown> = { dataMode: DATA_MODE_FIELD };

      if (data.props.dataMode === "dynamic") {
        const scopeField = getScopeFieldForUser(user);
        if (scopeField) {
          fields.scope = scopeField;
        } else {
          fields._scopeInfo = buildLockedScopeField(
            user?.departmentNames?.[0] ?? "your department"
          ) as any;
        }
        fields.dataSource = buildExternalDataSourceField(
          "news",
          "News Source"
        ) as any;
      } else {
        fields.news = {
          type: "array",
          getItemSummary: (item: { title?: string }) => item.title || "Article",
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
      if (
        !shouldResolveDynamic({
          trigger,
          changed,
          watchKeys: ["dataMode", "dataSource", "scope"],
        })
      ) {
        return { props: {} };
      }

      if (props.dataMode !== "dynamic" || !props.dataSource?.table) {
        return { props: {} };
      }

      try {
        const editorMetadata = metadata as EditorMetadata | undefined;
        const user = editorMetadata?.user as ScopeUser | undefined;
        const locale = editorMetadata?.locale ?? props.dataSource.locale;
        const scopeFilters = await buildPageScopeFilters(
          "news",
          getEffectiveScope(props.scope, user),
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

        return { props: { news }, readOnly: { news: true } };
      } catch (e) {
        console.error("Failed to resolve news", e);
        return { props: {} };
      }
    },
    render: (props: EditorNewsProps & { puck?: any }) => {
      if (props.puck?.isEditing) {
        return (
          <DataBlockPlaceholder
            type="News"
            itemCount={props.dataSource?.limit ?? 6}
          />
        );
      }
      return <FilteredNews {...props} />;
    },
    defaultProps: {
      dataMode: "dynamic",
      scope: "page",
      dataSource: {
        table: "news",
        limit: 6,
        sort: { field: "$createdAt", direction: "desc" },
        filters: [
          { field: "status", operator: "equal", value: "published" },
        ] as DataSourceValue["filters"],
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
    label: "Events",
    resolvePermissions: resolveComponentPermissions,
    resolveFields: (data: any, { metadata }: any): any => {
      const user = (metadata as any)?.user as ScopeUser | undefined;
      const fields: Record<string, unknown> = { dataMode: DATA_MODE_FIELD };

      if (data.props.dataMode === "dynamic") {
        const scopeField = getScopeFieldForUser(user);
        if (scopeField) {
          fields.scope = scopeField;
        } else {
          fields._scopeInfo = buildLockedScopeField(
            user?.departmentNames?.[0] ?? "your department"
          ) as any;
        }
        fields.dataSource = buildExternalDataSourceField(
          "events",
          "Events Source"
        ) as any;
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
      if (
        !shouldResolveDynamic({
          trigger,
          changed,
          watchKeys: ["dataMode", "dataSource", "scope"],
        })
      ) {
        return { props: {} };
      }

      if (props.dataMode !== "dynamic" || !props.dataSource?.table) {
        return { props: {} };
      }

      try {
        const editorMetadata = metadata as EditorMetadata | undefined;
        const user = editorMetadata?.user as ScopeUser | undefined;
        const locale = editorMetadata?.locale ?? props.dataSource.locale;
        const scopeFilters = await buildPageScopeFilters(
          "events",
          getEffectiveScope(props.scope, user),
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

        return { props: { events }, readOnly: { events: true } };
      } catch (e) {
        console.error("Failed to resolve events", e);
        return { props: {} };
      }
    },
    render: (props: EditorEventsProps & { puck?: any }) => {
      if (props.puck?.isEditing) {
        return (
          <DataBlockPlaceholder
            type="Events"
            itemCount={props.dataSource?.limit ?? 6}
          />
        );
      }
      return <FilteredEvents {...props} />;
    },
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
    label: "Jobs List",
    resolvePermissions: resolveComponentPermissions,
    resolveFields: (data: any, { metadata }: any): any => {
      const user = (metadata as any)?.user as ScopeUser | undefined;
      const fields: Record<string, unknown> = { dataMode: DATA_MODE_FIELD };

      if (data.props.dataMode === "dynamic") {
        const scopeField = getScopeFieldForUser(user);
        if (scopeField) {
          fields.scope = scopeField;
        } else {
          fields._scopeInfo = buildLockedScopeField(
            user?.departmentNames?.[0] ?? "your department"
          ) as any;
        }
        fields.dataSource = buildExternalDataSourceField(
          "jobs",
          "Jobs Source"
        ) as any;
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
      if (
        !shouldResolveDynamic({
          trigger,
          changed,
          watchKeys: ["dataMode", "dataSource", "scope"],
        })
      ) {
        return { props: {} };
      }

      if (props.dataMode !== "dynamic" || !props.dataSource?.table) {
        return { props: {} };
      }

      try {
        const editorMetadata = metadata as EditorMetadata | undefined;
        const user = editorMetadata?.user as ScopeUser | undefined;
        const locale = editorMetadata?.locale ?? props.dataSource.locale;
        const scopeFilters = await buildPageScopeFilters(
          "jobs",
          getEffectiveScope(props.scope, user),
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

        return { props: { jobs }, readOnly: { jobs: true } };
      } catch (e) {
        console.error("Failed to resolve jobs", e);
        return { props: {} };
      }
    },
    render: (props: EditorJobsListProps & { puck?: any }) => {
      if (props.puck?.isEditing) {
        return (
          <DataBlockPlaceholder
            type="Jobs List"
            itemCount={props.dataSource?.limit ?? 12}
          />
        );
      }
      return <JobsList {...props} />;
    },
    defaultProps: {
      dataMode: "dynamic",
      scope: "page",
      dataSource: {
        table: "jobs",
        limit: 12,
        sort: { field: "$createdAt", direction: "desc" },
        filters: [
          { field: "status", operator: "equal", value: "published" },
        ] as DataSourceValue["filters"],
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
    label: "Products Grid",
    resolvePermissions: resolveComponentPermissions,
    resolveFields: (data: any, { metadata }: any): any => {
      const user = (metadata as any)?.user as ScopeUser | undefined;
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
        dataMode: DATA_MODE_FIELD,
      };

      if (data.props.dataMode === "dynamic") {
        const scopeField = getScopeFieldForUser(user);
        if (scopeField) {
          fields.scope = scopeField;
        } else {
          fields._scopeInfo = buildLockedScopeField(
            user?.departmentNames?.[0] ?? "your department"
          ) as any;
        }
        fields.dataSource = buildExternalDataSourceField(
          "products",
          "Products Source"
        ) as any;
      } else {
        fields.products = {
          type: "array",
          getItemSummary: (item: { title?: string }) => item.title || "Product",
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
      if (
        !shouldResolveDynamic({
          trigger,
          changed,
          watchKeys: ["dataMode", "dataSource", "scope"],
        })
      ) {
        return { props: {} };
      }

      if (props.dataMode !== "dynamic" || !props.dataSource?.table) {
        return { props: {} };
      }

      try {
        const editorMetadata = metadata as EditorMetadata | undefined;
        const user = editorMetadata?.user as ScopeUser | undefined;
        const locale = editorMetadata?.locale ?? props.dataSource.locale;
        const scopeFilters = await buildPageScopeFilters(
          "products",
          getEffectiveScope(props.scope, user),
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

        return { props: { products }, readOnly: { products: true } };
      } catch (e) {
        console.error("Failed to resolve products", e);
        return { props: {} };
      }
    },
    render: (props: EditorProductsGridProps & { puck?: any }) => {
      if (props.puck?.isEditing) {
        return (
          <DataBlockPlaceholder
            type="Products Grid"
            itemCount={props.dataSource?.limit ?? 8}
          />
        );
      }
      return <ProductsGrid {...props} />;
    },
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
    label: "Filter Bar",
    resolvePermissions: resolveComponentPermissions,
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
    resolvePermissions: resolveComponentPermissions,
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
        dataMode: DATA_MODE_FIELD,
      };

      if (data.props.dataMode === "dynamic") {
        fields.dataSource = {
          type: "external",
          label: "Data Source",
          cache: { enabled: true },
          // Collection allows any schema — build a combined list from all schemas
          fetchList: async () =>
            TABLE_SCHEMAS.flatMap((schema) => [
              {
                id: `${schema.id}-default`,
                title: `All ${schema.label}`,
                table: schema.id,
                filters: [],
                sort: schema.defaultSort,
              },
              ...(schema.presetFilters ?? []).map((p, i) => ({
                id: `${schema.id}-preset-${i}`,
                title: p.label,
                table: schema.id,
                filters: p.filters,
                sort: schema.defaultSort,
              })),
            ]),
          filterFields: {
            limit: { type: "number", label: "Limit" },
          },
          mapProp: (selected: any) => ({
            table: selected?.table,
            filters: selected?.filters ?? [],
            sort: selected?.sort,
            limit: selected?.limit ?? 6,
          }),
        } as any;
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
      if (
        !shouldResolveDynamic({
          trigger,
          changed,
          watchKeys: ["dataMode", "dataSource"],
        })
      ) {
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

        return { props: { items: collectionItems }, readOnly: { items: true } };
      } catch (e) {
        console.error("Failed to resolve collection", e);
        return { props: {} };
      }
    },
    render: (props: EditorCollectionProps & { puck?: any }) => {
      if (props.puck?.isEditing) {
        return (
          <DataBlockPlaceholder
            type="Collection"
            itemCount={props.dataSource?.limit ?? 6}
          />
        );
      }
      return <Collection {...props} />;
    },
    defaultProps: {
      layout: "card-grid",
      dataMode: "manual",
      items: [] as CollectionItem[],
      emptyMessage: "No items to display",
      emptyDescription: "Check back later.",
    },
  },
  DepartmentsGrid: {
    label: "Departments Grid",
    resolvePermissions: resolveComponentPermissions,
    resolveFields: (data: any, { metadata }: any): any => {
      const user = (metadata as any)?.user as ScopeUser | undefined;
      const fields: Record<string, unknown> = {
        title: { type: "text", label: "Title" },
        subtitle: { type: "textarea", label: "Subtitle" },
        variant: {
          type: "select",
          label: "Variant",
          options: [
            { label: "Card", value: "card" },
            { label: "Compact", value: "compact" },
          ],
        },
        columns: {
          type: "select",
          label: "Columns",
          options: [
            { label: "2 Columns", value: 2 },
            { label: "3 Columns", value: 3 },
            { label: "4 Columns", value: 4 },
          ],
        },
        showFilters: {
          type: "radio",
          label: "Show Filters",
          options: [
            { label: "Yes", value: true },
            { label: "No", value: false },
          ],
        },
        dataMode: DATA_MODE_FIELD,
      };

      if (data.props.dataMode === "dynamic") {
        const scopeField = getScopeFieldForUser(user);
        if (scopeField) {
          fields.scope = scopeField;
        } else {
          fields._scopeInfo = buildLockedScopeField(
            user?.departmentNames?.[0] ?? "your department"
          ) as any;
        }
        fields.dataSource = buildExternalDataSourceField(
          "departments",
          "Departments Source"
        ) as any;
      } else {
        fields.items = {
          type: "array",
          label: "Departments",
          getItemSummary: (item: { title?: string }) =>
            item.title || "Department",
          arrayFields: {
            title: { type: "text", label: "Name" },
            subtitle: { type: "text", label: "Type" },
            image: { type: "image", label: "Logo" },
            badge: { type: "text", label: "Member Count" },
            href: { type: "text", label: "Link URL" },
          },
        };
      }

      return fields;
    },
    resolveData: async (
      { props }: { props: DepartmentsGridProps },
      { changed, trigger, metadata }: any
    ) => {
      if (
        !shouldResolveDynamic({
          trigger,
          changed,
          watchKeys: ["dataMode", "dataSource", "scope"],
        })
      ) {
        return { props: {} };
      }

      if (props.dataMode !== "dynamic" || !props.dataSource?.table) {
        return { props: {} };
      }

      try {
        const editorMetadata = metadata as EditorMetadata | undefined;
        const user = editorMetadata?.user as ScopeUser | undefined;
        const locale = editorMetadata?.locale ?? props.dataSource.locale;
        const scopeFilters = isDepartmentUser(user)
          ? [
              {
                field: "Name",
                operator: "equal",
                value: user!.departmentNames[0]!,
              },
            ]
          : [];

        const items = await getDynamicContent({
          ...props.dataSource,
          table: "departments",
          locale,
          filters: mergeFilters(props.dataSource.filters, scopeFilters),
          limit: props.dataSource.limit ?? 12,
        });

        const collectionItems: CollectionItem[] = items.map((item) => ({
          id: item.id || crypto.randomUUID(),
          title: item.title || (item as any).Name || "",
          subtitle: item.category || (item as any).type || "",
          image: item.image || (item as any).logo || "",
          badge: item.badge,
          href: item.href,
        }));

        return { props: { items: collectionItems }, readOnly: { items: true } };
      } catch (e) {
        console.error("Failed to resolve departments", e);
        return { props: {} };
      }
    },
    render: (props: DepartmentsGridProps & { puck?: any }) => {
      if (props.puck?.isEditing) {
        return (
          <DataBlockPlaceholder
            type="Departments Grid"
            itemCount={props.dataSource?.limit ?? 12}
          />
        );
      }
      const layout = props.variant === "compact" ? "compact-card" : "card-grid";
      return (
        <Collection
          title={props.title}
          subtitle={props.subtitle}
          layout={layout}
          columns={props.columns ?? 3}
          items={props.items ?? []}
          showFilters={props.showFilters}
          emptyMessage="No departments found"
          emptyDescription="Check back later."
        />
      );
    },
    defaultProps: {
      title: "Departments",
      subtitle: "Explore our student organizations and committees.",
      variant: "card" as const,
      columns: 3 as const,
      showFilters: false,
      dataMode: "dynamic",
      scope: "all",
      dataSource: {
        table: "departments",
        limit: 12,
        sort: { field: "Name", direction: "asc" },
        filters: [
          { field: "active", operator: "equal", value: true },
        ] as DataSourceValue["filters"],
      },
      items: [] as CollectionItem[],
    },
  },
  EventsCalendar: {
    label: "Events Calendar",
    resolvePermissions: resolveComponentPermissions,
    resolveFields: (data: any, { metadata }: any): any => {
      const user = (metadata as any)?.user as ScopeUser | undefined;
      const fields: Record<string, unknown> = {
        title: { type: "text", label: "Title" },
        view: {
          type: "select",
          label: "View",
          options: [
            { label: "Calendar", value: "calendar" },
            { label: "List", value: "list" },
            { label: "Timeline", value: "timeline" },
          ],
        },
        showFilters: {
          type: "radio",
          label: "Show Filters",
          options: [
            { label: "Yes", value: true },
            { label: "No", value: false },
          ],
        },
        dataMode: DATA_MODE_FIELD,
      };

      if (data.props.dataMode === "dynamic") {
        const scopeField = getScopeFieldForUser(user);
        if (scopeField) {
          fields.scope = scopeField;
        } else {
          fields._scopeInfo = buildLockedScopeField(
            user?.departmentNames?.[0] ?? "your department"
          ) as any;
        }
        fields.dataSource = buildExternalDataSourceField(
          "events",
          "Events Source"
        ) as any;
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

      return fields;
    },
    resolveData: async (
      { props }: { props: EventsCalendarProps },
      { changed, trigger, metadata }: any
    ) => {
      if (
        !shouldResolveDynamic({
          trigger,
          changed,
          watchKeys: ["dataMode", "dataSource"],
        })
      ) {
        return { props: {} };
      }

      if (props.dataMode !== "dynamic" || !props.dataSource?.table) {
        return { props: {} };
      }

      try {
        const editorMetadata = metadata as EditorMetadata | undefined;
        const user = editorMetadata?.user as ScopeUser | undefined;
        const locale = editorMetadata?.locale ?? props.dataSource.locale;
        const scopeFilters = await buildPageScopeFilters(
          "events",
          getEffectiveScope((props as any).scope, user),
          editorMetadata
        );

        const items = await getDynamicContent({
          ...props.dataSource,
          table: "events",
          locale,
          filters: mergeFilters(props.dataSource.filters, scopeFilters),
          limit: props.dataSource.limit ?? 20,
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

        return { props: { events }, readOnly: { events: true } };
      } catch (e) {
        console.error("Failed to resolve events calendar", e);
        return { props: {} };
      }
    },
    render: (props: EventsCalendarProps & { puck?: any }) => {
      if (props.puck?.isEditing) {
        return (
          <DataBlockPlaceholder
            type="Events Calendar"
            itemCount={props.dataSource?.limit ?? 20}
          />
        );
      }
      return (
        <FilteredEvents
          {...({
            events: props.events ?? [],
            labels: {
              empty: "No events",
              emptyDescription: "Check back later",
              upcomingEvents: props.title ?? "Events Calendar",
              dontMissOut: "",
              amazingExperiences: "",
              description: "",
              registerNow: "Register Now",
              viewAllEvents: "View All Events",
            },
          } as any)}
        />
      );
    },
    defaultProps: {
      title: "Events Calendar",
      view: "list" as const,
      showFilters: true,
      dataMode: "dynamic",
      dataSource: {
        table: "events",
        limit: 20,
        sort: { field: "start_date", direction: "asc" },
        filters: [
          { field: "start_date", operator: "greaterThan", value: "$now" },
          { field: "status", operator: "equal", value: "published" },
        ] as DataSourceValue["filters"],
      },
      events: [] as EventItem[],
    },
  },
  ArticleDetail: {
    label: "Article Detail",
    resolvePermissions: resolveComponentPermissions,
    resolveFields: (data: any): any => {
      const fields: Record<string, unknown> = {
        layout: {
          type: "select",
          label: "Layout",
          options: [
            { label: "Standard", value: "standard" },
            { label: "Wide", value: "wide" },
          ],
        },
        showRelated: {
          type: "radio",
          label: "Show Related Articles",
          options: [
            { label: "Yes", value: true },
            { label: "No", value: false },
          ],
        },
        dataMode: DATA_MODE_FIELD,
      };

      if (data.props.dataMode === "dynamic") {
        fields.dataSource = buildExternalDataSourceField(
          "news",
          "Article Source"
        ) as any;
      } else {
        fields.title = { type: "text", label: "Title" };
        fields.author = { type: "text", label: "Author" };
        fields.date = { type: "text", label: "Date" };
        fields.image = { type: "image", label: "Hero Image" };
        fields.content = { type: "textarea", label: "Content" };
      }

      if (data.props.showRelated) {
        fields.relatedItems = {
          type: "array",
          label: "Related Articles",
          getItemSummary: (item: { title?: string }) => item.title || "Article",
          arrayFields: {
            title: { type: "text", label: "Title" },
            href: { type: "text", label: "Link" },
            image: { type: "image", label: "Image" },
          },
        };
      }

      return fields;
    },
    resolveData: async (
      { props }: { props: ArticleDetailProps },
      { changed, trigger, metadata }: any
    ) => {
      if (
        !shouldResolveDynamic({
          trigger,
          changed,
          watchKeys: ["dataMode", "dataSource"],
        })
      ) {
        return { props: {} };
      }

      if (props.dataMode !== "dynamic" || !props.dataSource?.table) {
        return { props: {} };
      }

      try {
        const editorMetadata = metadata as EditorMetadata | undefined;
        const locale = editorMetadata?.locale ?? props.dataSource.locale;

        const items = await getDynamicContent({
          ...props.dataSource,
          table: "news",
          locale,
          filters: props.dataSource.filters,
          limit: 1,
        });

        const article = items[0];
        if (!article) {
          return { props: {} };
        }

        return {
          props: {
            title: article.title,
            author: article.subtitle || "",
            date: article.date || new Date().toISOString(),
            image: article.image || "",
            content: article.description || "",
          },
          readOnly: {
            title: true,
            author: true,
            date: true,
            image: true,
            content: true,
          },
        };
      } catch (e) {
        console.error("Failed to resolve article detail", e);
        return { props: {} };
      }
    },
    render: (props: ArticleDetailProps & { puck?: any }) => {
      if (props.puck?.isEditing) {
        return (
          <DataBlockPlaceholder
            type="Article Detail"
            itemCount={props.dataSource?.limit ?? 1}
          />
        );
      }
      const isWide = props.layout === "wide";
      return (
        <article
          className={`mx-auto py-8 ${isWide ? "max-w-5xl" : "max-w-3xl"}`}
        >
          {props.image && (
            <div className="mb-8 overflow-hidden rounded-xl">
              <img
                src={props.image}
                alt={props.title || ""}
                className="h-64 w-full object-cover md:h-96"
              />
            </div>
          )}
          <header className="mb-8">
            <h1 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
              {props.title || "Article Title"}
            </h1>
            <div className="flex items-center gap-4 text-sm text-gray-500">
              {props.author && <span>By {props.author}</span>}
              {props.date && (
                <time dateTime={props.date}>
                  {new Date(props.date).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </time>
              )}
            </div>
          </header>
          <div className="prose prose-lg max-w-none">
            <p>{props.content || "Article content goes here..."}</p>
          </div>
          {props.showRelated &&
            props.relatedItems &&
            props.relatedItems.length > 0 && (
              <section className="mt-12 border-t pt-8">
                <h2 className="mb-6 text-2xl font-semibold">
                  Related Articles
                </h2>
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {props.relatedItems.map((item, i) => (
                    <a
                      key={i}
                      href={item.href}
                      className="group block overflow-hidden rounded-lg border transition-shadow hover:shadow-md"
                    >
                      {item.image && (
                        <img
                          src={item.image}
                          alt={item.title}
                          className="h-40 w-full object-cover"
                        />
                      )}
                      <div className="p-4">
                        <h3 className="font-medium group-hover:text-blue-600">
                          {item.title}
                        </h3>
                      </div>
                    </a>
                  ))}
                </div>
              </section>
            )}
        </article>
      );
    },
    defaultProps: {
      layout: "standard" as const,
      showRelated: false,
      dataMode: "dynamic",
      dataSource: {
        table: "news",
        limit: 1,
        filters: [
          { field: "status", operator: "equal", value: "published" },
        ] as DataSourceValue["filters"],
      },
      title: "",
      author: "",
      date: "",
      image: "",
      content: "",
      relatedItems: [] as { title: string; href: string; image?: string }[],
    },
  },
  EventDetail: {
    label: "Event Detail",
    resolvePermissions: resolveComponentPermissions,
    resolveFields: (data: any): any => {
      const fields: Record<string, unknown> = {
        showRegistration: {
          type: "radio",
          label: "Show Registration",
          options: [
            { label: "Yes", value: true },
            { label: "No", value: false },
          ],
        },
        showMap: {
          type: "radio",
          label: "Show Map",
          options: [
            { label: "Yes", value: true },
            { label: "No", value: false },
          ],
        },
        dataMode: DATA_MODE_FIELD,
      };

      if (data.props.dataMode === "dynamic") {
        fields.dataSource = buildExternalDataSourceField(
          "events",
          "Event Source"
        ) as any;
      } else {
        fields.title = { type: "text", label: "Title" };
        fields.date = { type: "text", label: "Start Date" };
        fields.endDate = { type: "text", label: "End Date" };
        fields.location = { type: "text", label: "Location" };
        fields.image = { type: "image", label: "Image" };
        fields.description = { type: "textarea", label: "Description" };
        fields.ticketUrl = { type: "text", label: "Ticket / Registration URL" };
        fields.price = { type: "text", label: "Price" };
      }

      return fields;
    },
    resolveData: async (
      { props }: { props: EventDetailProps },
      { changed, trigger, metadata }: any
    ) => {
      if (
        !shouldResolveDynamic({
          trigger,
          changed,
          watchKeys: ["dataMode", "dataSource"],
        })
      ) {
        return { props: {} };
      }

      if (props.dataMode !== "dynamic" || !props.dataSource?.table) {
        return { props: {} };
      }

      try {
        const editorMetadata = metadata as EditorMetadata | undefined;
        const locale = editorMetadata?.locale ?? props.dataSource.locale;

        const items = await getDynamicContent({
          ...props.dataSource,
          table: "events",
          locale,
          filters: props.dataSource.filters,
          limit: 1,
        });

        const event = items[0];
        if (!event) {
          return { props: {} };
        }

        const meta = (event.metadata ?? {}) as Record<string, unknown>;

        return {
          props: {
            title: event.title,
            date: event.date || "",
            endDate: (meta.end_date as string) || "",
            location: event.location || "",
            image: event.image || "",
            description: event.description || "",
            price: (meta.price as string) || "",
            ticketUrl: (meta.ticketUrl as string) || event.href || "",
          },
          readOnly: {
            title: true,
            date: true,
            endDate: true,
            location: true,
            image: true,
            description: true,
            price: true,
            ticketUrl: true,
          },
        };
      } catch (e) {
        console.error("Failed to resolve event detail", e);
        return { props: {} };
      }
    },
    render: (props: EventDetailProps & { puck?: any }) => {
      if (props.puck?.isEditing) {
        return (
          <DataBlockPlaceholder
            type="Event Detail"
            itemCount={props.dataSource?.limit ?? 1}
          />
        );
      }
      const formatDate = (d?: string) => {
        if (!d) return "";
        return new Date(d).toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
      };

      return (
        <article className="mx-auto max-w-4xl py-8">
          {props.image && (
            <div className="mb-8 overflow-hidden rounded-xl">
              <img
                src={props.image}
                alt={props.title || ""}
                className="h-64 w-full object-cover md:h-96"
              />
            </div>
          )}
          <header className="mb-8">
            <h1 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
              {props.title || "Event Title"}
            </h1>
          </header>
          <div className="mb-8 grid gap-4 rounded-lg bg-gray-50 p-6 sm:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-gray-500">Date & Time</p>
              <p className="mt-1 text-sm">{formatDate(props.date)}</p>
              {props.endDate && (
                <p className="mt-1 text-sm text-gray-600">
                  Until {formatDate(props.endDate)}
                </p>
              )}
            </div>
            {props.location && (
              <div>
                <p className="text-sm font-medium text-gray-500">Location</p>
                <p className="mt-1 text-sm">{props.location}</p>
              </div>
            )}
            {props.price && (
              <div>
                <p className="text-sm font-medium text-gray-500">Price</p>
                <p className="mt-1 text-sm">{props.price}</p>
              </div>
            )}
          </div>
          {props.description && (
            <div className="prose prose-lg max-w-none">
              <p>{props.description}</p>
            </div>
          )}
          {props.showRegistration && props.ticketUrl && (
            <div className="mt-8">
              <a
                href={props.ticketUrl}
                className="inline-flex items-center rounded-lg bg-blue-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-700"
              >
                Register Now
              </a>
            </div>
          )}
          {props.showMap && props.location && (
            <div className="mt-8 overflow-hidden rounded-lg">
              <iframe
                title="Event location"
                width="100%"
                height="300"
                style={{ border: 0 }}
                loading="lazy"
                src={`https://www.openstreetmap.org/export/embed.html?bbox=10.3,59.8,10.9,59.98&layer=mapnik`}
              />
            </div>
          )}
        </article>
      );
    },
    defaultProps: {
      showRegistration: true,
      showMap: false,
      dataMode: "dynamic",
      dataSource: {
        table: "events",
        limit: 1,
        filters: [
          { field: "status", operator: "equal", value: "published" },
        ] as DataSourceValue["filters"],
      },
      title: "",
      date: "",
      endDate: "",
      location: "",
      image: "",
      description: "",
      ticketUrl: "",
      price: "",
    },
  },
} as const;
