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
      <section className="mx-auto max-w-5xl px-4 py-12">
        {(props.title || props.subtitle) && (
          <div className="mb-10 text-center">
            {props.title && (
              <h2 className="mb-2 font-bold text-3xl text-gray-900 tracking-tight">
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
              className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"
              key={i}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-xl">
                {iconMap[card.icon] || card.icon}
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">{card.title}</h3>
                <p className="mt-0.5 text-gray-500 text-sm">{card.value}</p>
              </div>
              {card.icon === "email" && card.value && (
                <a
                  className="mt-auto inline-flex items-center rounded-lg border border-gray-200 px-4 py-2 font-medium text-gray-700 text-sm transition hover:bg-gray-50 hover:text-blue-600"
                  href={`mailto:${card.value}`}
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
    <section className="mx-auto max-w-5xl px-4 py-12">
      {(props.title || props.subtitle) && (
        <div className="mb-10 text-center">
          {props.title && (
            <h2 className="mb-2 font-bold text-3xl text-gray-900 tracking-tight">
              {props.title}
            </h2>
          )}
          {props.subtitle && <p className="text-gray-600">{props.subtitle}</p>}
        </div>
      )}
      <div className="grid gap-10 lg:grid-cols-5">
        <form
          action={props.formAction || "#"}
          className="space-y-6 lg:col-span-3"
          method="POST"
        >
          {(props.fields ?? []).map((field, i) => {
            const inputClass =
              "w-full rounded-lg border border-gray-300 px-4 py-2 text-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";
            return (
              <div key={i}>
                <label
                  className="mb-1 block font-medium text-gray-700 text-sm"
                  htmlFor={field.name}
                >
                  {field.label}
                  {field.required && (
                    <span className="ml-1 text-red-500">*</span>
                  )}
                </label>
                {field.type === "textarea" ? (
                  <textarea
                    className={inputClass}
                    id={field.name}
                    name={field.name}
                    required={field.required}
                    rows={4}
                  />
                ) : field.type === "select" ? (
                  <select
                    className={inputClass}
                    id={field.name}
                    name={field.name}
                    required={field.required}
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
                    className={inputClass}
                    id={field.name}
                    name={field.name}
                    required={field.required}
                    type={field.type || "text"}
                  />
                )}
              </div>
            );
          })}
          <button
            className="inline-flex items-center rounded-lg bg-blue-600 px-6 py-3 font-medium text-sm text-white transition-colors hover:bg-blue-700"
            type="submit"
          >
            Send Message
          </button>
        </form>
        {(props.contactCards ?? []).length > 0 && (
          <div className="space-y-4 lg:col-span-2">
            {(props.contactCards ?? []).map((card, i) => (
              <div
                className="rounded-lg border bg-gray-50 p-5 transition-shadow hover:shadow-sm"
                key={i}
              >
                <div className="mb-2 text-2xl">
                  {iconMap[card.icon] || card.icon}
                </div>
                <h3 className="font-semibold text-gray-900 text-sm">
                  {card.title}
                </h3>
                <p className="mt-1 text-gray-600 text-sm">{card.value}</p>
              </div>
            ))}
          </div>
        )}
      </div>
      {props.showMap && (
        <div className="mt-10 overflow-hidden rounded-xl">
          <iframe
            height="300"
            loading="lazy"
            src="https://www.openstreetmap.org/export/embed.html?bbox=10.3,59.8,10.9,59.98&layer=mapnik"
            style={{ border: 0 }}
            title="Contact location"
            width="100%"
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

  const delta = 180 / 2 ** zoom;
  const bbox = `${lng - delta},${lat - delta},${lng + delta},${lat + delta}`;
  const markerSrc = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`;

  return (
    <section className="mx-auto max-w-5xl py-8">
      {props.title && (
        <h2 className="mb-4 font-bold text-2xl tracking-tight">
          {props.title}
        </h2>
      )}
      <div className="overflow-hidden rounded-xl border" style={{ height }}>
        <iframe
          height="100%"
          loading="lazy"
          src={markerSrc}
          style={{ border: 0 }}
          title={props.title || "Map"}
          width="100%"
        />
      </div>
    </section>
  );
}
