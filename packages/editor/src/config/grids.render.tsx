import { FeatureGrid, type FeatureGridProps } from "@repo/ui/components/puck/feature-grid";
import { LogoGrid, type LogoGridProps } from "@repo/ui/components/puck/logo-grid";
import { StatsGrid, type StatsGridProps } from "@repo/ui/components/puck/stats-grid";
import { TeamGrid, type TeamGridProps } from "@repo/ui/components/puck/team-grid";
import type { GridProps } from "./types";

export function FeatureGridRender(props: FeatureGridProps & { variant?: string; items?: any[] }) {
  const variant = props.variant as string | undefined;
  const items: any[] = (props as any).items ?? [];

  if (variant === "benefit-scroll") {
    return (
      <section className="w-full py-10 px-4">
        {props.title && (
          <h2 className="mb-2 text-2xl font-bold text-gray-900">{props.title}</h2>
        )}
        {props.subtitle && (
          <p className="mb-6 text-gray-500">{props.subtitle}</p>
        )}
        <div className="flex gap-5 overflow-x-auto pb-4 -mx-4 px-4 snap-x snap-mandatory">
          {items.map((item: any, i: number) => (
            <div
              key={i}
              className="min-w-[280px] max-w-[320px] shrink-0 snap-start rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"
            >
              {item.icon && (
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 text-lg font-bold">
                  {item.icon.charAt(0)}
                </div>
              )}
              <h3 className="font-semibold text-gray-900">{item.title}</h3>
              {item.description && (
                <p className="mt-1 text-sm text-gray-500">{item.description}</p>
              )}
              {item.bullets && item.bullets.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {item.bullets.map((b: { text: string }, bi: number) => (
                    <li key={bi} className="flex items-start gap-2 text-sm text-gray-600">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />
                      {b.text}
                    </li>
                  ))}
                </ul>
              )}
              {item.href && (
                <a href={item.href} className="mt-4 inline-block text-sm font-medium text-blue-600 hover:text-blue-800">
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
      <section className="w-full py-8 px-4">
        {props.title && (
          <h2 className="mb-4 text-lg font-semibold text-gray-900">{props.title}</h2>
        )}
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
          {items.map((item: any, i: number) => (
            <a
              key={i}
              href={item.href || "#"}
              className="group flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 shadow-sm"
            >
              {item.icon && (
                <span className="text-gray-400 group-hover:text-blue-500 transition text-base">
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

export function GridRender({ preset, columns, items = [], title, subtitle }: GridProps) {
  if (!items.length) {
    return (
      <div className="w-full py-6 text-center text-sm text-gray-400">
        {title && <p className="text-xl font-bold text-gray-900">{title}</p>}
        {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
      </div>
    );
  }

  const cols = columns ?? 3;

  if (preset === "featured") {
    return (
      <div className="w-full space-y-4 py-6">
        {(title || subtitle) && (
          <div className="space-y-1 text-center">
            {title && <div className="text-xl font-bold">{title}</div>}
            {subtitle && <div className="text-sm text-gray-500">{subtitle}</div>}
          </div>
        )}
        <div className="grid grid-cols-3 gap-3">
          {items[0] && (
            <div className="col-span-2 overflow-hidden rounded-xl border bg-white">
              {items[0].image && <img src={items[0].image} alt={items[0].title ?? ""} className="h-48 w-full object-cover" />}
              <div className="p-3">
                {items[0].title && <div className="text-sm font-semibold">{items[0].title}</div>}
                {items[0].description && <div className="text-xs text-gray-500 line-clamp-2">{items[0].description}</div>}
              </div>
            </div>
          )}
          <div className="grid grid-rows-2 gap-3">
            {items.slice(1, 3).map((item, i) => (
              <div key={i} className="overflow-hidden rounded-xl border bg-white">
                {item.image && <img src={item.image} alt={item.title ?? ""} className="h-28 w-full object-cover" />}
                <div className="p-2">
                  {item.title && <div className="text-xs font-semibold">{item.title}</div>}
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
          {title && <div className="text-xl font-bold">{title}</div>}
          {subtitle && <div className="text-sm text-gray-500">{subtitle}</div>}
        </div>
      )}
      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {items.map((item, i) => (
          <div key={i} className="overflow-hidden rounded-xl border bg-white">
            {item.image && <img src={item.image} alt={item.title ?? ""} className="h-32 w-full object-cover" />}
            <div className="p-3">
              {item.title && <div className="text-sm font-semibold">{item.title}</div>}
              {item.description && <div className="text-xs text-gray-500 line-clamp-2">{item.description}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
