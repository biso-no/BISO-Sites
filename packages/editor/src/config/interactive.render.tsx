import type { ContactFormProps, MapEmbedProps } from "./types";

export function ContactFormRender(
  props: ContactFormProps & { variant?: string }
) {
  const iconMap: Record<string, string> = {
    email: "✉",
    phone: "☎",
    location: "📍",
    clock: "🕐",
  };

  if (props.variant === "campus-grid") {
    const cards = props.contactCards ?? [];
    return (
      <section className="mx-auto max-w-5xl py-12 px-4">
        {(props.title || props.subtitle) && (
          <div className="mb-10 text-center">
            {props.title && (
              <h2 className="mb-2 text-3xl font-bold tracking-tight text-gray-900">
                {props.title}
              </h2>
            )}
            {props.subtitle && (
              <p className="text-gray-500">{props.subtitle}</p>
            )}
          </div>
        )}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card, i) => (
            <div
              key={i}
              className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-xl">
                {iconMap[card.icon] || card.icon}
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">{card.title}</h3>
                <p className="mt-0.5 text-sm text-gray-500">{card.value}</p>
              </div>
              {card.icon === "email" && card.value && (
                <a
                  href={`mailto:${card.value}`}
                  className="mt-auto inline-flex items-center rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 hover:text-blue-600"
                >
                  Send email
                </a>
              )}
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-5xl py-12 px-4">
      {(props.title || props.subtitle) && (
        <div className="mb-10 text-center">
          {props.title && (
            <h2 className="mb-2 text-3xl font-bold tracking-tight text-gray-900">
              {props.title}
            </h2>
          )}
          {props.subtitle && <p className="text-gray-600">{props.subtitle}</p>}
        </div>
      )}
      <div className="grid gap-10 lg:grid-cols-5">
        <form
          action={props.formAction || "#"}
          method="POST"
          className="space-y-6 lg:col-span-3"
        >
          {(props.fields ?? []).map((field, i) => {
            const inputClass =
              "w-full rounded-lg border border-gray-300 px-4 py-2 text-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";
            return (
              <div key={i}>
                <label
                  htmlFor={field.name}
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  {field.label}
                  {field.required && (
                    <span className="ml-1 text-red-500">*</span>
                  )}
                </label>
                {field.type === "textarea" ? (
                  <textarea
                    id={field.name}
                    name={field.name}
                    required={field.required}
                    rows={4}
                    className={inputClass}
                  />
                ) : field.type === "select" ? (
                  <select
                    id={field.name}
                    name={field.name}
                    required={field.required}
                    className={inputClass}
                  >
                    <option value="">Select…</option>
                    {((field as any).options ?? "")
                      .split(",")
                      .map((o: string) => o.trim())
                      .filter(Boolean)
                      .map((o: string, oi: number) => (
                        <option key={oi} value={o}>
                          {o}
                        </option>
                      ))}
                  </select>
                ) : (
                  <input
                    id={field.name}
                    name={field.name}
                    type={field.type || "text"}
                    required={field.required}
                    className={inputClass}
                  />
                )}
              </div>
            );
          })}
          <button
            type="submit"
            className="inline-flex items-center rounded-lg bg-blue-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            Send Message
          </button>
        </form>
        {(props.contactCards ?? []).length > 0 && (
          <div className="space-y-4 lg:col-span-2">
            {(props.contactCards ?? []).map((card, i) => (
              <div
                key={i}
                className="rounded-lg border bg-gray-50 p-5 transition-shadow hover:shadow-sm"
              >
                <div className="mb-2 text-2xl">
                  {iconMap[card.icon] || card.icon}
                </div>
                <h3 className="text-sm font-semibold text-gray-900">
                  {card.title}
                </h3>
                <p className="mt-1 text-sm text-gray-600">{card.value}</p>
              </div>
            ))}
          </div>
        )}
      </div>
      {props.showMap && (
        <div className="mt-10 overflow-hidden rounded-xl">
          <iframe
            title="Contact location"
            width="100%"
            height="300"
            style={{ border: 0 }}
            loading="lazy"
            src="https://www.openstreetmap.org/export/embed.html?bbox=10.3,59.8,10.9,59.98&layer=mapnik"
          />
        </div>
      )}
    </section>
  );
}

export function MapEmbedRender(props: MapEmbedProps) {
  const lat = props.lat ?? 59.9139;
  const lng = props.lng ?? 10.7522;
  const zoom = props.zoom ?? 14;
  const height = props.height ?? "400px";

  const delta = 180 / Math.pow(2, zoom);
  const bbox = `${lng - delta},${lat - delta},${lng + delta},${lat + delta}`;
  const markerSrc = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`;

  return (
    <section className="mx-auto max-w-5xl py-8">
      {props.title && (
        <h2 className="mb-4 text-2xl font-bold tracking-tight">
          {props.title}
        </h2>
      )}
      <div className="overflow-hidden rounded-xl border" style={{ height }}>
        <iframe
          title={props.title || "Map"}
          width="100%"
          height="100%"
          style={{ border: 0 }}
          loading="lazy"
          src={markerSrc}
        />
      </div>
    </section>
  );
}
