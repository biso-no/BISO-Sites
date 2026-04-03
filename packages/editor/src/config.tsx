import { type Config } from "@puckeditor/core";
import { BasicsComponents } from "./config/basics";
import { ContentComponents } from "./config/content";
import { DataDisplayComponents } from "./config/data-display";
import { DetailComponents } from "./config/detail";
import { ExtrasComponents } from "./config/extras";
import { GridComponent, GridComponents } from "./config/grids";
import { HeroComponents } from "./config/heroes";
import { InteractiveComponents } from "./config/interactive";
import { LayoutComponents } from "./config/layout";
import { MarketingComponents } from "./config/marketing";
import type { Props } from "./config/types";
import { CONTENT_TYPE_OPTIONS } from "./content-types/registry";

function sanitizeSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Explicitly type the Config with Props to help TS inference
export const config: Config<Props> = {
  root: {
    // Page metadata fields — promoted from the removed Settings/Cog sheet.
    // SEO fields (seoTitle, seoDescription, ogImage) are edited via the
    // "SEO Tools" sidebar panel, not here.
    fields: {
      title: {
        type: "text",
        label: "Page Title",
      },
      slug: {
        type: "text",
        label: "URL Slug",
      },
      description: {
        type: "textarea",
        label: "Description",
      },
      // TODO: Investigate the Content Type selector hover state — the Puck field
      // wrapper applies a hover background that conflicts with the select's own
      // hover style, producing a double-highlight effect. Also audit whether this
      // field is still load-bearing in the content-type starter template system
      // (CONTENT_TYPES registry in content-types/registry.ts) before removing.
      // Leave removal for a dedicated cleanup task.
      contentType: {
        type: "select",
        label: "Content Type",
        options: CONTENT_TYPE_OPTIONS,
      },
      // Publish control: "Publish later" reveals the date/time picker below.
      publishMode: {
        type: "select",
        label: "Publish",
        options: [
          { label: "Publish now", value: "now" },
          { label: "Publish later", value: "later" },
        ],
      },
      // "datetime-picker" is rendered via overrides.fieldTypes in puck-ui.tsx.
      // Puck's type system doesn't support adding new field type names, so we
      // use a cast here. This is safe — the runtime renderer handles this key.
      scheduledPublishAt: {
        type: "datetime-picker",
        label: "Schedule Date & Time",
      } as never,
      campus: {
        type: "select",
        label: "Campus",
        options: [
          { label: "Oslo", value: "1" },
          { label: "Bergen", value: "2" },
          { label: "Trondheim", value: "3" },
          { label: "Stavanger", value: "4" },
          { label: "National", value: "5" },
        ],
      }
    },

    // Conditionally hide scheduledPublishAt unless publishMode is "later".
    resolveFields: async (data, { fields }) => {
      if ((data.props as Record<string, unknown>)?.publishMode !== "later") {
        const { scheduledPublishAt: _omit, ...rest } = fields;
        return rest;
      }
      return fields;
    },

    // Auto-populate slug from title, and lock the slug field for scoped users.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolveData: async ({ props }, { changed, lastData, metadata }: any) => {
      const p = props as Record<string, unknown>;
      const isSlugLocked =
        (metadata as { constraints?: { slugLocked?: boolean } })?.constraints
          ?.slugLocked ?? false;

      if (isSlugLocked) {
        // Slug is enforced server-side (department users); mark it read-only in the UI
        return { props, readOnly: { slug: true } };
      }

      if (!changed.title) return { props };

      const newTitle = (p.title as string) ?? "";
      const currentSlug = (p.slug as string) ?? "";

      // Auto-fill when slug is empty
      if (!currentSlug.trim()) {
        return { props: { ...p, slug: sanitizeSlug(newTitle) } };
      }

      // Also keep slug in sync while it still matches the previously auto-generated
      // value, meaning the user has not manually customised it yet.
      const prevProps = (lastData?.props ?? {}) as Record<string, unknown>;
      const prevTitle = (prevProps.title as string) ?? "";
      if (currentSlug === sanitizeSlug(prevTitle)) {
        return { props: { ...p, slug: sanitizeSlug(newTitle) } };
      }

      return { props };
    },

    defaultProps: {
      publishMode: "now",
    },
  },
  categories: {
    basics: {
      title: "Basics",
      components: [
        "Heading",
        "Text",
        "Image",
        "ButtonRow",
        "Divider",
        "VideoEmbed",
      ],
    },
    layout: {
      title: "Layout",
      components: ["Section", "Columns", "Spacer", "Tabs"],
    },
    heroes: {
      title: "Heroes & Headers",
      components: ["Hero", "PageHeader", "Banner"],
    },
    grids: {
      title: "Grids & Lists",
      components: [
        "Grid",
        "FeatureGrid",
        "StatsGrid",
        "TeamGrid",
        "LogoGrid",
        "PricingTable",
      ],
    },
    content: {
      title: "Content",
      components: [
        "Accordion",
        "Timeline",
        "RichText",
        "TableOfContents",
        "Testimonials",
      ],
    },
    marketing: {
      title: "Marketing & CTA",
      components: ["CTA", "About", "JoinUs", "Countdown"],
    },
    interactive: {
      title: "Interactive",
      components: ["ContactForm", "MapEmbed"],
    },
    dataDisplay: {
      title: "Data Display",
      components: [
        "News",
        "Events",
        "EventsCalendar",
        "JobsList",
        "ProductsGrid",
        "DepartmentsGrid",
        "FilterBar",
        "Collection",
      ],
    },
    detail: {
      title: "Detail Pages",
      components: ["ArticleDetail", "EventDetail", "JobDetail", "ProductDetail"],
    },
    extras: {
      title: "Content Blocks",
      components: [
        "ContactCards",
        "DownloadList",
        "NumberedSteps",
        "TagList",
        "AlertCard",
        "ChecklistCard",
      ],
    },
  },
  components: {
    ...BasicsComponents,
    ...LayoutComponents,
    ...HeroComponents,
    ...GridComponents,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...(GridComponent as any),
    ...ContentComponents,
    ...MarketingComponents,
    ...InteractiveComponents,
    ...DataDisplayComponents,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...(DetailComponents as any),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...(ExtrasComponents as any),
  },
};

export type { Props } from "./config/types";
export default config;
