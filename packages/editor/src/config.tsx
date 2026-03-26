"use client";
import { type Config } from "@puckeditor/core";
import { BasicsComponents } from "./config/basics";
import { ContentComponents } from "./config/content";
import { DataDisplayComponents } from "./config/data-display";
import { GridComponents } from "./config/grids";
import { HeroComponents } from "./config/heroes";
import { InteractiveComponents } from "./config/interactive";
import { LayoutComponents } from "./config/layout";
import { MarketingComponents } from "./config/marketing";
import type { Props } from "./config/types";
import { CONTENT_TYPE_OPTIONS } from "./content-types/registry";

// Explicitly type the Config with Props to help TS inference
export const config: Config<Props> = {
  root: {
    // title, slug, description, visibility are managed by the Sheet dialog
    // in editor.tsx / unified-editor.tsx — not shown in the right sidebar.
    fields: {
      contentType: {
        type: "select",
        label: "Content Type",
        options: CONTENT_TYPE_OPTIONS,
      },
      seoTitle: {
        type: "text",
        label: "SEO Title (override)",
      },
      seoDescription: {
        type: "textarea",
        label: "SEO Description",
      },
      ogImage: {
        type: "image" as never,
        label: "Social Share Image",
      },
      scheduledPublishAt: {
        type: "text",
        label: "Schedule Publish (YYYY-MM-DD HH:mm)",
      },
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
    ...ContentComponents,
    ...MarketingComponents,
    ...InteractiveComponents,
    ...DataDisplayComponents,
  },
};

export type { Props } from "./config/types";
export default config;
