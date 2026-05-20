import type { Block, BlockType } from "@/editor/types";
import type { BlockDefinition } from "./types";

// Blocks register themselves here via registerBlock().
const registry = new Map<BlockType, BlockDefinition>();

export function registerBlock<B extends Block>(def: BlockDefinition<B>) {
  registry.set(def.type, def as unknown as BlockDefinition);
}

export function getBlock(type: BlockType): BlockDefinition | undefined {
  return registry.get(type);
}

export function allBlocks(): BlockDefinition[] {
  return [...registry.values()];
}

// Block library structure (mirrors the mockup's BLOCK_LIBRARY)
export const BLOCK_LIBRARY: { category: string; items: { type: BlockType; label: string; desc: string }[] }[] = [
  {
    category: "Top of page",
    items: [
      { type: "hero",     label: "Hero",        desc: "The big intro at the top" },
      { type: "marquee",  label: "Marquee",     desc: "Scrolling text strip" },
    ],
  },
  {
    category: "Tell a story",
    items: [
      { type: "text",     label: "Rich text",   desc: "Headings, paragraphs, bullets" },
      { type: "quote",    label: "Pull quote",  desc: "A line worth standing on its own" },
      { type: "callout",  label: "Callout",     desc: "An info box with an icon" },
      { type: "twoCol",   label: "Two columns", desc: "Side-by-side blocks" },
    ],
  },
  {
    category: "Show people & numbers",
    items: [
      { type: "team",     label: "Team grid",   desc: "Officers, board, members" },
      { type: "stats",    label: "Big numbers", desc: "Three or four metrics in a row" },
      { type: "timeline", label: "Timeline",    desc: "Year-by-year milestones" },
    ],
  },
  {
    category: "Media",
    items: [
      { type: "image",    label: "Image",       desc: "A single photo with caption" },
      { type: "gallery",  label: "Gallery",     desc: "A grid of photos" },
      { type: "video",    label: "Video",       desc: "Embed YouTube or Vimeo" },
    ],
  },
  {
    category: "Pull from BISO",
    items: [
      { type: "events",   label: "Events feed", desc: "Auto-updates from your dept" },
      { type: "jobs",     label: "Open roles",  desc: "Your unit's job board" },
      { type: "news",     label: "News feed",   desc: "Latest posts" },
    ],
  },
  {
    category: "Engage",
    items: [
      { type: "cta",           label: "Big button",    desc: "One headline, one action" },
      { type: "faq",           label: "FAQ",           desc: "Expandable questions" },
      { type: "contact",       label: "Contact",       desc: "Email, address, socials" },
      { type: "signup",        label: "Signup form",   desc: "Collect emails or interest" },
      { type: "multiStepForm", label: "Multi-step form", desc: "Step-by-step form builder" },
    ],
  },
  {
    category: "Layout",
    items: [
      { type: "featureGrid",   label: "Feature grid",   desc: "Icon cards in a grid" },
      { type: "linkTileGrid",  label: "Link tiles",     desc: "Navigation tile grid" },
      { type: "tabs",          label: "Tabs",           desc: "Tabbed content panels" },
      { type: "scrollRow",     label: "Scroll row",     desc: "Horizontal scrollable cards" },
      { type: "featuredCards", label: "Featured cards", desc: "Accent-stripe feature cards" },
      { type: "stepGrid",      label: "Steps",          desc: "Numbered how-it-works cards" },
      { type: "filterBar",     label: "Filter bar",     desc: "Search/filter for feeds" },
    ],
  },
  {
    category: "Data",
    items: [
      { type: "partners",        label: "Partners",         desc: "Logo grid from Appwrite" },
      { type: "departmentGrid",  label: "Departments",      desc: "Dept cards from Appwrite" },
      { type: "documents",       label: "Documents",        desc: "File download list" },
      { type: "productGrid",     label: "Products",         desc: "Shop product grid" },
      { type: "campusSelector",  label: "Campus selector",  desc: "Campus switcher or cards" },
      { type: "profileHeader",   label: "Profile header",   desc: "Auth-aware account header" },
    ],
  },
];
