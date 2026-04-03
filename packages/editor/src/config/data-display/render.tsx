import { Collection } from "@repo/ui/components/puck/collection/collection";
import {
  FilterBar,
  type FilterBarProps,
} from "@repo/ui/components/puck/filter-bar";
import { FilteredEvents } from "@repo/ui/components/puck/filtered-events";
import { FilteredNews } from "@repo/ui/components/puck/filtered-news";
import {
  JobsList,
  type JobsListProps,
} from "@repo/ui/components/puck/jobs-list";
import {
  ProductsGrid,
  type ProductsGridProps,
} from "@repo/ui/components/puck/products-grid";
import type {
  ArticleDetailProps,
  DepartmentsGridProps,
  EditorCollectionProps,
  EditorEventsProps,
  EditorJobsListProps,
  EditorNewsProps,
  EditorProductsGridProps,
  EventDetailProps,
  EventsCalendarProps,
} from "../types";

export function NewsRender(props: EditorNewsProps) {
  return <FilteredNews {...props} />;
}

export function EventsRender(props: EditorEventsProps) {
  return <FilteredEvents {...props} />;
}

export function JobsListRender(props: EditorJobsListProps) {
  return <JobsList {...(props as JobsListProps)} />;
}

export function ProductsGridRender(props: EditorProductsGridProps) {
  return <ProductsGrid {...(props as ProductsGridProps)} />;
}

export function FilterBarRender(props: FilterBarProps) {
  return <FilterBar {...props} />;
}

export function CollectionRender(props: EditorCollectionProps) {
  return <Collection {...props} />;
}

export function DepartmentsGridRender(props: DepartmentsGridProps) {
  const layout = props.variant === "compact" ? "compact-card" : "card-grid";
  return (
    <Collection
      columns={props.columns ?? 3}
      emptyDescription="Check back later."
      emptyMessage="No departments found"
      items={props.items ?? []}
      layout={layout}
      showFilters={props.showFilters}
      subtitle={props.subtitle}
      title={props.title}
    />
  );
}

export function EventsCalendarRender(props: EventsCalendarProps) {
  return (
    <FilteredEvents
      {...({
        events: props.events ?? [],
        labels: {
          empty: "No events",
          emptyDescription: "Check back later",
          upcomingEvents: props.title ?? "Events Calendar",
          dontMissOut: "",
          amazingExperiences: "",
          description: "",
          registerNow: "Register Now",
          viewAllEvents: "View All Events",
        },
      } as any)}
    />
  );
}

export function ArticleDetailRender(props: ArticleDetailProps) {
  const isWide = props.layout === "wide";
  return (
    <article className={`mx-auto py-8 ${isWide ? "max-w-5xl" : "max-w-3xl"}`}>
      {props.image && (
        <div className="mb-8 overflow-hidden rounded-xl">
          <img
            alt={props.title || ""}
            className="h-64 w-full object-cover md:h-96"
            src={props.image}
          />
        </div>
      )}
      <header className="mb-8">
        <h1 className="mb-4 font-bold text-3xl tracking-tight md:text-4xl">
          {props.title || "Article Title"}
        </h1>
        <div className="flex items-center gap-4 text-gray-500 text-sm">
          {props.author && <span>By {props.author}</span>}
          {props.date && (
            <time dateTime={props.date}>
              {new Date(props.date).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </time>
          )}
        </div>
      </header>
      <div className="prose prose-lg max-w-none">
        <p>{props.content || "Article content goes here..."}</p>
      </div>
      {props.showRelated &&
        props.relatedItems &&
        props.relatedItems.length > 0 && (
          <section className="mt-12 border-t pt-8">
            <h2 className="mb-6 font-semibold text-2xl">Related Articles</h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {props.relatedItems.map((item, i) => (
                <a
                  className="group block overflow-hidden rounded-lg border transition-shadow hover:shadow-md"
                  href={item.href}
                  key={i}
                >
                  {item.image && (
                    <img
                      alt={item.title}
                      className="h-40 w-full object-cover"
                      src={item.image}
                    />
                  )}
                  <div className="p-4">
                    <h3 className="font-medium group-hover:text-blue-600">
                      {item.title}
                    </h3>
                  </div>
                </a>
              ))}
            </div>
          </section>
        )}
    </article>
  );
}

export function EventDetailRender(props: EventDetailProps) {
  const formatDate = (d?: string) => {
    if (!d) {
      return "";
    }
    return new Date(d).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <article className="mx-auto max-w-4xl py-8">
      {props.image && (
        <div className="mb-8 overflow-hidden rounded-xl">
          <img
            alt={props.title || ""}
            className="h-64 w-full object-cover md:h-96"
            src={props.image}
          />
        </div>
      )}
      <header className="mb-8">
        <h1 className="mb-4 font-bold text-3xl tracking-tight md:text-4xl">
          {props.title || "Event Title"}
        </h1>
      </header>
      <div className="mb-8 grid gap-4 rounded-lg bg-gray-50 p-6 sm:grid-cols-2">
        <div>
          <p className="font-medium text-gray-500 text-sm">Date &amp; Time</p>
          <p className="mt-1 text-sm">{formatDate(props.date)}</p>
          {props.endDate && (
            <p className="mt-1 text-gray-600 text-sm">
              Until {formatDate(props.endDate)}
            </p>
          )}
        </div>
        {props.location && (
          <div>
            <p className="font-medium text-gray-500 text-sm">Location</p>
            <p className="mt-1 text-sm">{props.location}</p>
          </div>
        )}
        {props.price && (
          <div>
            <p className="font-medium text-gray-500 text-sm">Price</p>
            <p className="mt-1 text-sm">{props.price}</p>
          </div>
        )}
      </div>
      {props.description && (
        <div className="prose prose-lg max-w-none">
          <p>{props.description}</p>
        </div>
      )}
      {props.showRegistration && props.ticketUrl && (
        <div className="mt-8">
          <a
            className="inline-flex items-center rounded-lg bg-blue-600 px-6 py-3 font-medium text-sm text-white transition-colors hover:bg-blue-700"
            href={props.ticketUrl}
          >
            Register Now
          </a>
        </div>
      )}
      {props.showMap && props.location && (
        <div className="mt-8 overflow-hidden rounded-lg">
          <iframe
            height="300"
            loading="lazy"
            src="https://www.openstreetmap.org/export/embed.html?bbox=10.3,59.8,10.9,59.98&layer=mapnik"
            style={{ border: 0 }}
            title="Event location"
            width="100%"
          />
        </div>
      )}
    </article>
  );
}
