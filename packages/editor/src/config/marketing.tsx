"use client";
import {
  CTA,
  type CTAButton,
  type CTAProps,
} from "@repo/ui/components/puck/cta";
import {
  About,
  type AboutProps,
  type AboutStat,
  type AboutValue,
} from "@repo/ui/components/sections/about";
import {
  JoinUs,
  type JoinUsBenefit,
  type JoinUsDuration,
} from "@repo/ui/components/sections/join-us";
import { ALIGN_OPTIONS, GRADIENT_OPTIONS, ICON_OPTIONS } from "../puck-tokens";
import type {
  CountdownProps,
  EditorJoinUsProps,
  PricingTableProps,
} from "./types";

export const MarketingComponents = {
  CTA: {
    label: "Call to Action",
    resolveFields: (data: any): any => {
      const base: Record<string, unknown> = {
        title: { type: "text", contentEditable: true } as any,
        description: { type: "textarea", contentEditable: true },
        variant: {
          type: "select",
          options: [
            { label: "Default", value: "default" },
            { label: "Card", value: "card" },
            { label: "Brand", value: "brand" },
            { label: "Dark", value: "dark" },
            { label: "Info card (tinted)", value: "info-card" },
            { label: "Campus-conditional", value: "campus-conditional" },
          ],
        },
        align: {
          type: "radio",
          options: ALIGN_OPTIONS,
        },
        buttons: {
          type: "array",
          arrayFields: {
            label: { type: "text" },
            href: { type: "link" } as any,
            variant: {
              type: "select",
              options: [
                { label: "Default", value: "default" },
                { label: "Outline", value: "outline" },
                { label: "Ghost", value: "ghost" },
                { label: "White", value: "white" },
              ],
            },
          },
          defaultItemProps: {
            label: "Button",
            href: "#",
            variant: "default",
          },
        },
      };

      if (data.props.variant === "info-card") {
        base.tint = {
          type: "select",
          label: "Tint Color",
          options: [
            { label: "Blue", value: "blue" },
            { label: "Indigo", value: "indigo" },
            { label: "Amber", value: "amber" },
            { label: "Green", value: "green" },
            { label: "Red", value: "red" },
          ],
        };
        base.icon = {
          type: "select",
          label: "Icon",
          options: ICON_OPTIONS,
        };
      }

      if (data.props.variant === "campus-conditional") {
        base.showForCampus = {
          type: "select",
          label: "Only show for campus",
          options: [
            { label: "All campuses", value: "all" },
            { label: "Oslo", value: "1" },
            { label: "Bergen", value: "2" },
            { label: "Trondheim", value: "3" },
            { label: "Stavanger", value: "4" },
            { label: "National", value: "5" },
          ],
        };
        base.campusBadge = { type: "text", label: "Campus Badge Label" };
      }

      return base;
    },
    render: (
      props: CTAProps & {
        variant?: string;
        tint?: string;
        icon?: string;
        showForCampus?: string;
        campusBadge?: string;
      }
    ) => {
      const variant = props.variant as string | undefined;

      if (variant === "info-card") {
        const tintStyles: Record<
          string,
          { wrapper: string; title: string; desc: string; btn: string }
        > = {
          blue: {
            wrapper: "bg-blue-50 border-blue-200",
            title: "text-blue-900",
            desc: "text-blue-700",
            btn: "bg-blue-600 text-white hover:bg-blue-700",
          },
          indigo: {
            wrapper: "bg-indigo-50 border-indigo-200",
            title: "text-indigo-900",
            desc: "text-indigo-700",
            btn: "bg-indigo-600 text-white hover:bg-indigo-700",
          },
          amber: {
            wrapper: "bg-amber-50 border-amber-200",
            title: "text-amber-900",
            desc: "text-amber-700",
            btn: "bg-amber-600 text-white hover:bg-amber-700",
          },
          green: {
            wrapper: "bg-emerald-50 border-emerald-200",
            title: "text-emerald-900",
            desc: "text-emerald-700",
            btn: "bg-emerald-600 text-white hover:bg-emerald-700",
          },
          red: {
            wrapper: "bg-red-50 border-red-200",
            title: "text-red-900",
            desc: "text-red-700",
            btn: "bg-red-600 text-white hover:bg-red-700",
          },
        };
        const s = tintStyles[props.tint ?? "blue"] ?? tintStyles.blue;
        return (
          <div className={`w-full rounded-2xl border p-8 ${s.wrapper}`}>
            <h3 className={`font-bold text-xl ${s.title}`}>
              {props.title || "Title"}
            </h3>
            {props.description && (
              <p className={`mt-2 text-sm ${s.desc}`}>{props.description}</p>
            )}
            {(props.buttons ?? []).length > 0 && (
              <div className="mt-5 flex flex-wrap gap-3">
                {(props.buttons ?? []).map((btn, i) => (
                  <a
                    className={`inline-flex rounded-lg px-4 py-2 font-semibold text-sm transition ${s.btn}`}
                    href={btn.href}
                    key={i}
                  >
                    {btn.label}
                  </a>
                ))}
              </div>
            )}
          </div>
        );
      }

      if (variant === "campus-conditional") {
        return (
          <div className="relative w-full">
            {props.campusBadge && (
              <div className="absolute -top-3 left-6 rounded-full bg-blue-600 px-3 py-0.5 font-semibold text-white text-xs">
                {props.campusBadge}
              </div>
            )}
            <CTA {...(props as CTAProps)} />
          </div>
        );
      }

      return <CTA {...(props as CTAProps)} />;
    },
    defaultProps: {
      title: "Ready to join?",
      description: "Get started today.",
      variant: "brand",
      buttons: [
        { label: "Join Now", href: "/join", variant: "white" },
      ] as CTAButton[],
    },
  },
  About: {
    label: "About",
    resolveFields: (data: any, { metadata }: any): any => {
      const isGlobalAdmin = Boolean(
        (metadata as { user?: { isGlobalAdmin?: boolean } })?.user
          ?.isGlobalAdmin
      );

      const currentGradients = Array.isArray((data.props as any).values)
        ? ((data.props as any).values as any[])
            .map((v) => (typeof v?.gradient === "string" ? v.gradient : null))
            .filter(Boolean)
        : [];

      const extraGradientOptions = currentGradients
        .filter(
          (value: string) =>
            !GRADIENT_OPTIONS.some((opt) => opt.value === value)
        )
        .map((value: string) => ({
          label: `Custom: ${value}`,
          value,
        }));

      const gradientOptions = [...GRADIENT_OPTIONS, ...extraGradientOptions];

      return {
        stats: {
          type: "array",
          arrayFields: {
            number: { type: "text" },
            label: { type: "text" },
            iconName: {
              type: "select",
              options: [
                { label: "Calendar", value: "Calendar" },
                { label: "Briefcase", value: "Briefcase" },
                { label: "Rocket", value: "Rocket" },
                { label: "Trophy", value: "Trophy" },
              ],
            },
          },
        },
        values: {
          type: "array",
          arrayFields: {
            title: { type: "text" },
            description: { type: "textarea" },
            iconName: {
              type: "select",
              options: [
                { label: "Megaphone", value: "Megaphone" },
                { label: "Link", value: "Link" },
                { label: "Sparkles", value: "Sparkles" },
              ],
            },
            gradient: isGlobalAdmin
              ? { type: "text", label: "Gradient (classes)" }
              : { type: "select", options: gradientOptions },
          },
        },
        mainContent: {
          type: "object",
          objectFields: {
            tag: { type: "text" },
            titleLine1: { type: "text", contentEditable: true } as any,
            titleLine2: { type: "text", contentEditable: true } as any,
            paragraph1: { type: "textarea", contentEditable: true },
            paragraph2: { type: "textarea", contentEditable: true },
          },
        },
        videoUrl: { type: "text" },
      };
    },
    render: (props: AboutProps) => <About {...props} />,
    defaultProps: {
      stats: [
        { number: "100+", label: "Events", iconName: "Calendar" },
        { number: "50+", label: "Jobs", iconName: "Briefcase" },
        { number: "20+", label: "Societies", iconName: "Rocket" },
      ] as AboutStat[],
      values: [
        {
          title: "Impact",
          description: "We make an impact.",
          iconName: "Megaphone",
          gradient: "from-[#3DA9E0] to-[#001731]",
        },
      ] as AboutValue[],
      mainContent: {
        tag: "About",
        titleLine1: "Premier Student",
        titleLine2: "Community",
        paragraph1: "We are the student union...",
        paragraph2: "Join us today.",
      },
    },
  },
  JoinUs: {
    label: "Join Us",
    resolveFields: (data: any, { metadata }: any): any => {
      const isGlobalAdmin = Boolean(
        (metadata as { user?: { isGlobalAdmin?: boolean } })?.user
          ?.isGlobalAdmin
      );

      const currentGradients = Array.isArray((data.props as any).durations)
        ? ((data.props as any).durations as any[])
            .map((v) => (typeof v?.gradient === "string" ? v.gradient : null))
            .filter(Boolean)
        : [];

      const extraGradientOptions = currentGradients
        .filter(
          (value: string) =>
            !GRADIENT_OPTIONS.some((opt) => opt.value === value)
        )
        .map((value: string) => ({
          label: `Custom: ${value}`,
          value,
        }));

      const gradientOptions = [...GRADIENT_OPTIONS, ...extraGradientOptions];

      return {
        tag: { type: "text" },
        titleLine1: { type: "text" },
        titleLine2: { type: "text" },
        subtitle: { type: "textarea" },
        heroBadge: { type: "text" },
        heroSubtitle: { type: "textarea" },
        memberFeaturesHeader: { type: "text" },
        memberFeatures: {
          type: "array",
          arrayFields: {
            feature: { type: "text" },
          },
        },
        benefits: {
          type: "array",
          arrayFields: {
            text: { type: "text" },
            iconName: {
              type: "select",
              options: [
                { label: "Sparkles", value: "Sparkles" },
                { label: "Gift", value: "Gift" },
                { label: "Crown", value: "Crown" },
                { label: "Zap", value: "Zap" },
                { label: "Check", value: "Check" },
              ],
            },
          },
        },
        durations: {
          type: "array",
          arrayFields: {
            name: { type: "text" },
            price: { type: "text" },
            period: { type: "text" },
            savings: { type: "text" },
            popular: {
              type: "radio",
              options: [
                { label: "Yes", value: true },
                { label: "No", value: false },
              ],
            },
            gradient: isGlobalAdmin
              ? { type: "text", label: "Gradient (classes)" }
              : { type: "select", options: gradientOptions },
          },
        },
        cta: {
          type: "object",
          objectFields: {
            title: { type: "text" },
            subtitle: { type: "textarea" },
            buttonText: { type: "text" },
          },
        },
      };
    },
    render: (props: EditorJoinUsProps) => {
      const componentProps = {
        ...props,
        memberFeatures:
          props.memberFeatures?.map((f: { feature: string }) => f.feature) ||
          [],
      };
      return <JoinUs {...componentProps} />;
    },
    defaultProps: {
      tag: "Membership",
      titleLine1: "Join the",
      titleLine2: "Community",
      subtitle: "Unlock exclusive benefits.",
      heroBadge: "Why Join?",
      heroSubtitle: "Being a member pays off.",
      memberFeaturesHeader: "All memberships include:",
      memberFeatures: [
        { feature: "Event Access" },
        { feature: "Discounts" },
      ] as { feature: string }[],
      benefits: [
        { text: "Social Events", iconName: "Sparkles" },
      ] as JoinUsBenefit[],
      durations: [
        {
          name: "1 Year",
          price: "200 NOK",
          period: "/year",
          popular: true,
          gradient: "from-purple-600 to-pink-600",
        },
      ] as JoinUsDuration[],
      cta: {
        title: "Not sure?",
        subtitle: "Contact us.",
        buttonText: "Contact",
      },
    },
  },
  PricingTable: {
    label: "Pricing Table",
    fields: {
      title: { type: "text", contentEditable: true } as any,
      subtitle: { type: "textarea", contentEditable: true },
      variant: {
        type: "select",
        options: [
          { label: "Cards", value: "cards" },
          { label: "Table", value: "table" },
        ],
      },
      plans: {
        type: "array",
        getItemSummary: (item: { name?: string }) => item.name || "Plan",
        arrayFields: {
          name: { type: "text" },
          price: { type: "text" },
          currency: { type: "text" },
          period: { type: "text" },
          highlighted: {
            type: "radio",
            options: [
              { label: "Yes", value: true },
              { label: "No", value: false },
            ],
          },
          features: {
            type: "array",
            arrayFields: {
              value: { type: "text", label: "Feature" },
            },
          },
          ctaLabel: { type: "text", label: "Button Label" },
          ctaHref: { type: "link", label: "Button Link" } as any,
        },
        defaultItemProps: {
          name: "Plan",
          price: "99",
          currency: "NOK",
          period: "/month",
          highlighted: false,
          features: [] as { value: string }[],
          ctaLabel: "Get Started",
          ctaHref: "#",
        },
      },
    },
    render: ({ plans, variant, title, subtitle }: PricingTableProps) => {
      const items = plans || [];
      return (
        <div className="w-full px-4 py-12">
          {(title || subtitle) && (
            <div className="mb-10 text-center">
              {title && (
                <h2 className="mb-2 font-bold text-3xl text-gray-900">
                  {title}
                </h2>
              )}
              {subtitle && <p className="text-gray-500 text-lg">{subtitle}</p>}
            </div>
          )}
          {variant === "table" ? (
            <div className="mx-auto max-w-4xl overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-gray-200 border-b">
                    <th className="px-6 py-4 text-left font-semibold text-gray-700">
                      Plan
                    </th>
                    <th className="px-6 py-4 text-left font-semibold text-gray-700">
                      Price
                    </th>
                    <th className="px-6 py-4 text-left font-semibold text-gray-700">
                      Features
                    </th>
                    <th className="px-6 py-4 text-right font-semibold text-gray-700" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((plan, i) => (
                    <tr
                      className={`border-gray-100 border-b ${plan.highlighted ? "bg-blue-50" : ""}`}
                      key={i}
                    >
                      <td className="px-6 py-4 font-medium text-gray-900">
                        {plan.name}
                      </td>
                      <td className="px-6 py-4 text-gray-700">
                        {plan.currency || ""}
                        {plan.price}
                        <span className="text-gray-400 text-xs">
                          {plan.period}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {(plan.features || []).map((f) => f.value).join(", ")}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <a
                          className={`inline-block rounded-md px-4 py-2 font-medium text-sm ${
                            plan.highlighted
                              ? "bg-blue-600 text-white"
                              : "bg-gray-100 text-gray-700"
                          }`}
                          href={plan.ctaHref || "#"}
                        >
                          {plan.ctaLabel || "Choose"}
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div
              className={`mx-auto grid max-w-6xl gap-6 ${
                items.length === 1
                  ? "max-w-md grid-cols-1"
                  : items.length === 2
                    ? "max-w-3xl grid-cols-1 md:grid-cols-2"
                    : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
              }`}
            >
              {items.map((plan, i) => (
                <div
                  className={`relative flex flex-col rounded-2xl border p-8 ${
                    plan.highlighted
                      ? "scale-[1.02] border-blue-500 shadow-xl ring-2 ring-blue-500"
                      : "border-gray-200 shadow-sm"
                  }`}
                  key={i}
                >
                  {plan.highlighted && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 px-4 py-1 font-semibold text-white text-xs">
                      Most Popular
                    </span>
                  )}
                  <h3 className="mb-2 font-semibold text-gray-900 text-lg">
                    {plan.name}
                  </h3>
                  <div className="mb-6">
                    <span className="text-gray-500 text-sm">
                      {plan.currency || ""}
                    </span>
                    <span className="font-bold text-4xl text-gray-900">
                      {plan.price}
                    </span>
                    <span className="text-gray-500 text-sm">
                      {plan.period || ""}
                    </span>
                  </div>
                  <ul className="mb-8 flex-1 space-y-3">
                    {(plan.features || []).map((feature, fi) => (
                      <li
                        className="flex items-center gap-2 text-gray-600 text-sm"
                        key={fi}
                      >
                        <svg
                          className="h-4 w-4 shrink-0 text-blue-500"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          viewBox="0 0 24 24"
                        >
                          <path
                            d="M5 13l4 4L19 7"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        {feature.value}
                      </li>
                    ))}
                  </ul>
                  <a
                    className={`block w-full rounded-lg py-3 text-center font-semibold text-sm transition ${
                      plan.highlighted
                        ? "bg-blue-600 text-white hover:bg-blue-700"
                        : "bg-gray-900 text-white hover:bg-gray-800"
                    }`}
                    href={plan.ctaHref || "#"}
                  >
                    {plan.ctaLabel || "Get Started"}
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    },
    defaultProps: {
      title: "Choose Your Plan",
      subtitle: "Find the perfect membership for you.",
      variant: "cards",
      plans: [
        {
          name: "Basic",
          price: "0",
          currency: "NOK",
          period: "/month",
          highlighted: false,
          features: [{ value: "Event access" }, { value: "Newsletter" }],
          ctaLabel: "Get Started",
          ctaHref: "#",
        },
        {
          name: "Pro",
          price: "99",
          currency: "NOK",
          period: "/month",
          highlighted: true,
          features: [
            { value: "Everything in Basic" },
            { value: "Priority seating" },
            { value: "Exclusive workshops" },
            { value: "Merch discount" },
          ],
          ctaLabel: "Join Pro",
          ctaHref: "#",
        },
        {
          name: "Premium",
          price: "199",
          currency: "NOK",
          period: "/month",
          highlighted: false,
          features: [
            { value: "Everything in Pro" },
            { value: "1-on-1 mentoring" },
            { value: "VIP events" },
          ],
          ctaLabel: "Go Premium",
          ctaHref: "#",
        },
      ] as PricingTableProps["plans"],
    },
  },
  Countdown: {
    label: "Countdown",
    fields: {
      title: { type: "text", contentEditable: true } as any,
      subtitle: { type: "textarea", contentEditable: true },
      targetDate: { type: "text", label: "Target Date (YYYY-MM-DD HH:MM)" },
      completedMessage: { type: "text", label: "Completed Message" },
      variant: {
        type: "select",
        options: [
          { label: "Default", value: "default" },
          { label: "Card", value: "card" },
          { label: "Minimal", value: "minimal" },
        ],
      },
    },
    render: ({
      title,
      subtitle,
      targetDate,
      completedMessage,
      variant,
    }: CountdownProps) => {
      // Static preview: compute time difference for display in the editor
      const target = targetDate ? new Date(targetDate) : new Date();
      const now = new Date();
      const diff = Math.max(0, target.getTime() - now.getTime());
      const isComplete = diff === 0;

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((diff / (1000 * 60)) % 60);
      const seconds = Math.floor((diff / 1000) % 60);

      const units = [
        { label: "Days", value: days },
        { label: "Hours", value: hours },
        { label: "Minutes", value: minutes },
        { label: "Seconds", value: seconds },
      ];

      const wrapperClass =
        variant === "card"
          ? "w-full py-12 px-4 bg-white"
          : variant === "minimal"
            ? "w-full py-8 px-4"
            : "w-full py-16 px-4 bg-gradient-to-br from-gray-900 to-gray-800 text-white";

      const boxClass =
        variant === "card"
          ? "bg-gray-50 border border-gray-200 rounded-2xl p-6 min-w-[90px]"
          : variant === "minimal"
            ? "p-4 min-w-[70px]"
            : "bg-white/10 backdrop-blur-sm rounded-2xl p-6 min-w-[90px]";

      const numberClass =
        variant === "minimal"
          ? "text-3xl font-bold text-gray-900"
          : variant === "card"
            ? "text-4xl font-bold text-gray-900"
            : "text-4xl font-bold text-white";

      const labelClass =
        variant === "minimal" || variant === "card"
          ? "text-xs uppercase tracking-wider text-gray-500 mt-1"
          : "text-xs uppercase tracking-wider text-white/70 mt-1";

      return (
        <div className={wrapperClass}>
          <div
            className={`mx-auto max-w-3xl text-center ${variant === "card" ? "rounded-2xl border border-gray-200 p-10 shadow-lg" : ""}`}
          >
            {title && (
              <h2
                className={`mb-2 font-bold text-3xl ${variant === "default" ? "text-white" : "text-gray-900"}`}
              >
                {title}
              </h2>
            )}
            {subtitle && (
              <p
                className={`mb-8 text-lg ${variant === "default" ? "text-white/70" : "text-gray-500"}`}
              >
                {subtitle}
              </p>
            )}
            {isComplete ? (
              <p
                className={`font-semibold text-xl ${variant === "default" ? "text-white" : "text-gray-900"}`}
              >
                {completedMessage || "The event has started!"}
              </p>
            ) : (
              <div className="flex items-center justify-center gap-4">
                {units.map((unit, i) => (
                  <div className="flex items-center gap-4" key={i}>
                    <div className={`${boxClass} text-center`}>
                      <div className={numberClass}>
                        {String(unit.value).padStart(2, "0")}
                      </div>
                      <div className={labelClass}>{unit.label}</div>
                    </div>
                    {i < units.length - 1 && (
                      <span
                        className={`font-bold text-3xl ${variant === "default" ? "text-white/40" : "text-gray-300"}`}
                      >
                        :
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
            {!targetDate && (
              <p
                className={`mt-6 text-sm italic ${variant === "default" ? "text-white/50" : "text-gray-400"}`}
              >
                Set a target date to see the countdown
              </p>
            )}
          </div>
        </div>
      );
    },
    defaultProps: {
      title: "Event Starts In",
      subtitle: "Don't miss out — mark your calendar!",
      targetDate: "2026-06-01 18:00",
      completedMessage: "The event has started!",
      variant: "default",
    },
  },
} as const;
