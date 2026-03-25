"use client";
import { type Config } from "@puckeditor/core";
import { BasicsComponents } from "./config/basics";
import { ContentComponents } from "./config/content";
import { DataDisplayComponents } from "./config/data-display";
import { GridComponents } from "./config/grids";
import { HeroComponents } from "./config/heroes";
import { LayoutComponents } from "./config/layout";
import { MarketingComponents } from "./config/marketing";
import type { Props } from "./config/types";

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
    ...BasicsComponents,
    ...LayoutComponents,
    ...HeroComponents,
    ...GridComponents,
    ...ContentComponents,
    ...MarketingComponents,
    ...DataDisplayComponents,
  },
};

export type { Props } from "./config/types";
export default config;
