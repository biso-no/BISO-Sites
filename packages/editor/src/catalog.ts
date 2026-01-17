/**
 * JSON-Render Catalog for Puck Components
 *
 * This catalog defines all available Puck components with their Zod schemas,
 * enabling AI to generate structured JSON that matches the component props.
 *
 * The catalog is used by json-render to:
 * 1. Guardrail AI generation to only use valid components
 * 2. Generate optimized system prompts via generateCatalogPrompt()
 * 3. Validate streaming patches before applying them
 */

import { createCatalog } from "@json-render/core";
import { z } from "zod";

// Shared schemas for reusable structures
const iconOptions = z
  .enum([
    "Sparkles",
    "Gift",
    "Crown",
    "Zap",
    "Check",
    "Calendar",
    "Briefcase",
    "Rocket",
    "Trophy",
    "Megaphone",
    "Link",
    "Users",
    "Globe",
    "BookOpen",
    "Building",
    "Heart",
    "MapPin",
    "CheckCircle",
    "ArrowRight",
  ])
  .optional();

const buttonSchema = z.object({
  label: z.string(),
  href: z.string().optional(),
  variant: z
    .enum(["default", "outline", "ghost", "link", "glass", "gradient", "white"])
    .default("default"),
});

/**
 * The main Puck component catalog
 */
