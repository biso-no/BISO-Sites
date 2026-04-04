"use client";
import {
  AccordionBlock,
  type AccordionBlockProps,
  type AccordionItemProps,
} from "@repo/ui/components/puck/accordion";
import {
  RichText,
  type RichTextProps,
} from "@repo/ui/components/puck/rich-text";
import {
  TableOfContents,
  type TableOfContentsProps,
  type TocItem,
} from "@repo/ui/components/puck/table-of-contents";
import {
  Timeline,
  type TimelineItem,
  type TimelineProps,
} from "@repo/ui/components/puck/timeline";
import { TABLE_SCHEMAS } from "../data/schemas";
import { getDynamicContent } from "../get-dynamic-content";
import { ALIGN_OPTIONS, ICON_OPTIONS } from "../puck-tokens";
import type { TestimonialsProps, TimelinePropsWithSlot } from "./types";

export const ContentComponents = {
  Accordion: {
    label: "Accordion",
    fields: {
      type: {
        type: "radio",
        options: [
          { label: "Single Open", value: "single" },
          { label: "Allow Multiple", value: "multiple" },
        ],
      },
      items: {
        type: "array",
        getItemSummary: (item: { title?: string }) => item.title || "Item",
        arrayFields: {
          title: { type: "text", contentEditable: true } as any,
          content: { type: "textarea", contentEditable: true },
        },
      },
    },
    render: (props: AccordionBlockProps) => <AccordionBlock {...props} />,
    defaultProps: {
      type: "single",
      items: [
        { title: "Question 1", content: "Answer to question 1." },
        { title: "Question 2", content: "Answer to question 2." },
      ] as AccordionItemProps[],
    },
  },
  Timeline: {
    label: "Timeline",
    resolveFields: (data: any) => {
      const fields: any = {
        title: { type: "text", contentEditable: true } as any,
        subtitle: { type: "textarea", contentEditable: true },
        align: {
          type: "radio",
          options: ALIGN_OPTIONS,
        },
        mode: {
          type: "select",
          options: [
            { label: "Alternating", value: "alternating" },
            { label: "Left Aligned", value: "left" },
            { label: "Right Aligned", value: "right" },
          ],
        },
        dataMode: {
          type: "radio",
          label: "Data Source",
          options: [
            { label: "Manual", value: "manual" },
            { label: "Dynamic", value: "dynamic" },
          ],
        },
      };

      if (data.props.dataMode === "dynamic") {
        fields.dataSource = {
          type: "external",
          label: "Milestones Source",
          cache: { enabled: true },
          fetchList: async () => {
            const schema = TABLE_SCHEMAS.find((s) => s.id === "milestones");
            if (!schema) {
              return [];
            }
            return [
              {
                id: "default",
                title: "All Milestones",
                table: schema.id,
                filters: [],
                sort: schema.defaultSort,
              },
              ...(schema.presetFilters ?? []).map((p, i) => ({
                id: `preset-${i}`,
                title: p.label,
                table: schema.id,
                filters: p.filters,
                sort: schema.defaultSort,
              })),
            ];
          },
          filterFields: {
            limit: { type: "number", label: "Limit" },
          },
          mapProp: (selected: any) => ({
            table: selected?.table,
            filters: selected?.filters ?? [],
            sort: selected?.sort,
            limit: selected?.limit ?? 50,
          }),
        } as any;
      } else {
        fields.items = {
          type: "array",
          getItemSummary: (item: any) => item.title || "Timeline Item",
          arrayFields: {
            date: { type: "text" },
            title: { type: "text" },
            description: { type: "textarea" },
            image: { type: "image" },
            icon: {
              type: "select",
              options: ICON_OPTIONS,
            },
          },
          defaultItemProps: {
            date: "2024",
            title: "New Milestone",
            description: "Description",
            icon: "Sparkles",
          },
        };
      }

      return fields;
    },
    resolveData: async (
      { props }: { props: TimelinePropsWithSlot },
      { changed, trigger, metadata }: any
    ) => {
      // Guard: never fetch on drag operations
      if (trigger === "move") {
        return { props: {} };
      }

      const { dataMode, dataSource } = props;
      const resolvedProps: Partial<TimelinePropsWithSlot> = {};

      // Only fetch when data-related props changed or on initial triggers
      const shouldResolve =
        trigger === "insert" ||
        trigger === "load" ||
        trigger === "force" ||
        Boolean(changed.dataMode || changed.dataSource);

      if (!shouldResolve) {
        return { props: {} };
      }

      if (dataMode === "dynamic" && dataSource) {
        try {
          const locale =
            (metadata as { locale?: string })?.locale ?? dataSource.locale;
          const items = await getDynamicContent({
            ...dataSource,
            table: "milestones",
            locale,
          });
          resolvedProps.items = items.map((item) => ({
            date: item.date || "",
            title: item.title,
            description: item.description || "",
            image: item.image,
            icon: item.icon,
          }));
        } catch (e) {
          console.error("Failed to resolve timeline items", e);
        }
      }

      return { props: resolvedProps };
    },
    render: (props: TimelineProps) => <Timeline {...props} />,
    defaultProps: {
      title: "Our History",
      subtitle: "A timeline of our journey and milestones.",
      align: "center",
      mode: "alternating",
      dataMode: "manual",
      items: [
        {
          date: "2024",
          title: "Milestone 1",
          description: "Description of the milestone.",
          icon: "Rocket",
        },
        {
          date: "2023",
          title: "Milestone 2",
          description: "Description of the milestone.",
          icon: "Trophy",
        },
      ] as TimelineItem[],
    },
  },
  RichText: {
    label: "Rich Text",
    fields: {
      content: {
        type: "richtext",
        label: "Content",
        contentEditable: true,
      },
      variant: {
        type: "select",
        options: [
          { label: "Default", value: "default" },
          { label: "Compact", value: "compact" },
          { label: "Legal Document", value: "legal" },
        ],
      },
      columns: {
        type: "radio",
        options: [
          { label: "Single Column", value: 1 },
          { label: "Two Columns", value: 2 },
        ],
      },
    },
    render: (props: RichTextProps) => <RichText {...props} />,
    defaultProps: {
      content:
        "## Section Title\n\nThis is a paragraph of text. You can use **bold** and *italic* formatting.\n\n### Subsection\n\n- List item 1\n- List item 2\n- List item 3\n\nLearn more at [our website](https://example.com).",
      variant: "default",
      columns: 1,
    },
  },
  TableOfContents: {
    label: "Table of Contents",
    fields: {
      title: { type: "text", contentEditable: true } as any,
      items: {
        type: "array",
        getItemSummary: (item: { title?: string }) => item.title || "Section",
        arrayFields: {
          title: { type: "text" },
          anchor: { type: "text", label: "Anchor ID (without #)" },
          level: {
            type: "select",
            options: [
              { label: "Level 1 (Main)", value: 1 },
              { label: "Level 2 (Sub)", value: 2 },
              { label: "Level 3 (Nested)", value: 3 },
            ],
          },
        },
      },
      variant: {
        type: "select",
        options: [
          { label: "Default", value: "default" },
          { label: "Card", value: "card" },
          { label: "Sticky Sidebar", value: "sticky" },
        ],
      },
      showIcon: {
        type: "radio",
        options: [
          { label: "Yes", value: true },
          { label: "No", value: false },
        ],
      },
    },
    render: (props: TableOfContentsProps) => <TableOfContents {...props} />,
    defaultProps: {
      title: "Table of Contents",
      items: [
        { title: "Introduction", anchor: "introduction", level: 1 },
        { title: "Data Collection", anchor: "data-collection", level: 1 },
        { title: "Personal Information", anchor: "personal-info", level: 2 },
        { title: "Your Rights", anchor: "your-rights", level: 1 },
        { title: "Contact Us", anchor: "contact", level: 1 },
      ] as TocItem[],
      variant: "card",
      showIcon: true,
    },
  },
  Testimonials: {
    label: "Testimonials",
    fields: {
      title: { type: "text", contentEditable: true } as any,
      variant: {
        type: "select",
        options: [
          { label: "Grid", value: "grid" },
          { label: "Carousel", value: "carousel" },
          { label: "Single", value: "single" },
        ],
      },
      columns: {
        type: "select",
        options: [
          { label: "2", value: 2 },
          { label: "3", value: 3 },
        ],
      },
      items: {
        type: "array",
        getItemSummary: (item: { author?: string }) =>
          item.author || "Testimonial",
        arrayFields: {
          quote: { type: "textarea" },
          author: { type: "text" },
          role: { type: "text" },
          avatar: { type: "image" } as any,
        },
        defaultItemProps: {
          quote: "This is a great organization!",
          author: "Jane Doe",
          role: "Member",
          avatar: "",
        },
      },
    },
    render: ({ items, variant, columns, title }: TestimonialsProps) => {
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
          {/* Decorative quote mark */}
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
              <p className="font-semibold text-gray-900 text-sm">
                {item.author}
              </p>
              {item.role && (
                <p className="text-gray-500 text-xs">{item.role}</p>
              )}
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
                    className="min-w-[320px] max-w-[400px] shrink-0 snap-center"
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
    },
    defaultProps: {
      title: "What Our Members Say",
      variant: "grid",
      columns: 3,
      items: [
        {
          quote:
            "Being part of this community completely changed my university experience. I've made lifelong friends and learned so much.",
          author: "Sarah K.",
          role: "3rd Year Student",
          avatar: "",
        },
        {
          quote:
            "The events and workshops are incredibly well-organized. There's always something exciting going on.",
          author: "Marcus L.",
          role: "Board Member",
          avatar: "",
        },
        {
          quote:
            "I love the networking opportunities. It really helped me land my first internship.",
          author: "Priya N.",
          role: "Alumni",
          avatar: "",
        },
      ] as TestimonialsProps["items"],
    },
  },
} as const;
