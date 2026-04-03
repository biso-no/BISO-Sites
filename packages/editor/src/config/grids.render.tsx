import {
  FeatureGrid,
  type FeatureGridProps,
} from "@repo/ui/components/puck/feature-grid";
import {
  LogoGrid,
  type LogoGridProps,
} from "@repo/ui/components/puck/logo-grid";
import {
  StatsGrid,
  type StatsGridProps,
} from "@repo/ui/components/puck/stats-grid";
import {
  TeamGrid,
  type TeamGridProps,
} from "@repo/ui/components/puck/team-grid";
import type { GridProps } from "./types";

export function FeatureGridRender(
  props: FeatureGridProps & { variant?: string; items?: any[] }
) {
  const variant = props.variant as string | undefined;
  const items: any[] = (props as any).items ?? [];

  if (variant === "benefit-scroll") {
    return (
      <section className="w-full px-4 py-10">
        {props.title && (
          <h2 className="mb-2 font-bold text-2xl text-gray-900">
            {props.title}
          </h2>
        )}
        {props.subtitle && (
          <p className="mb-6 text-gray-500">{props.subtitle}</p>
        )}
        <div className="-mx-4 flex snap-x snap-mandatory gap-5 overflow-x-auto px-4 pb-4">
          {items.map((item: any, i: number) => (
            <div
              className="min-w-[280px] max-w-[320px] shrink-0 snap-start rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"
              key={i}
            >
              {item.icon && (
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 font-bold text-blue-600 text-lg">
                  {item.icon.charAt(0)}
                </div>
              )}
              <h3 className="font-semibold text-gray-900">{item.title}</h3>
              {item.description && (
                <p className="mt-1 text-gray-500 text-sm">{item.description}</p>
              )}
              {item.bullets && item.bullets.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {item.bullets.map((b: { text: string }, bi: number) => (
                    <li
                      className="flex items-start gap-2 text-gray-600 text-sm"
                      key={bi}
                    >
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />
                      {b.text}
                    </li>
                  ))}
                </ul>
              )}
              {item.href && (
                <a
                  className="mt-4 inline-block font-medium text-blue-600 text-sm hover:text-blue-800"
                  href={item.href}
                >
                  Learn more →
                </a>
              )}
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (variant === "link-tiles") {
    return (
      <section className="w-full px-4 py-8">
        {props.title && (
          <h2 className="mb-4 font-semibold text-gray-900 text-lg">
            {props.title}
          </h2>
        )}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {items.map((item: any, i: number) => (
            <a
              className="group flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 font-medium text-gray-700 text-sm shadow-sm transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
              href={item.href || "#"}
              key={i}
            >
              {item.icon && (
                <span className="text-base text-gray-400 transition group-hover:text-blue-500">
                  {item.icon.charAt(0)}
                </span>
              )}
              <span className="truncate">{item.title}</span>
            </a>
          ))}
        </div>
      </section>
    );
  }

  return <FeatureGrid {...props} />;
}

export function StatsGridRender(props: StatsGridProps) {
  return <StatsGrid {...props} />;
}

export function TeamGridRender(props: TeamGridProps) {
  return <TeamGrid {...props} />;
}

export function LogoGridRender(props: LogoGridProps) {
  return <LogoGrid {...props} />;
}

export function GridRender({
  preset,
  columns,
  items = [],
  title,
  subtitle,
}: GridProps) {
  if (!items.length) {
    return (
      <div className="w-full py-6 text-center text-gray-400 text-sm">
        {title && <p className="font-bold text-gray-900 text-xl">{title}</p>}
        {subtitle && <p className="mt-1 text-gray-500 text-sm">{subtitle}</p>}
      </div>
    );
  }

  const cols = columns ?? 3;

  if (preset === "featured") {
    return (
      <div className="w-full space-y-4 py-6">
        {(title || subtitle) && (
          <div className="space-y-1 text-center">
            {title && <div className="font-bold text-xl">{title}</div>}
            {subtitle && (
              <div className="text-gray-500 text-sm">{subtitle}</div>
            )}
          </div>
        )}
        <div className="grid grid-cols-3 gap-3">
          {items[0] && (
            <div className="col-span-2 overflow-hidden rounded-xl border bg-white">
              {items[0].image && (
                <img
                  alt={items[0].title ?? ""}
                  className="h-48 w-full object-cover"
                  src={items[0].image}
                />
              )}
              <div className="p-3">
                {items[0].title && (
                  <div className="font-semibold text-sm">{items[0].title}</div>
                )}
                {items[0].description && (
                  <div className="line-clamp-2 text-gray-500 text-xs">
                    {items[0].description}
                  </div>
                )}
              </div>
            </div>
          )}
          <div className="grid grid-rows-2 gap-3">
            {items.slice(1, 3).map((item, i) => (
              <div
                className="overflow-hidden rounded-xl border bg-white"
                key={i}
              >
                {item.image && (
                  <img
                    alt={item.title ?? ""}
                    className="h-28 w-full object-cover"
                    src={item.image}
                  />
                )}
                <div className="p-2">
                  {item.title && (
                    <div className="font-semibold text-xs">{item.title}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4 py-6">
      {(title || subtitle) && (
        <div className="space-y-1 text-center">
          {title && <div className="font-bold text-xl">{title}</div>}
          {subtitle && <div className="text-gray-500 text-sm">{subtitle}</div>}
        </div>
      )}
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
      >
        {items.map((item, i) => (
          <div className="overflow-hidden rounded-xl border bg-white" key={i}>
            {item.image && (
              <img
                alt={item.title ?? ""}
                className="h-32 w-full object-cover"
                src={item.image}
              />
            )}
            <div className="p-3">
              {item.title && (
                <div className="font-semibold text-sm">{item.title}</div>
              )}
              {item.description && (
                <div className="line-clamp-2 text-gray-500 text-xs">
                  {item.description}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