export const puckCatalog = createCatalog({
  components: {
    // ============================================
    // Layout Components
    // ============================================

    Section: {
      props: z.object({
        id: z.string().describe("Unique component ID"),
        backgroundColor: z
          .enum(["white", "gray", "primary", "primary-strong", "dark"])
          .default("white"),
        padding: z.enum(["none", "sm", "md", "lg", "xl"]).default("md"),
        maxWidth: z.enum(["default", "full", "narrow"]).default("default"),
      }),
      hasChildren: true,
      description:
        "A container section with configurable background, padding, and max-width. Use to wrap other components.",
    },

    Columns: {
      props: z.object({
        id: z.string().describe("Unique component ID"),
        layout: z
          .enum(["1:1", "2:1", "1:2", "1:1:1"])
          .default("1:1")
          .describe("Column ratio layout"),
        gap: z.enum(["sm", "md", "lg"]).default("md"),
        verticalAlign: z.enum(["top", "center", "bottom"]).default("top"),
      }),
      hasChildren: true,
      description:
        "Multi-column layout. Creates 2 or 3 columns with configurable ratios.",
    },

    Tabs: {
      props: z.object({
        id: z.string().describe("Unique component ID"),
        tabs: z.array(
          z.object({
            label: z.string(),
            value: z.string(),
          })
        ),
      }),
      hasChildren: true,
      description:
        "Tabbed content container. Each tab can hold different content.",
    },

    Spacer: {
      props: z.object({
        id: z.string().describe("Unique component ID"),
        size: z
          .enum(["xs", "sm", "md", "lg", "xl", "2xl"])
          .default("md")
          .describe(
            "Spacing size: xs=16px, sm=32px, md=64px, lg=96px, xl=128px, 2xl=192px"
          ),
      }),
      description: "Vertical spacing between components.",
    },

    // ============================================
    // Hero & Header Components
    // ============================================

    Hero: {
      props: z.object({
        id: z.string().describe("Unique component ID"),
        layout: z
          .enum(["center", "left", "split", "carousel"])
          .default("center"),
        height: z.enum(["full", "large", "medium", "small"]).default("medium"),
        title: z.string().describe("Main hero heading"),
        subtitle: z.string().optional().describe("Supporting text below title"),
        badge: z.string().optional().describe("Small badge/tag above title"),
        backgroundImage: z.string().optional().describe("Background image URL"),
        image: z
          .string()
          .optional()
          .describe("Featured image for split layout"),
        overlay: z
          .boolean()
          .default(true)
          .describe("Dark overlay on background"),
        buttons: z.array(buttonSchema).optional(),
        stats: z
          .array(
            z.object({
              value: z.string(),
              label: z.string(),
            })
          )
          .optional(),
        statsVariant: z.enum(["pills", "simple"]).optional(),
        highlights: z
          .array(
            z.object({
              text: z.string(),
              icon: iconOptions,
            })
          )
          .optional(),
      }),
      description:
        "Full-width hero section. The main landing section of a page with title, description, and call-to-action buttons.",
    },

    PageHeader: {
      props: z.object({
        id: z.string().describe("Unique component ID"),
        title: z.string(),
        subtitle: z.string().optional(),
        lastUpdated: z.string().optional(),
        breadcrumbs: z
          .array(
            z.object({
              label: z.string(),
              href: z.string().optional(),
            })
          )
          .optional(),
        variant: z.enum(["default", "centered", "minimal"]).default("default"),
        showDivider: z.boolean().default(true),
      }),
      description:
        "Page header with title, subtitle, breadcrumbs, and optional last-updated date. Use for internal pages.",
    },

    // ============================================
    // Content Display Components
    // ============================================

    FeatureGrid: {
      props: z.object({
        id: z.string().describe("Unique component ID"),
        title: z.string().optional(),
        subtitle: z.string().optional(),
        columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(3),
        variant: z
          .enum(["card", "icon", "simple", "checklist", "project", "process"])
          .default("card"),
        align: z.enum(["center", "left"]).default("center"),
        items: z.array(
          z.object({
            title: z.string(),
            description: z.string(),
            icon: iconOptions,
            badge: z.string().optional(),
            href: z.string().optional(),
          })
        ),
      }),
      description:
        "Grid of feature cards with icons. Great for showcasing benefits, services, or key points.",
    },

    StatsGrid: {
      props: z.object({
        id: z.string().describe("Unique component ID"),
        columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(4),
        variant: z.enum(["simple", "card", "floating"]).default("simple"),
        align: z.enum(["center", "left"]).default("center"),
        items: z.array(
          z.object({
            value: z.string().describe("The stat number/value"),
            label: z.string().describe("Label below the value"),
            description: z.string().optional(),
            icon: iconOptions,
          })
        ),
      }),
      description:
        "Display key statistics/metrics. Shows numbers with labels in a grid.",
    },

    TeamGrid: {
      props: z.object({
        id: z.string().describe("Unique component ID"),
        columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(3),
        variant: z.enum(["card", "minimal"]).default("card"),
        members: z.array(
          z.object({
            name: z.string(),
            role: z.string(),
            image: z.string().optional(),
            bio: z.string().optional(),
            email: z.string().optional(),
            linkedin: z.string().optional(),
          })
        ),
      }),
      description:
        "Team member showcase grid. Displays photos, names, roles, and optional contact info.",
    },

    Timeline: {
      props: z.object({
        id: z.string().describe("Unique component ID"),
        title: z.string().optional(),
        subtitle: z.string().optional(),
        align: z.enum(["center", "left"]).default("center"),
        mode: z.enum(["alternating", "left", "right"]).default("alternating"),
        items: z.array(
          z.object({
            date: z.string(),
            title: z.string(),
            description: z.string().optional(),
            image: z.string().optional(),
            icon: iconOptions,
          })
        ),
      }),
      description:
        "Chronological timeline display. Great for history, milestones, or process steps.",
    },

    LogoGrid: {
      props: z.object({
        id: z.string().describe("Unique component ID"),
        columns: z
          .union([z.literal(3), z.literal(4), z.literal(5), z.literal(6)])
          .default(4),
        variant: z.enum(["bordered", "card", "simple"]).default("bordered"),
        grayscale: z.boolean().default(true),
        items: z.array(
          z.object({
            image: z.string(),
            alt: z.string(),
            href: z.string().optional(),
          })
        ),
      }),
      description:
        "Partner/sponsor logo grid. Displays company logos with optional links.",
    },

    Accordion: {
      props: z.object({
        id: z.string().describe("Unique component ID"),
        type: z
          .enum(["single", "multiple"])
          .default("single")
          .describe("single = one open at a time, multiple = many can be open"),
        items: z.array(
          z.object({
            title: z.string(),
            content: z.string(),
          })
        ),
      }),
      description:
        "Collapsible FAQ/accordion. Great for FAQs or organizing content into expandable sections.",
    },

    RichText: {
      props: z.object({
        id: z.string().describe("Unique component ID"),
        content: z.string().describe("Markdown content"),
        variant: z.enum(["default", "compact", "legal"]).default("default"),
        columns: z.union([z.literal(1), z.literal(2)]).default(1),
      }),
      description:
        "Markdown/rich text block. Supports headings, lists, links, bold, italic formatting.",
    },

    TableOfContents: {
      props: z.object({
        id: z.string().describe("Unique component ID"),
        title: z.string().optional(),
        items: z.array(
          z.object({
            title: z.string(),
            anchor: z.string().describe("Anchor ID without #"),
            level: z
              .union([z.literal(1), z.literal(2), z.literal(3)])
              .default(1),
          })
        ),
        variant: z.enum(["default", "card", "sticky"]).default("card"),
        showIcon: z.boolean().default(true),
      }),
      description:
        "Navigation table of contents. Links to page sections via anchor IDs.",
    },

    // ============================================
    // CTA & Marketing Components
    // ============================================

    CTA: {
      props: z.object({
        id: z.string().describe("Unique component ID"),
        title: z.string(),
        description: z.string().optional(),
        variant: z.enum(["default", "card", "brand", "dark"]).default("brand"),
        align: z.enum(["center", "left"]).default("center"),
        buttons: z.array(buttonSchema),
      }),
      description:
        "Call-to-action section. Prompts users to take action with headline and buttons.",
    },

    About: {
      props: z.object({
        id: z.string().describe("Unique component ID"),
        stats: z
          .array(
            z.object({
              number: z.string(),
              label: z.string(),
              iconName: z
                .enum(["Calendar", "Briefcase", "Rocket", "Trophy"])
                .optional(),
            })
          )
          .optional(),
        values: z
          .array(
            z.object({
              title: z.string(),
              description: z.string(),
              iconName: z.enum(["Megaphone", "Link", "Sparkles"]).optional(),
              gradient: z.string().optional(),
            })
          )
          .optional(),
        mainContent: z.object({
          tag: z.string().optional(),
          titleLine1: z.string(),
          titleLine2: z.string().optional(),
          paragraph1: z.string(),
          paragraph2: z.string().optional(),
        }),
        videoUrl: z.string().optional(),
      }),
      description:
        "About section with statistics, values, and main content. Rich intro section for organizations.",
    },

    JoinUs: {
      props: z.object({
        id: z.string().describe("Unique component ID"),
        tag: z.string().optional(),
        titleLine1: z.string(),
        titleLine2: z.string().optional(),
        subtitle: z.string().optional(),
        heroBadge: z.string().optional(),
        heroSubtitle: z.string().optional(),
        memberFeaturesHeader: z.string().optional(),
        memberFeatures: z.array(z.string()).optional(),
        benefits: z
          .array(
            z.object({
              text: z.string(),
              iconName: z
                .enum(["Sparkles", "Gift", "Crown", "Zap", "Check"])
                .optional(),
            })
          )
          .optional(),
        durations: z
          .array(
            z.object({
              name: z.string(),
              price: z.string(),
              period: z.string().optional(),
              savings: z.string().optional(),
              popular: z.boolean().optional(),
              gradient: z.string().optional(),
            })
          )
          .optional(),
        cta: z
          .object({
            title: z.string(),
            subtitle: z.string().optional(),
            buttonText: z.string(),
          })
          .optional(),
      }),
      description:
        "Membership signup section with pricing tiers, benefits, and call-to-action.",
    },

    // ============================================
    // Data/List Components
    // ============================================

    News: {
      props: z.object({
        id: z.string().describe("Unique component ID"),
        news: z
          .array(
            z.object({
              title: z.string(),
              description: z.string().optional(),
              image: z.string().optional(),
              $id: z.string().optional(),
              content_id: z.string().optional(),
              $createdAt: z.string().optional(),
            })
          )
          .optional(),
        labels: z
          .object({
            empty: z.string().optional(),
            emptyDescription: z.string().optional(),
            cta: z.string().optional(),
            stayUpdated: z.string().optional(),
            titleDefault: z.string().optional(),
            readMore: z.string().optional(),
            viewAllNews: z.string().optional(),
          })
          .optional(),
      }),
      description:
        "News article grid. Displays news items with images and excerpts.",
    },

    Events: {
      props: z.object({
        id: z.string().describe("Unique component ID"),
        events: z
          .array(
            z.object({
              title: z.string(),
              image: z.string().optional(),
              start_date: z.string().optional(),
              end_date: z.string().optional(),
              location: z.string().optional(),
              category: z.enum(["Social", "Career", "Academic"]).optional(),
              attendees: z.number().optional(),
              $id: z.string().optional(),
              content_id: z.string().optional(),
            })
          )
          .optional(),
        labels: z
          .object({
            empty: z.string().optional(),
            emptyDescription: z.string().optional(),
            upcomingEvents: z.string().optional(),
            dontMissOut: z.string().optional(),
            amazingExperiences: z.string().optional(),
            description: z.string().optional(),
            registerNow: z.string().optional(),
            viewAllEvents: z.string().optional(),
          })
          .optional(),
      }),
      description:
        "Events listing grid. Shows upcoming events with dates and locations.",
    },

    JobsList: {
      props: z.object({
        id: z.string().describe("Unique component ID"),
        jobs: z.array(
          z.object({
            title: z.string(),
            department: z.string().optional(),
            location: z.string().optional(),
            type: z.string().optional(),
            paid: z.boolean().optional(),
            category: z.string().optional(),
            description: z.string().optional(),
            slug: z.string().optional(),
            deadline: z.string().optional(),
          })
        ),
        labels: z
          .object({
            viewDetails: z.string().optional(),
            paid: z.string().optional(),
            volunteer: z.string().optional(),
            deadline: z.string().optional(),
            noJobs: z.string().optional(),
          })
          .optional(),
      }),
      description:
        "Job/position listings. Displays open positions with details.",
    },

    FilterBar: {
      props: z.object({
        id: z.string().describe("Unique component ID"),
        title: z.string().optional(),
        showSearch: z.boolean().default(true),
        categories: z.array(
          z.object({
            label: z.string(),
            value: z.string(),
          })
        ),
      }),
      description:
        "Filter/search bar for lists. Provides search input and category filters.",
    },

    Collection: {
      props: z.object({
        id: z.string().describe("Unique component ID"),
        title: z.string().optional(),
        subtitle: z.string().optional(),
        layout: z
          .enum([
            "card-grid",
            "list",
            "masonry",
            "carousel",
            "logo-grid",
            "feature-grid",
          ])
          .default("card-grid"),
        columns: z
          .union([
            z.literal(2),
            z.literal(3),
            z.literal(4),
            z.literal(5),
            z.literal(6),
          ])
          .default(3),
        items: z
          .array(
            z.object({
              title: z.string(),
              subtitle: z.string().optional(),
              description: z.string().optional(),
              image: z.string().optional(),
              icon: z.string().optional(),
              href: z.string().optional(),
              date: z.string().optional(),
              badge: z.string().optional(),
            })
          )
          .optional(),
        emptyMessage: z.string().optional(),
        ctaLabel: z.string().optional(),
        ctaHref: z.string().optional(),
        grayscale: z.boolean().optional(),
        cardVariant: z.enum(["default", "bordered", "elevated"]).optional(),
        imageAspect: z.enum(["video", "square", "portrait"]).optional(),
      }),
      description:
        "Flexible collection display. Generic component for displaying lists of items in various layouts.",
    },
  },
});

export type PuckCatalog = typeof puckCatalog;
