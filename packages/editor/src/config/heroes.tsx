"use client";
import {
  Hero,
  type HeroButton,
  type HeroHighlight,
  type HeroProps,
  type HeroSlide,
  type HeroStat,
} from "@repo/ui/components/puck/hero";
import {
  PageHeader,
  type BreadcrumbItem,
  type PageHeaderProps,
} from "@repo/ui/components/puck/page-header";
import { ICON_OPTIONS } from "../puck-tokens";
import { TABLE_SCHEMAS } from "../data/schemas";
import { getDynamicContent } from "../get-dynamic-content";
import type { HeroPropsWithSlot } from "./types";

export const HeroComponents = {
  Hero: {
    resolveFields: (data: any, { metadata }: any) => {
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
    resolveData: async (
      { props }: { props: HeroPropsWithSlot },
      { changed, trigger, metadata }: any
    ) => {
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
    render: ({ rightSlot: RightSlot, ...props }: HeroPropsWithSlot) => (
      <Hero rightSlot={RightSlot && <RightSlot />} {...props} />
    ),
    defaultProps: {
      layout: "center",
      height: "medium",
      title: "Hero Title",
      subtitle: "This is a generic hero component that can be customized.",
      buttons: [{ label: "Get Started", href: "/", variant: "default" }] as HeroButton[],
      overlay: true,
      slides: [] as HeroSlide[],
      slidesMode: "manual",
      stats: [] as HeroStat[],
      statsMode: "manual",
      highlights: [] as HeroHighlight[],
    },
  },
  PageHeader: {
    fields: {
      title: { type: "text" },
      subtitle: { type: "textarea" },
      lastUpdated: { type: "text", label: "Last Updated Date" },
      breadcrumbs: {
        type: "array",
        getItemSummary: (item: { label?: string }) => item.label || "Breadcrumb",
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
      breadcrumbs: [{ label: "Privacy Policy" }] as BreadcrumbItem[],
      variant: "default",
      showDivider: true,
    },
  },
} as const;
