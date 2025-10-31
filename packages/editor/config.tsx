import { Config } from "@measured/puck";

// UI Components
import { PuckButton } from "./components/ui/button";
import { PuckCard } from "./components/ui/card";
import { PuckBadge } from "./components/ui/badge";
import { PuckAlert } from "./components/ui/alert";
import { PuckInput } from "./components/ui/input";

// Layout Components
import { PuckSection } from "./components/layout/section";
import { PuckContainer } from "./components/layout/container";
import { PuckColumns } from "./components/layout/columns";
import { PuckGrid } from "./components/layout/grid";
import { PuckHero } from "./components/layout/hero";

// Content Blocks
import { PuckCTA } from "./components/content/cta";
import { PuckFeatures } from "./components/content/features";

// Dynamic Components
import { PuckDynamicList } from "./components/dynamic/dynamic-list";
import { PuckDynamicCardGrid } from "./components/dynamic/dynamic-card-grid";

/**
 * Main Puck configuration with all components organized by categories
 */
export const config: Config = {
  components: {
    // UI Elements
    Button: PuckButton as any,
    Card: PuckCard as any,
    Badge: PuckBadge as any,
    Alert: PuckAlert as any,
    Input: PuckInput as any,

    // Layout
    Section: PuckSection as any,
    Container: PuckContainer as any,
    Columns: PuckColumns as any,
    Grid: PuckGrid as any,
    Hero: PuckHero as any,

    // Content Blocks
    CTA: PuckCTA as any,
    Features: PuckFeatures as any,

    // Dynamic Content
    DynamicList: PuckDynamicList as any,
    DynamicCardGrid: PuckDynamicCardGrid as any,
  },
  categories: {
    "UI Elements": {
      components: ["Button", "Card", "Badge", "Alert", "Input"],
    },
    Layout: {
      components: ["Section", "Container", "Columns", "Grid"],
    },
    "Content Blocks": {
      components: ["Hero", "CTA", "Features"],
    },
    "Dynamic Content": {
      components: ["DynamicList", "DynamicCardGrid"],
    },
  },
};
