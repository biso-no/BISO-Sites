import {
  Briefcase,
  Calendar,
  DollarSign,
  ExternalLink,
  MapPin,
  Package,
  ShoppingCart,
  Tag,
  Users,
} from "lucide-react";
import type { JobDetailProps, ProductDetailProps } from "./types";

export function JobDetailRender(props: JobDetailProps) {
  const metaItems = [
    props.department && {
      icon: <Users className="h-4 w-4" />,
      label: "Department",
      value: props.department,
    },
    props.location && {
      icon: <MapPin className="h-4 w-4" />,
      label: "Location",
      value: props.location,
    },
    props.type && {
      icon: <Briefcase className="h-4 w-4" />,
      label: "Type",
      value: props.type,
    },
    props.deadline && {
      icon: <Calendar className="h-4 w-4" />,
      label: "Deadline",
      value: props.deadline,
    },
    props.paid !== undefined && {
      icon: <DollarSign className="h-4 w-4" />,
      label: "Compensation",
      value: props.paid ? (props.salary ?? "Paid") : "Volunteer",
    },
  ].filter(Boolean) as {
    icon: React.ReactNode;
    label: string;
    value: string;
  }[];

  return (
    <article className="mx-auto max-w-4xl px-4 py-12">
      <div className="mb-8 rounded-2xl bg-gradient-to-br from-[#001731] to-[#003366] px-8 py-10 text-white">
        {(props.type || props.paid !== undefined) && (
          <div className="mb-3 flex flex-wrap gap-2">
            {props.type && (
              <span className="rounded-full bg-white/10 px-3 py-0.5 text-xs font-medium text-white/90">
                {props.type}
              </span>
            )}
            {props.paid !== undefined && (
              <span
                className={`rounded-full px-3 py-0.5 text-xs font-medium ${props.paid ? "bg-emerald-500/20 text-emerald-200" : "bg-gray-500/20 text-gray-200"}`}
              >
                {props.paid ? "Paid" : "Volunteer"}
              </span>
            )}
          </div>
        )}
        <h1 className="text-3xl font-bold md:text-4xl">
          {props.title || "Job Title"}
        </h1>
        {props.department && (
          <p className="mt-2 text-lg text-white/70">{props.department}</p>
        )}
        {props.showApplyButton && props.applyUrl && (
          <div className="mt-6">
            <a
              href={props.applyUrl}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-[#001731] transition hover:bg-white/90"
            >
              <ExternalLink className="h-4 w-4" />
              {props.applyLabel || "Apply now"}
            </a>
          </div>
        )}
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-8">
          {props.description && (
            <section>
              <h2 className="mb-3 text-xl font-semibold text-gray-900">
                About the role
              </h2>
              <p className="text-gray-600 leading-relaxed whitespace-pre-wrap">
                {props.description}
              </p>
            </section>
          )}
          {props.responsibilities && props.responsibilities.length > 0 && (
            <section>
              <h2 className="mb-3 text-xl font-semibold text-gray-900">
                Responsibilities
              </h2>
              <ul className="space-y-2">
                {props.responsibilities.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-gray-600">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                    {r.value}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {props.requirements && props.requirements.length > 0 && (
            <section>
              <h2 className="mb-3 text-xl font-semibold text-gray-900">
                Requirements
              </h2>
              <ul className="space-y-2">
                {props.requirements.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-gray-600">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                    {r.value}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 font-semibold text-gray-900">Details</h3>
            <dl className="space-y-3">
              {metaItems.map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="mt-0.5 text-gray-400">{item.icon}</span>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">
                      {item.label}
                    </dt>
                    <dd className="mt-0.5 text-sm text-gray-700">
                      {item.value}
                    </dd>
                  </div>
                </div>
              ))}
            </dl>
          </div>
          {(props.showApplyButton || props.contactEmail) && (
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-3">
              {props.showApplyButton && props.applyUrl && (
                <a
                  href={props.applyUrl}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#001731] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#001731]/90"
                >
                  <ExternalLink className="h-4 w-4" />
                  {props.applyLabel || "Apply now"}
                </a>
              )}
              {props.contactEmail && (
                <a
                  href={`mailto:${props.contactEmail}`}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 px-5 py-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                >
                  Questions? Contact us
                </a>
              )}
            </div>
          )}
        </aside>
      </div>
    </article>
  );
}

export function ProductDetailRender(props: ProductDetailProps) {
  const images = props.images ?? [];
  const mainImage = images[0];
  const isOutOfStock = props.stock === 0;
  const isOnSale = Boolean(props.originalPrice);

  return (
    <article className="mx-auto max-w-5xl px-4 py-12">
      <div className="grid gap-10 lg:grid-cols-2">
        <div className="space-y-3">
          {mainImage ? (
            <div className="overflow-hidden rounded-2xl border border-gray-100 bg-gray-50">
              <img
                src={mainImage.url}
                alt={mainImage.alt ?? props.title ?? "Product"}
                className="h-96 w-full object-cover"
              />
            </div>
          ) : (
            <div className="flex h-80 items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50">
              <Package className="h-16 w-16 text-gray-300" />
            </div>
          )}
          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {images.map((img, i) => (
                <img
                  key={i}
                  src={img.url}
                  alt={img.alt ?? `Image ${i + 1}`}
                  className="h-16 w-16 shrink-0 rounded-lg border border-gray-200 object-cover"
                />
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col">
          <div className="mb-3 flex flex-wrap gap-2">
            {props.badge && (
              <span className="rounded-full bg-blue-100 px-3 py-0.5 text-xs font-semibold text-blue-700">
                {props.badge}
              </span>
            )}
            {isOnSale && (
              <span className="rounded-full bg-red-100 px-3 py-0.5 text-xs font-semibold text-red-700">
                Sale
              </span>
            )}
            {isOutOfStock && (
              <span className="rounded-full bg-gray-100 px-3 py-0.5 text-xs font-semibold text-gray-600">
                Out of stock
              </span>
            )}
          </div>

          <h1 className="text-3xl font-bold text-gray-900">
            {props.title || "Product Name"}
          </h1>

          <div className="mt-3 flex items-baseline gap-3">
            {props.price && (
              <span className="text-2xl font-bold text-gray-900">
                {props.price}
              </span>
            )}
            {props.originalPrice && (
              <span className="text-base text-gray-400 line-through">
                {props.originalPrice}
              </span>
            )}
          </div>

          {props.sku && (
            <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-400">
              <Tag className="h-3.5 w-3.5" />
              SKU: {props.sku}
            </p>
          )}

          {props.description && (
            <p className="mt-4 text-gray-600 leading-relaxed">
              {props.description}
            </p>
          )}

          {props.features && props.features.length > 0 && (
            <ul className="mt-4 space-y-1.5">
              {props.features.map((f, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-sm text-gray-600"
                >
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                  {f.value}
                </li>
              ))}
            </ul>
          )}

          {props.options && props.options.length > 0 && (
            <div className="mt-6 space-y-4">
              {props.options.map((opt, oi) => (
                <div key={oi}>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    {opt.name}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {(opt.values ?? []).map((v, vi) => (
                      <button
                        key={vi}
                        type="button"
                        className="rounded-lg border border-gray-200 px-4 py-2 text-sm transition hover:border-blue-400 hover:text-blue-600"
                      >
                        {v.value}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 flex flex-col gap-3">
            {props.showAddToCart && (
              <button
                type="button"
                disabled={isOutOfStock}
                className="flex items-center justify-center gap-2 rounded-xl bg-[#001731] px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-[#001731]/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ShoppingCart className="h-4 w-4" />
                {isOutOfStock ? "Out of stock" : "Add to cart"}
              </button>
            )}
            {props.ctaHref && props.ctaLabel && (
              <a
                href={props.ctaHref}
                className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-6 py-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                {props.ctaLabel}
              </a>
            )}
          </div>

          {props.pickupInfo && (
            <div className="mt-6 rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
              <p className="font-medium text-gray-700 mb-1">
                Pickup information
              </p>
              <p>{props.pickupInfo}</p>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
