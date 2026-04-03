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
import { resolveComponentPermissions } from "./utils";

export const HeroComponents = {
  Hero: {
    label: "Hero",
    resolvePermissions: resolveComponentPermissions,
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
            { label: "Glass card overlay", value: "glass-card" },
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
        title: { type: "text", contentEditable: true } as any,
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
      if (data.props.layout === "split" || data.props.layout === "glass-card") {
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
            type: "external",
            label: "Slides Source",
            cache: { enabled: true },
            fetchList: async () => {
              // Slides can come from multiple tables
              return TABLE_SCHEMAS.flatMap((schema) => [
                {
                  id: `${schema.id}-default`,
                  title: `All ${schema.label}`,
                  table: schema.id,
                  filters: [],
                  sort: schema.defaultSort,
                },
                ...(schema.presetFilters ?? []).map((p, i) => ({
                  id: `${schema.id}-preset-${i}`,
                  title: `${schema.label}: ${p.label}`,
                  table: schema.id,
                  filters: p.filters,
                  sort: schema.defaultSort,
                })),
              ]);
            },
            filterFields: {
              limit: { type: "number", label: "Limit" },
            },
            mapProp: (selected: any) => ({
              table: selected?.table,
              filters: selected?.filters ?? [],
              sort: selected?.sort,
              limit: selected?.limit ?? 5,
            }),
          } as any;
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
          type: "external",
          label: "Stats Source",
          cache: { enabled: true },
          fetchList: async () => {
            // Slides can come from multiple tables
            return TABLE_SCHEMAS.flatMap((schema) => [
              {
                id: `${schema.id}-default`,
                title: `All ${schema.label}`,
                table: schema.id,
                filters: [],
                sort: schema.defaultSort,
              },
              ...(schema.presetFilters ?? []).map((p, i) => ({
                id: `${schema.id}-preset-${i}`,
                title: `${schema.label}: ${p.label}`,
                table: schema.id,
                filters: p.filters,
                sort: schema.defaultSort,
              })),
            ]);
          },
          filterFields: {
            limit: { type: "number", label: "Limit" },
          },
          mapProp: (selected: any) => ({
            table: selected?.table,
            filters: selected?.filters ?? [],
            sort: selected?.sort,
            limit: selected?.limit ?? 5,
          }),
        } as any;
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
      // Guard: never fetch on drag operations
      if (trigger === "move") return { props: {} };

      const { slidesMode, slidesSource, statsMode, statsSource } = props;
      const resolvedProps: Partial<HeroPropsWithSlot> = {};

      // Only fetch slides when data-related props changed or on initial triggers
      const shouldResolveSlides =
        slidesMode === "dynamic" &&
        Boolean(slidesSource) &&
        (trigger === "insert" ||
          trigger === "load" ||
          trigger === "force" ||
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

      // Only fetch stats when data-related props changed or on initial triggers
      const shouldResolveStats =
        statsMode === "dynamic" &&
        Boolean(statsSource) &&
        (trigger === "insert" ||
          trigger === "load" ||
          trigger === "force" ||
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
          { label: "Glass card overlay", value: "glass-card" },
        ],
      },
    },
    render: ({ rightSlot: RightSlot, ...props }: HeroPropsWithSlot) => {
      // Glass-card: hero background with a glassmorphism overlay card on the right
      if ((props.layout as string) === "glass-card") {
        const hasButtons = (props.buttons?.length ?? 0) > 0;
        return (
          <div
            className="relative min-h-[520px] w-full overflow-hidden"
            style={
              props.backgroundImage
                ? {
                    backgroundImage: `url(${props.backgroundImage})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }
                : undefined
            }
          >
            {/* Dark overlay */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#001731]/80 via-[#001731]/60 to-transparent" />
            <div className="relative mx-auto flex max-w-6xl items-center gap-8 px-4 py-24">
              {/* Left: text content */}
              <div className="flex-1 text-white">
                {props.badge && (
                  <span className="mb-4 inline-block rounded-full bg-white/10 px-4 py-1 text-sm font-medium text-white/90">
                    {props.badge}
                  </span>
                )}
                <h1 className="text-4xl font-bold leading-tight md:text-5xl">
                  {props.title || "Hero Title"}
                </h1>
                {props.subtitle && (
                  <p className="mt-4 text-lg text-white/70">{props.subtitle}</p>
                )}
                {hasButtons && (
                  <div className="mt-8 flex flex-wrap gap-3">
                    {props.buttons?.map((btn, i) => (
                      <a
                        key={i}
                        href={btn.href}
                        className={`inline-flex items-center rounded-xl px-6 py-3 text-sm font-semibold transition ${
                          btn.variant === "outline"
                            ? "border border-white/40 text-white hover:bg-white/10"
                            : "bg-white text-[#001731] hover:bg-white/90"
                        }`}
                      >
                        {btn.label}
                      </a>
                    ))}
                  </div>
                )}
              </div>
              {/* Right: glass card */}
              {RightSlot ? (
                <div className="hidden w-80 shrink-0 rounded-2xl border border-white/20 bg-white/10 p-6 backdrop-blur-md lg:block">
                  <RightSlot />
                </div>
              ) : (
                <div className="hidden w-80 shrink-0 rounded-2xl border border-white/20 bg-white/10 p-8 backdrop-blur-md lg:block">
                  <p className="text-center text-sm text-white/50">
                    Use the "Split" layout to add content to this card slot.
                  </p>
                </div>
              )}
            </div>
          </div>
        );
      }

      return <Hero rightSlot={RightSlot && <RightSlot />} {...props} />;
    },
    defaultProps: {
      layout: "center",
      height: "medium",
      title: "Hero Title",
      subtitle: "This is a generic hero component that can be customized.",
      buttons: [
        { label: "Get Started", href: "/", variant: "default" },
      ] as HeroButton[],
      overlay: true,
      slides: [] as HeroSlide[],
      slidesMode: "manual",
      stats: [] as HeroStat[],
      statsMode: "manual",
      highlights: [] as HeroHighlight[],
    },
  },
  PageHeader: {
    label: "Page Header",
    resolvePermissions: resolveComponentPermissions,
    resolveFields: (data: any): any => {
      const variant = data.props.variant ?? "default";
      const base: Record<string, unknown> = {
        title: { type: "text", contentEditable: true } as any,
        subtitle: { type: "textarea", contentEditable: true },
        variant: {
          type: "select",
          options: [
            { label: "Default (Left)", value: "default" },
            { label: "Centered", value: "centered" },
            { label: "Minimal", value: "minimal" },
            { label: "With icon badge", value: "with-icon" },
            { label: "With meta row", value: "with-meta" },
            { label: "With stat strip", value: "stat-strip" },
          ],
        },
        showDivider: {
          type: "radio",
          options: [
            { label: "Yes", value: true },
            { label: "No", value: false },
          ],
        },
        breadcrumbs: {
          type: "array",
          getItemSummary: (item: { label?: string }) =>
            item.label || "Breadcrumb",
          arrayFields: {
            label: { type: "text" },
            href: { type: "text" },
          },
        },
      };

      if (variant === "with-icon") {
        base.icon = {
          type: "select",
          label: "Icon",
          options: ICON_OPTIONS,
        };
        base.iconBackground = {
          type: "select",
          label: "Icon Background",
          options: [
            { label: "Blue", value: "blue" },
            { label: "Indigo", value: "indigo" },
            { label: "Purple", value: "purple" },
            { label: "Green", value: "green" },
            { label: "Amber", value: "amber" },
          ],
        };
      }

      if (variant === "with-meta") {
        base.metaDate = { type: "text", label: "Date" };
        base.metaCampus = { type: "text", label: "Campus" };
        base.metaDept = { type: "text", label: "Department" };
        base.metaAuthor = { type: "text", label: "Author / By" };
      } else {
        base.lastUpdated = { type: "text", label: "Last Updated Date" };
      }

      if (variant === "stat-strip") {
        base.stats = {
          type: "array",
          label: "Stats",
          getItemSummary: (item: { label?: string }) => item.label || "Stat",
          arrayFields: {
            value: { type: "text", label: "Value" },
            label: { type: "text", label: "Label" },
          },
          defaultItemProps: { value: "100+", label: "Students" },
        };
      }

      return base;
    },
    render: (
      props: PageHeaderProps & {
        variant?: string;
        icon?: string;
        iconBackground?: string;
        metaDate?: string;
        metaCampus?: string;
        metaDept?: string;
        metaAuthor?: string;
        stats?: { value: string; label: string }[];
      }
    ) => {
      const variant = props.variant as string | undefined;

      if (variant === "with-icon") {
        const bgColors: Record<string, string> = {
          blue: "bg-blue-100 text-blue-700",
          indigo: "bg-indigo-100 text-indigo-700",
          purple: "bg-purple-100 text-purple-700",
          green: "bg-green-100 text-green-700",
          amber: "bg-amber-100 text-amber-700",
        };
        const iconColor =
          bgColors[props.iconBackground ?? "blue"] ?? bgColors.blue;

        return (
          <div className="border-b border-gray-100 bg-white px-4 py-12">
            <div className="mx-auto max-w-4xl">
              {props.breadcrumbs && props.breadcrumbs.length > 0 && (
                <nav className="mb-4 flex items-center gap-1.5 text-sm text-gray-400">
                  {props.breadcrumbs.map((crumb, i) => (
                    <span key={i} className="flex items-center gap-1.5">
                      {i > 0 && <span>/</span>}
                      {crumb.href ? (
                        <a href={crumb.href} className="hover:text-gray-600">
                          {crumb.label}
                        </a>
                      ) : (
                        <span className="text-gray-600">{crumb.label}</span>
                      )}
                    </span>
                  ))}
                </nav>
              )}
              <div className="flex items-start gap-5">
                {props.icon && (
                  <div
                    className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-2xl ${iconColor}`}
                  >
                    {props.icon.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <h1 className="text-4xl font-bold tracking-tight text-gray-900">
                    {props.title || "Page Title"}
                  </h1>
                  {props.subtitle && (
                    <p className="mt-3 text-lg text-gray-500">
                      {props.subtitle}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      }

      if (variant === "with-meta") {
        const metaItems = [
          props.metaDate,
          props.metaCampus,
          props.metaDept,
          props.metaAuthor ? `By ${props.metaAuthor}` : null,
        ].filter(Boolean) as string[];

        return (
          <div className="border-b border-gray-100 bg-white px-4 py-12">
            <div className="mx-auto max-w-4xl">
              {props.breadcrumbs && props.breadcrumbs.length > 0 && (
                <nav className="mb-4 flex items-center gap-1.5 text-sm text-gray-400">
                  {props.breadcrumbs.map((crumb, i) => (
                    <span key={i} className="flex items-center gap-1.5">
                      {i > 0 && <span>/</span>}
                      {crumb.href ? (
                        <a href={crumb.href} className="hover:text-gray-600">
                          {crumb.label}
                        </a>
                      ) : (
                        <span className="text-gray-600">{crumb.label}</span>
                      )}
                    </span>
                  ))}
                </nav>
              )}
              <h1 className="text-4xl font-bold tracking-tight text-gray-900">
                {props.title || "Page Title"}
              </h1>
              {props.subtitle && (
                <p className="mt-3 text-lg text-gray-500">{props.subtitle}</p>
              )}
              {metaItems.length > 0 && (
                <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-gray-400">
                  {metaItems.map((item, i) => (
                    <span key={i} className="flex items-center gap-2">
                      {i > 0 && <span className="text-gray-300">·</span>}
                      {item}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      }

      if (variant === "stat-strip") {
        const stats = props.stats ?? [];
        return (
          <div className="bg-gradient-to-br from-[#001731] to-[#003366] px-4 py-16 text-white">
            <div className="mx-auto max-w-5xl">
              {props.breadcrumbs && props.breadcrumbs.length > 0 && (
                <nav className="mb-4 flex items-center gap-1.5 text-sm text-white/50">
                  {props.breadcrumbs.map((crumb, i) => (
                    <span key={i} className="flex items-center gap-1.5">
                      {i > 0 && <span>/</span>}
                      {crumb.href ? (
                        <a href={crumb.href} className="hover:text-white/80">
                          {crumb.label}
                        </a>
                      ) : (
                        <span className="text-white/70">{crumb.label}</span>
                      )}
                    </span>
                  ))}
                </nav>
              )}
              <h1 className="text-4xl font-bold md:text-5xl">
                {props.title || "Page Title"}
              </h1>
              {props.subtitle && (
                <p className="mt-3 text-lg text-white/70">{props.subtitle}</p>
              )}
              {stats.length > 0 && (
                <div className="mt-10 flex flex-wrap gap-8">
                  {stats.map((stat, i) => (
                    <div key={i}>
                      <p className="text-3xl font-bold">{stat.value}</p>
                      <p className="mt-0.5 text-sm text-white/60">
                        {stat.label}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      }

      // Default / centered / minimal → delegate to PageHeader UI component
      return <PageHeader {...(props as PageHeaderProps)} />;
    },
    defaultProps: {
      title: "Privacy Policy",
      subtitle:
        "This policy describes how we collect, use, and protect your personal information.",
      lastUpdated: "November 2024",
      breadcrumbs: [{ label: "Privacy Policy" }] as BreadcrumbItem[],
      variant: "default",
      showDivider: true,
      stats: [] as { value: string; label: string }[],
    },
  },
  Banner: {
    label: "Banner",
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
        brand:
          "M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z",
      };

      return (
        <div className={`w-full border-b ${s.border} ${s.bg} px-4 py-3`}>
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
