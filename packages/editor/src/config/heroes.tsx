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
import type { BannerProps, HeroPropsWithSlot } from "./types";

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
  Banner: {
    fields: {
      message: { type: "text", contentEditable: true } as any,
      variant: {
        type: "select",
        options: [
          { label: "Info", value: "info" },
          { label: "Warning", value: "warning" },
          { label: "Success", value: "success" },
          { label: "Brand", value: "brand" },
        ],
      },
      dismissible: {
        type: "radio",
        options: [
          { label: "Yes", value: true },
          { label: "No", value: false },
        ],
      },
      link: { type: "link" } as any,
      linkLabel: { type: "text", label: "Link Label" },
    },
    render: ({
      message,
      variant,
      dismissible,
      link,
      linkLabel,
    }: BannerProps) => {
      const styles: Record<
        string,
        { bg: string; text: string; icon: string; border: string }
      > = {
        info: {
          bg: "bg-blue-50",
          text: "text-blue-800",
          icon: "text-blue-500",
          border: "border-blue-200",
        },
        warning: {
          bg: "bg-amber-50",
          text: "text-amber-800",
          icon: "text-amber-500",
          border: "border-amber-200",
        },
        success: {
          bg: "bg-emerald-50",
          text: "text-emerald-800",
          icon: "text-emerald-500",
          border: "border-emerald-200",
        },
        brand: {
          bg: "bg-gradient-to-r from-blue-600 to-indigo-600",
          text: "text-white",
          icon: "text-white/80",
          border: "border-transparent",
        },
      };

      const s = styles[variant || "info"] || styles.info;

      const iconPaths: Record<string, string> = {
        info: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
        warning:
          "M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z",
        success: "M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
        brand: "M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z",
      };

      return (
        <div
          className={`w-full border-b ${s.border} ${s.bg} px-4 py-3`}
        >
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <svg
                className={`h-5 w-5 shrink-0 ${s.icon}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d={iconPaths[variant || "info"] || iconPaths.info}
                />
              </svg>
              <span className={`text-sm font-medium ${s.text}`}>
                {message || "Banner message"}
              </span>
              {link && (
                <a
                  href={link}
                  className={`text-sm font-semibold underline underline-offset-2 ${s.text} hover:opacity-80`}
                >
                  {linkLabel || "Learn more"}
                </a>
              )}
            </div>
            {dismissible && (
              <button
                type="button"
                className={`shrink-0 rounded-md p-1 hover:opacity-70 ${s.text}`}
                aria-label="Dismiss"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>
        </div>
      );
    },
    defaultProps: {
      message: "Registration for the spring semester is now open!",
      variant: "brand",
      dismissible: true,
      link: "/register",
      linkLabel: "Register now",
    },
  },
} as const;
