"use client";
import { type Config } from "@puckeditor/core";
import { BasicsComponents } from "./config/basics";
import { ContentComponents } from "./config/content";
import { DataDisplayComponents } from "./config/data-display";
import { GridComponent, GridComponents } from "./config/grids";
import { HeroComponents } from "./config/heroes";
import { InteractiveComponents } from "./config/interactive";
import { LayoutComponents } from "./config/layout";
import { MarketingComponents } from "./config/marketing";
import type { Props } from "./config/types";
import { CONTENT_TYPE_OPTIONS } from "./content-types/registry";

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
      scheduledPublishAt: {
        type: "datetime-picker" as never,
        label: "Schedule Date & Time",
      },
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
      components: ["ArticleDetail", "EventDetail"],
    },
  },
  components: {
    ...BasicsComponents,
    ...LayoutComponents,
    ...HeroComponents,
    ...GridComponents,
    ...GridComponent,
    ...ContentComponents,
    ...MarketingComponents,
    ...InteractiveComponents,
    ...DataDisplayComponents,
  },
};

export type { Props } from "./config/types";
export default config;
