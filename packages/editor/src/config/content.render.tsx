import {
  AccordionBlock,
  type AccordionBlockProps,
} from "@repo/ui/components/puck/accordion";
import {
  RichText,
  type RichTextProps,
} from "@repo/ui/components/puck/rich-text";
import {
  TableOfContents,
  type TableOfContentsProps,
} from "@repo/ui/components/puck/table-of-contents";
import {
  Timeline,
  type TimelineProps,
} from "@repo/ui/components/puck/timeline";
import type { TestimonialsProps } from "./types";

export function AccordionRender(props: AccordionBlockProps) {
  return <AccordionBlock {...props} />;
}

export function TimelineRender(props: TimelineProps) {
  return <Timeline {...props} />;
}

export function RichTextRender(props: RichTextProps) {
  return <RichText {...props} />;
}

export function TableOfContentsRender(props: TableOfContentsProps) {
  return <TableOfContents {...props} />;
}

export function TestimonialsRender({
  items,
  variant,
  columns,
  title,
}: TestimonialsProps) {
  const testimonials = items || [];
  const cols = columns || 3;

  const renderCard = (
    item: { quote: string; author: string; role?: string; avatar?: string },
    index: number
  ) => (
    <div
      className="relative rounded-2xl border border-gray-200 bg-white p-8 shadow-sm"
      key={index}
    >
      <svg
        className="absolute top-6 left-6 h-8 w-8 text-gray-200"
        fill="currentColor"
        viewBox="0 0 24 24"
      >
        <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10H14.017zM0 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151C7.546 6.068 5.983 8.789 5.983 11H10v10H0z" />
      </svg>
      <blockquote className="relative z-10 mt-6 text-gray-700 leading-relaxed">
        &ldquo;{item.quote}&rdquo;
      </blockquote>
      <div className="mt-6 flex items-center gap-3 border-gray-100 border-t pt-4">
        {item.avatar ? (
          <img
            alt={item.author}
            className="h-10 w-10 rounded-full object-cover"
            src={item.avatar}
          />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 font-bold text-gray-500 text-sm">
            {item.author?.charAt(0)?.toUpperCase() || "?"}
          </div>
        )}
        <div>
          <p className="font-semibold text-gray-900 text-sm">{item.author}</p>
          {item.role && <p className="text-gray-500 text-xs">{item.role}</p>}
        </div>
      </div>
    </div>
  );

  return (
    <div className="w-full px-4 py-12">
      {title && (
        <h2 className="mb-10 text-center font-bold text-3xl text-gray-900">
          {title}
        </h2>
      )}
      {variant === "single" ? (
        <div className="mx-auto max-w-2xl">
          {testimonials[0] && renderCard(testimonials[0], 0)}
        </div>
      ) : variant === "carousel" ? (
        <div className="mx-auto max-w-6xl">
          <div className="flex snap-x snap-mandatory gap-6 overflow-x-auto pb-4">
            {testimonials.map((item, i) => (
              <div
                className="min-w-[320px] max-w-[400px] flex-shrink-0 snap-center"
                key={i}
              >
                {renderCard(item, i)}
              </div>
            ))}
          </div>
          {testimonials.length > 1 && (
            <p className="mt-4 text-center text-gray-400 text-xs">
              Scroll to see more
            </p>
          )}
        </div>
      ) : (
        <div
          className={`mx-auto grid max-w-6xl gap-6 ${
            cols === 2
              ? "grid-cols-1 md:grid-cols-2"
              : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
          }`}
        >
          {testimonials.map((item, i) => renderCard(item, i))}
        </div>
      )}
    </div>
  );
}
