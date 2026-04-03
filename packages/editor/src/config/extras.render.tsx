import {
  CheckCheck,
  Download,
  FileText,
  Mail,
  MapPin,
  Phone,
} from "lucide-react";
import type {
  AlertCardProps,
  ChecklistCardProps,
  ContactCardsProps,
  DownloadListProps,
  NumberedStepsProps,
  TagListProps,
} from "./types";

export function ContactCardsRender({
  title,
  subtitle,
  variant = "cards",
  columns = 3,
  items = [],
}: ContactCardsProps) {
  const colClass: Record<number, string> = {
    1: "grid-cols-1",
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
  };

  if (variant === "compact") {
    return (
      <section className="w-full py-10 px-4">
        {title && (
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{title}</h2>
        )}
        {subtitle && <p className="text-gray-500 mb-6">{subtitle}</p>}
        <div className="divide-y divide-gray-100 rounded-xl border border-gray-200">
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              {item.avatar ? (
                <img
                  src={item.avatar}
                  alt={item.name}
                  className="h-9 w-9 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-600">
                  {item.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-medium text-gray-900 truncate">
                  {item.name}
                </p>
                {(item.role || item.department) && (
                  <p className="text-xs text-gray-500 truncate">
                    {[item.role, item.department].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
              {item.email && (
                <a
                  href={`mailto:${item.email}`}
                  className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 transition-colors"
                >
                  <Mail className="h-4 w-4" />
                </a>
              )}
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (variant === "horizontal") {
    return (
      <section className="w-full py-10 px-4">
        {title && (
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{title}</h2>
        )}
        {subtitle && <p className="text-gray-500 mb-8">{subtitle}</p>}
        <div className="space-y-4">
          {items.map((item, i) => (
            <div
              key={i}
              className="flex items-center gap-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              {item.avatar ? (
                <img
                  src={item.avatar}
                  alt={item.name}
                  className="h-16 w-16 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-xl font-bold text-white">
                  {item.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900">
                  {item.name}
                </h3>
                {(item.role || item.department) && (
                  <p className="text-sm text-gray-500">
                    {[item.role, item.department].filter(Boolean).join(" · ")}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap gap-3">
                  {item.email && (
                    <a
                      href={`mailto:${item.email}`}
                      className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800"
                    >
                      <Mail className="h-3.5 w-3.5" />
                      {item.email}
                    </a>
                  )}
                  {item.phone && (
                    <a
                      href={`tel:${item.phone}`}
                      className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900"
                    >
                      <Phone className="h-3.5 w-3.5" />
                      {item.phone}
                    </a>
                  )}
                  {item.location && (
                    <span className="flex items-center gap-1.5 text-sm text-gray-500">
                      <MapPin className="h-3.5 w-3.5" />
                      {item.location}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="w-full py-12 px-4">
      {(title || subtitle) && (
        <div className="mb-10 text-center">
          {title && (
            <h2 className="text-3xl font-bold text-gray-900 mb-2">{title}</h2>
          )}
          {subtitle && <p className="text-lg text-gray-500">{subtitle}</p>}
        </div>
      )}
      <div className={`grid gap-6 ${colClass[columns] ?? colClass[3]}`}>
        {items.map((item, i) => (
          <div
            key={i}
            className="flex flex-col items-center rounded-2xl border border-gray-100 bg-white p-6 text-center shadow-sm transition hover:shadow-md"
          >
            {item.avatar ? (
              <img
                src={item.avatar}
                alt={item.name}
                className="mb-4 h-20 w-20 rounded-full object-cover ring-2 ring-gray-100"
              />
            ) : (
              <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-2xl font-bold text-white">
                {item.name.charAt(0).toUpperCase()}
              </div>
            )}
            <h3 className="font-semibold text-gray-900">{item.name}</h3>
            {item.role && (
              <p className="mt-0.5 text-sm text-gray-500">{item.role}</p>
            )}
            {item.department && (
              <p className="mt-0.5 text-xs font-medium text-blue-600">
                {item.department}
              </p>
            )}
            <div className="mt-4 flex flex-col gap-2 w-full">
              {item.email && (
                <a
                  href={`mailto:${item.email}`}
                  className="flex items-center justify-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                >
                  <Mail className="h-4 w-4 text-gray-400" />
                  Send email
                </a>
              )}
              {item.phone && (
                <a
                  href={`tel:${item.phone}`}
                  className="flex items-center justify-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                >
                  <Phone className="h-4 w-4 text-gray-400" />
                  {item.phone}
                </a>
              )}
              {item.location && (
                <span className="flex items-center justify-center gap-1.5 text-xs text-gray-400">
                  <MapPin className="h-3.5 w-3.5" />
                  {item.location}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function DownloadListRender({
  title,
  subtitle,
  variant = "list",
  items = [],
}: DownloadListProps) {
  const typeColors: Record<string, string> = {
    pdf: "bg-red-50 text-red-700 border-red-200",
    docx: "bg-blue-50 text-blue-700 border-blue-200",
    xlsx: "bg-green-50 text-green-700 border-green-200",
    png: "bg-purple-50 text-purple-700 border-purple-200",
    jpg: "bg-orange-50 text-orange-700 border-orange-200",
    zip: "bg-yellow-50 text-yellow-700 border-yellow-200",
  };
  const typeColor = (t?: string) => {
    const key = (t ?? "").toLowerCase();
    return typeColors[key] ?? "bg-gray-50 text-gray-600 border-gray-200";
  };

  if (variant === "grid") {
    return (
      <section className="w-full py-10 px-4">
        {title && (
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{title}</h2>
        )}
        {subtitle && <p className="text-gray-500 mb-6">{subtitle}</p>}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item, i) => (
            <a
              key={i}
              href={item.url || "#"}
              download
              className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-5 transition hover:shadow-md hover:border-blue-200 group"
            >
              <div className="flex items-start justify-between">
                <FileText className="h-8 w-8 text-gray-400 group-hover:text-blue-500 transition" />
                {item.type && (
                  <span
                    className={`rounded border px-2 py-0.5 text-xs font-semibold uppercase ${typeColor(item.type)}`}
                  >
                    {item.type}
                  </span>
                )}
              </div>
              <div>
                <p className="font-medium text-gray-900">{item.name}</p>
                {item.description && (
                  <p className="mt-0.5 text-sm text-gray-500">
                    {item.description}
                  </p>
                )}
                {item.size && (
                  <p className="mt-1 text-xs text-gray-400">{item.size}</p>
                )}
              </div>
              <div className="mt-auto flex items-center gap-1.5 text-sm font-medium text-blue-600">
                <Download className="h-4 w-4" />
                Download
              </div>
            </a>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="w-full py-10 px-4">
      {title && (
        <h2 className="text-2xl font-bold text-gray-900 mb-2">{title}</h2>
      )}
      {subtitle && <p className="text-gray-500 mb-6">{subtitle}</p>}
      <div className="rounded-xl border border-gray-200 divide-y divide-gray-100 bg-white">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3.5">
            <FileText className="h-5 w-5 shrink-0 text-gray-400" />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-gray-900 truncate">{item.name}</p>
              {item.description && (
                <p className="text-sm text-gray-500 truncate">
                  {item.description}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              {item.size && (
                <span className="text-xs text-gray-400">{item.size}</span>
              )}
              {item.type && (
                <span
                  className={`rounded border px-2 py-0.5 text-xs font-semibold uppercase ${typeColor(item.type)}`}
                >
                  {item.type}
                </span>
              )}
              <a
                href={item.url || "#"}
                download
                className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 hover:border-blue-300 hover:text-blue-600"
              >
                <Download className="h-3.5 w-3.5" />
                Download
              </a>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function NumberedStepsRender({
  title,
  subtitle,
  variant = "vertical",
  steps = [],
}: NumberedStepsProps) {
  if (variant === "horizontal") {
    return (
      <section className="w-full py-12 px-4">
        {(title || subtitle) && (
          <div className="mb-10 text-center">
            {title && (
              <h2 className="text-3xl font-bold text-gray-900 mb-2">{title}</h2>
            )}
            {subtitle && <p className="text-lg text-gray-500">{subtitle}</p>}
          </div>
        )}
        <div className="max-w-5xl mx-auto">
          <div className="flex items-start gap-0">
            {steps.map((step, i) => (
              <div key={i} className="flex-1 relative">
                {i < steps.length - 1 && (
                  <div className="absolute top-5 left-1/2 right-0 h-px bg-gray-200" />
                )}
                <div className="flex flex-col items-center text-center px-4">
                  <div className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white shadow">
                    {i + 1}
                  </div>
                  <h3 className="mt-3 font-semibold text-gray-900">
                    {step.title}
                  </h3>
                  {step.description && (
                    <p className="mt-1 text-sm text-gray-500">
                      {step.description}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (variant === "cards") {
    return (
      <section className="w-full py-12 px-4">
        {(title || subtitle) && (
          <div className="mb-10 text-center">
            {title && (
              <h2 className="text-3xl font-bold text-gray-900 mb-2">{title}</h2>
            )}
            {subtitle && <p className="text-lg text-gray-500">{subtitle}</p>}
          </div>
        )}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto">
          {steps.map((step, i) => (
            <div
              key={i}
              className="relative rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"
            >
              <span className="absolute -top-3 -left-3 flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white shadow-md">
                {i + 1}
              </span>
              <h3 className="mt-2 font-semibold text-gray-900">{step.title}</h3>
              {step.description && (
                <p className="mt-2 text-sm text-gray-500">{step.description}</p>
              )}
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="w-full py-12 px-4">
      {(title || subtitle) && (
        <div className="mb-10">
          {title && (
            <h2 className="text-3xl font-bold text-gray-900 mb-2">{title}</h2>
          )}
          {subtitle && <p className="text-lg text-gray-500">{subtitle}</p>}
        </div>
      )}
      <div className="max-w-2xl space-y-0">
        {steps.map((step, i) => (
          <div key={i} className="flex gap-5">
            <div className="flex flex-col items-center">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
                {i + 1}
              </div>
              {i < steps.length - 1 && (
                <div
                  className="mt-1 w-px flex-1 bg-gray-200"
                  style={{ minHeight: "2rem" }}
                />
              )}
            </div>
            <div className="pb-8">
              <h3 className="font-semibold text-gray-900">{step.title}</h3>
              {step.description && (
                <p className="mt-1 text-sm text-gray-600">{step.description}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function TagListRender({
  title,
  variant = "default",
  size = "md",
  align = "left",
  tags = [],
}: TagListProps) {
  const sizeClass = {
    sm: "px-2.5 py-0.5 text-xs",
    md: "px-3 py-1 text-sm",
    lg: "px-4 py-1.5 text-base",
  };
  const alignClass = {
    left: "justify-start",
    center: "justify-center",
    right: "justify-end",
  };
  const variantClass: Record<string, string> = {
    default: "bg-gray-100 text-gray-700 hover:bg-gray-200",
    outline:
      "border border-gray-300 text-gray-700 hover:border-blue-400 hover:text-blue-600",
    solid: "bg-blue-600 text-white hover:bg-blue-700",
    gradient: "bg-gradient-to-r from-blue-600 to-indigo-600 text-white",
  };

  return (
    <div className="py-3 px-4">
      {title && (
        <span className="mr-3 text-sm font-medium text-gray-600">{title}</span>
      )}
      <div
        className={`flex flex-wrap gap-2 ${alignClass[align] ?? "justify-start"} ${title ? "mt-2" : ""}`}
      >
        {tags.map((tag, i) => {
          const cls = `inline-flex items-center rounded-full font-medium transition ${sizeClass[size] ?? sizeClass.md} ${variantClass[variant] ?? variantClass.default}`;
          return tag.href ? (
            <a key={i} href={tag.href} className={cls}>
              {tag.label}
            </a>
          ) : (
            <span key={i} className={cls}>
              {tag.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export function AlertCardRender({
  title,
  content,
  variant = "info",
  icon = true,
  ctaLabel,
  ctaHref,
}: AlertCardProps) {
  const styles: Record<
    string,
    { wrapper: string; icon: string; title: string; text: string; btn: string }
  > = {
    info: {
      wrapper: "bg-blue-50 border-blue-200",
      icon: "text-blue-500",
      title: "text-blue-800",
      text: "text-blue-700",
      btn: "bg-blue-100 text-blue-700 hover:bg-blue-200",
    },
    warning: {
      wrapper: "bg-amber-50 border-amber-200",
      icon: "text-amber-500",
      title: "text-amber-800",
      text: "text-amber-700",
      btn: "bg-amber-100 text-amber-700 hover:bg-amber-200",
    },
    success: {
      wrapper: "bg-emerald-50 border-emerald-200",
      icon: "text-emerald-500",
      title: "text-emerald-800",
      text: "text-emerald-700",
      btn: "bg-emerald-100 text-emerald-700 hover:bg-emerald-200",
    },
    error: {
      wrapper: "bg-red-50 border-red-200",
      icon: "text-red-500",
      title: "text-red-800",
      text: "text-red-700",
      btn: "bg-red-100 text-red-700 hover:bg-red-200",
    },
    neutral: {
      wrapper: "bg-gray-50 border-gray-200",
      icon: "text-gray-500",
      title: "text-gray-800",
      text: "text-gray-600",
      btn: "bg-gray-100 text-gray-700 hover:bg-gray-200",
    },
  };

  const iconPaths: Record<string, string> = {
    info: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
    warning:
      "M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z",
    success: "M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
    error:
      "M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
    neutral:
      "M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z",
  };

  const s = styles[variant] ?? styles.info;

  return (
    <div className={`w-full rounded-xl border p-5 ${s.wrapper}`}>
      <div className="flex gap-3">
        {icon && (
          <svg
            className={`mt-0.5 h-5 w-5 shrink-0 ${s.icon}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d={iconPaths[variant] ?? iconPaths.info}
            />
          </svg>
        )}
        <div className="flex-1">
          {title && <h4 className={`font-semibold ${s.title}`}>{title}</h4>}
          {content && <p className={`mt-1 text-sm ${s.text}`}>{content}</p>}
          {ctaLabel && ctaHref && (
            <a
              href={ctaHref}
              className={`mt-3 inline-block rounded-md px-3 py-1.5 text-sm font-medium transition ${s.btn}`}
            >
              {ctaLabel}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export function ChecklistCardRender({
  title,
  description,
  variant = "default",
  checkStyle = "circle",
  items = [],
  ctaLabel,
  ctaHref,
}: ChecklistCardProps) {
  const wrapperClass =
    variant === "bordered"
      ? "rounded-2xl border-2 border-gray-200 bg-white p-6"
      : variant === "tinted"
        ? "rounded-2xl bg-blue-50 p-6"
        : "rounded-2xl border border-gray-100 bg-white p-6 shadow-sm";

  const CheckIcon = () => {
    if (checkStyle === "square") {
      return (
        <svg
          className="h-4 w-4 text-blue-600"
          viewBox="0 0 16 16"
          fill="currentColor"
        >
          <path d="M2 2h12v12H2z" className="text-blue-100" />
          <path
            d="M5 8l2.5 2.5L11 5.5"
            stroke="currentColor"
            strokeWidth={1.5}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    }
    if (checkStyle === "arrow") {
      return (
        <svg
          className="h-4 w-4 text-blue-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M13 7l5 5m0 0l-5 5m5-5H6"
          />
        </svg>
      );
    }
    return <CheckCheck className="h-4 w-4 text-blue-600" />;
  };

  return (
    <div className={`w-full ${wrapperClass}`}>
      {title && (
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      )}
      {description && (
        <p className="mt-1.5 text-sm text-gray-500">{description}</p>
      )}
      <ul className="mt-4 space-y-2.5">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-3">
            <span
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${item.checked !== false ? "bg-blue-100" : "bg-gray-100"}`}
            >
              {item.checked !== false ? (
                <CheckIcon />
              ) : (
                <span className="h-2 w-2 rounded-full bg-gray-300" />
              )}
            </span>
            <span
              className={`text-sm ${item.checked !== false ? "text-gray-700" : "text-gray-500"}`}
            >
              {item.text}
            </span>
          </li>
        ))}
      </ul>
      {ctaLabel && ctaHref && (
        <a
          href={ctaHref}
          className="mt-5 inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
        >
          {ctaLabel}
        </a>
      )}
    </div>
  );
}
