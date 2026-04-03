import { CTA, type CTAProps } from "@repo/ui/components/puck/cta";
import { About, type AboutProps } from "@repo/ui/components/sections/about";
import { JoinUs } from "@repo/ui/components/sections/join-us";
import type { CountdownProps, EditorJoinUsProps, PricingTableProps } from "./types";

export function CTARender(props: CTAProps & {
  variant?: string;
  tint?: string;
  icon?: string;
  showForCampus?: string;
  campusBadge?: string;
}) {
  const variant = props.variant as string | undefined;

  if (variant === "info-card") {
    const tintStyles: Record<string, { wrapper: string; title: string; desc: string; btn: string }> = {
      blue:   { wrapper: "bg-blue-50 border-blue-200",   title: "text-blue-900",   desc: "text-blue-700",   btn: "bg-blue-600 text-white hover:bg-blue-700" },
      indigo: { wrapper: "bg-indigo-50 border-indigo-200", title: "text-indigo-900", desc: "text-indigo-700", btn: "bg-indigo-600 text-white hover:bg-indigo-700" },
      amber:  { wrapper: "bg-amber-50 border-amber-200",  title: "text-amber-900",  desc: "text-amber-700",  btn: "bg-amber-600 text-white hover:bg-amber-700" },
      green:  { wrapper: "bg-emerald-50 border-emerald-200", title: "text-emerald-900", desc: "text-emerald-700", btn: "bg-emerald-600 text-white hover:bg-emerald-700" },
      red:    { wrapper: "bg-red-50 border-red-200",      title: "text-red-900",    desc: "text-red-700",    btn: "bg-red-600 text-white hover:bg-red-700" },
    };
    const s = tintStyles[props.tint ?? "blue"] ?? tintStyles.blue;
    return (
      <div className={`w-full rounded-2xl border p-8 ${s.wrapper}`}>
        <h3 className={`text-xl font-bold ${s.title}`}>{props.title || "Title"}</h3>
        {props.description && (
          <p className={`mt-2 text-sm ${s.desc}`}>{props.description}</p>
        )}
        {(props.buttons ?? []).length > 0 && (
          <div className="mt-5 flex flex-wrap gap-3">
            {(props.buttons ?? []).map((btn, i) => (
              <a key={i} href={btn.href} className={`inline-flex rounded-lg px-4 py-2 text-sm font-semibold transition ${s.btn}`}>
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
          <div className="absolute -top-3 left-6 rounded-full bg-blue-600 px-3 py-0.5 text-xs font-semibold text-white">
            {props.campusBadge}
          </div>
        )}
        <CTA {...(props as CTAProps)} />
      </div>
    );
  }

  return <CTA {...(props as CTAProps)} />;
}

export function AboutRender(props: AboutProps) {
  return <About {...props} />;
}

export function JoinUsRender(props: EditorJoinUsProps) {
  const componentProps = {
    ...props,
    memberFeatures: props.memberFeatures?.map((f: { feature: string }) => f.feature) || [],
  };
  return <JoinUs {...componentProps} />;
}

export function PricingTableRender({ plans, variant, title, subtitle }: PricingTableProps) {
  const items = plans || [];
  return (
    <div className="w-full py-12 px-4">
      {(title || subtitle) && (
        <div className="text-center mb-10">
          {title && <h2 className="text-3xl font-bold text-gray-900 mb-2">{title}</h2>}
          {subtitle && <p className="text-lg text-gray-500">{subtitle}</p>}
        </div>
      )}
      {variant === "table" ? (
        <div className="max-w-4xl mx-auto overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="py-4 px-6 text-left font-semibold text-gray-700">Plan</th>
                <th className="py-4 px-6 text-left font-semibold text-gray-700">Price</th>
                <th className="py-4 px-6 text-left font-semibold text-gray-700">Features</th>
                <th className="py-4 px-6 text-right font-semibold text-gray-700" />
              </tr>
            </thead>
            <tbody>
              {items.map((plan, i) => (
                <tr key={i} className={`border-b border-gray-100 ${plan.highlighted ? "bg-blue-50" : ""}`}>
                  <td className="py-4 px-6 font-medium text-gray-900">{plan.name}</td>
                  <td className="py-4 px-6 text-gray-700">
                    {plan.currency || ""}{plan.price}
                    <span className="text-gray-400 text-xs">{plan.period}</span>
                  </td>
                  <td className="py-4 px-6 text-gray-600">
                    {(plan.features || []).map((f) => f.value).join(", ")}
                  </td>
                  <td className="py-4 px-6 text-right">
                    <a
                      href={plan.ctaHref || "#"}
                      className={`inline-block px-4 py-2 rounded-md text-sm font-medium ${
                        plan.highlighted ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700"
                      }`}
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
          className={`max-w-6xl mx-auto grid gap-6 ${
            items.length === 1
              ? "grid-cols-1 max-w-md"
              : items.length === 2
                ? "grid-cols-1 md:grid-cols-2 max-w-3xl"
                : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
          }`}
        >
          {items.map((plan, i) => (
            <div
              key={i}
              className={`relative flex flex-col rounded-2xl border p-8 ${
                plan.highlighted
                  ? "border-blue-500 ring-2 ring-blue-500 shadow-xl scale-[1.02]"
                  : "border-gray-200 shadow-sm"
              }`}
            >
              {plan.highlighted && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 px-4 py-1 text-xs font-semibold text-white">
                  Most Popular
                </span>
              )}
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{plan.name}</h3>
              <div className="mb-6">
                <span className="text-sm text-gray-500">{plan.currency || ""}</span>
                <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
                <span className="text-sm text-gray-500">{plan.period || ""}</span>
              </div>
              <ul className="flex-1 space-y-3 mb-8">
                {(plan.features || []).map((feature, fi) => (
                  <li key={fi} className="flex items-center gap-2 text-sm text-gray-600">
                    <svg className="h-4 w-4 shrink-0 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {feature.value}
                  </li>
                ))}
              </ul>
              <a
                href={plan.ctaHref || "#"}
                className={`block w-full rounded-lg py-3 text-center text-sm font-semibold transition ${
                  plan.highlighted ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-gray-900 text-white hover:bg-gray-800"
                }`}
              >
                {plan.ctaLabel || "Get Started"}
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function CountdownRender({ title, subtitle, targetDate, completedMessage, variant }: CountdownProps) {
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
      <div className={`max-w-3xl mx-auto text-center ${variant === "card" ? "rounded-2xl border border-gray-200 shadow-lg p-10" : ""}`}>
        {title && (
          <h2 className={`text-3xl font-bold mb-2 ${variant === "default" ? "text-white" : "text-gray-900"}`}>
            {title}
          </h2>
        )}
        {subtitle && (
          <p className={`text-lg mb-8 ${variant === "default" ? "text-white/70" : "text-gray-500"}`}>
            {subtitle}
          </p>
        )}
        {isComplete ? (
          <p className={`text-xl font-semibold ${variant === "default" ? "text-white" : "text-gray-900"}`}>
            {completedMessage || "The event has started!"}
          </p>
        ) : (
          <div className="flex items-center justify-center gap-4">
            {units.map((unit, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className={`${boxClass} text-center`}>
                  <div className={numberClass}>{String(unit.value).padStart(2, "0")}</div>
                  <div className={labelClass}>{unit.label}</div>
                </div>
                {i < units.length - 1 && (
                  <span className={`text-3xl font-bold ${variant === "default" ? "text-white/40" : "text-gray-300"}`}>
                    :
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
        {!targetDate && (
          <p className={`mt-6 text-sm italic ${variant === "default" ? "text-white/50" : "text-gray-400"}`}>
            Set a target date to see the countdown
          </p>
        )}
      </div>
    </div>
  );
}
