import { Hero } from "@repo/ui/components/puck/hero";
import {
  PageHeader,
  type PageHeaderProps,
} from "@repo/ui/components/puck/page-header";
import type { BannerProps, HeroPropsWithSlot } from "./types";

export function HeroRender({
  rightSlot: RightSlot,
  ...props
}: HeroPropsWithSlot) {
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
        <div className="absolute inset-0 bg-gradient-to-r from-[#001731]/80 via-[#001731]/60 to-transparent" />
        <div className="relative mx-auto flex max-w-6xl items-center gap-8 px-4 py-24">
          <div className="flex-1 text-white">
            {props.badge && (
              <span className="mb-4 inline-block rounded-full bg-white/10 px-4 py-1 font-medium text-sm text-white/90">
                {props.badge}
              </span>
            )}
            <h1 className="font-bold text-4xl leading-tight md:text-5xl">
              {props.title || "Hero Title"}
            </h1>
            {props.subtitle && (
              <p className="mt-4 text-lg text-white/70">{props.subtitle}</p>
            )}
            {hasButtons && (
              <div className="mt-8 flex flex-wrap gap-3">
                {props.buttons?.map((btn, i) => (
                  <a
                    className={`inline-flex items-center rounded-xl px-6 py-3 font-semibold text-sm transition ${
                      btn.variant === "outline"
                        ? "border border-white/40 text-white hover:bg-white/10"
                        : "bg-white text-[#001731] hover:bg-white/90"
                    }`}
                    href={btn.href}
                    key={i}
                  >
                    {btn.label}
                  </a>
                ))}
              </div>
            )}
          </div>
          {RightSlot ? (
            <div className="hidden w-80 shrink-0 rounded-2xl border border-white/20 bg-white/10 p-6 backdrop-blur-md lg:block">
              <RightSlot />
            </div>
          ) : (
            <div className="hidden w-80 shrink-0 rounded-2xl border border-white/20 bg-white/10 p-8 backdrop-blur-md lg:block">
              <p className="text-center text-sm text-white/50">
                Use the &quot;Split&quot; layout to add content to this card
                slot.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return <Hero rightSlot={RightSlot && <RightSlot />} {...props} />;
}

export function PageHeaderRender(
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
) {
  const variant = props.variant as string | undefined;

  if (variant === "with-icon") {
    const bgColors: Record<string, string> = {
      blue: "bg-blue-100 text-blue-700",
      indigo: "bg-indigo-100 text-indigo-700",
      purple: "bg-purple-100 text-purple-700",
      green: "bg-green-100 text-green-700",
      amber: "bg-amber-100 text-amber-700",
    };
    const iconColor = bgColors[props.iconBackground ?? "blue"] ?? bgColors.blue;

    return (
      <div className="border-gray-100 border-b bg-white px-4 py-12">
        <div className="mx-auto max-w-4xl">
          {props.breadcrumbs && props.breadcrumbs.length > 0 && (
            <nav className="mb-4 flex items-center gap-1.5 text-gray-400 text-sm">
              {props.breadcrumbs.map((crumb, i) => (
                <span className="flex items-center gap-1.5" key={i}>
                  {i > 0 && <span>/</span>}
                  {crumb.href ? (
                    <a className="hover:text-gray-600" href={crumb.href}>
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
              <h1 className="font-bold text-4xl text-gray-900 tracking-tight">
                {props.title || "Page Title"}
              </h1>
              {props.subtitle && (
                <p className="mt-3 text-gray-500 text-lg">{props.subtitle}</p>
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
      <div className="border-gray-100 border-b bg-white px-4 py-12">
        <div className="mx-auto max-w-4xl">
          {props.breadcrumbs && props.breadcrumbs.length > 0 && (
            <nav className="mb-4 flex items-center gap-1.5 text-gray-400 text-sm">
              {props.breadcrumbs.map((crumb, i) => (
                <span className="flex items-center gap-1.5" key={i}>
                  {i > 0 && <span>/</span>}
                  {crumb.href ? (
                    <a className="hover:text-gray-600" href={crumb.href}>
                      {crumb.label}
                    </a>
                  ) : (
                    <span className="text-gray-600">{crumb.label}</span>
                  )}
                </span>
              ))}
            </nav>
          )}
          <h1 className="font-bold text-4xl text-gray-900 tracking-tight">
            {props.title || "Page Title"}
          </h1>
          {props.subtitle && (
            <p className="mt-3 text-gray-500 text-lg">{props.subtitle}</p>
          )}
          {metaItems.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2 text-gray-400 text-sm">
              {metaItems.map((item, i) => (
                <span className="flex items-center gap-2" key={i}>
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
                <span className="flex items-center gap-1.5" key={i}>
                  {i > 0 && <span>/</span>}
                  {crumb.href ? (
                    <a className="hover:text-white/80" href={crumb.href}>
                      {crumb.label}
                    </a>
                  ) : (
                    <span className="text-white/70">{crumb.label}</span>
                  )}
                </span>
              ))}
            </nav>
          )}
          <h1 className="font-bold text-4xl md:text-5xl">
            {props.title || "Page Title"}
          </h1>
          {props.subtitle && (
            <p className="mt-3 text-lg text-white/70">{props.subtitle}</p>
          )}
          {stats.length > 0 && (
            <div className="mt-10 flex flex-wrap gap-8">
              {stats.map((stat, i) => (
                <div key={i}>
                  <p className="font-bold text-3xl">{stat.value}</p>
                  <p className="mt-0.5 text-sm text-white/60">{stat.label}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return <PageHeader {...(props as PageHeaderProps)} />;
}

export function BannerRender({
  message,
  variant,
  dismissible,
  link,
  linkLabel,
}: BannerProps) {
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
            stroke="currentColor"
            strokeWidth={1.5}
            viewBox="0 0 24 24"
          >
            <path
              d={iconPaths[variant || "info"] || iconPaths.info}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className={`font-medium text-sm ${s.text}`}>
            {message || "Banner message"}
          </span>
          {link && (
            <a
              className={`font-semibold text-sm underline underline-offset-2 ${s.text} hover:opacity-80`}
              href={link}
            >
              {linkLabel || "Learn more"}
            </a>
          )}
        </div>
        {dismissible && (
          <button
            aria-label="Dismiss"
            className={`shrink-0 rounded-md p-1 hover:opacity-70 ${s.text}`}
            type="button"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                d="M6 18L18 6M6 6l12 12"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
