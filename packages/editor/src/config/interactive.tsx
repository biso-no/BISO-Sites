"use client";
import type { ContactFormProps, MapEmbedProps } from "./types";

export const InteractiveComponents = {
  ContactForm: {
    label: "Contact Form",
    fields: {
      title: { type: "text", label: "Title" },
      subtitle: { type: "textarea", label: "Subtitle" },
      formAction: { type: "text", label: "Form Action URL" },
      showMap: {
        type: "radio",
        label: "Show Map",
        options: [
          { label: "Yes", value: true },
          { label: "No", value: false },
        ],
      },
      fields: {
        type: "array",
        label: "Form Fields",
        getItemSummary: (item: { label?: string }) => item.label || "Field",
        arrayFields: {
          name: { type: "text", label: "Field Name" },
          label: { type: "text", label: "Label" },
          type: {
            type: "select",
            label: "Type",
            options: [
              { label: "Text", value: "text" },
              { label: "Email", value: "email" },
              { label: "Phone", value: "tel" },
              { label: "Textarea", value: "textarea" },
              { label: "Select", value: "select" },
            ],
          },
          required: {
            type: "radio",
            label: "Required",
            options: [
              { label: "Yes", value: true },
              { label: "No", value: false },
            ],
          },
        },
      },
      contactCards: {
        type: "array",
        label: "Contact Info Cards",
        getItemSummary: (item: { title?: string }) => item.title || "Card",
        arrayFields: {
          title: { type: "text", label: "Title" },
          value: { type: "text", label: "Value" },
          icon: {
            type: "select",
            label: "Icon",
            options: [
              { label: "Email", value: "email" },
              { label: "Phone", value: "phone" },
              { label: "Location", value: "location" },
              { label: "Clock", value: "clock" },
            ],
          },
        },
      },
    },
    render: (props: ContactFormProps) => {
      const iconMap: Record<string, string> = {
        email: "\u2709",
        phone: "\u260E",
        location: "\uD83D\uDCCD",
        clock: "\uD83D\uDD50",
      };

      return (
        <section className="mx-auto max-w-5xl py-12">
          {(props.title || props.subtitle) && (
            <div className="mb-10 text-center">
              {props.title && (
                <h2 className="mb-2 text-3xl font-bold tracking-tight">
                  {props.title}
                </h2>
              )}
              {props.subtitle && (
                <p className="text-gray-600">{props.subtitle}</p>
              )}
            </div>
          )}
          <div className="grid gap-10 lg:grid-cols-5">
            <form
              action={props.formAction || "#"}
              method="POST"
              className="space-y-6 lg:col-span-3"
            >
              {(props.fields ?? []).map((field, i) => (
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
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  ) : (
                    <input
                      id={field.name}
                      name={field.name}
                      type={field.type || "text"}
                      required={field.required}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  )}
                </div>
              ))}
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
    },
    defaultProps: {
      title: "Contact Us",
      subtitle: "We would love to hear from you. Fill out the form below.",
      formAction: "",
      showMap: false,
      fields: [
        { name: "name", label: "Full Name", type: "text", required: true },
        { name: "email", label: "Email Address", type: "email", required: true },
        { name: "message", label: "Message", type: "textarea", required: true },
      ] as ContactFormProps["fields"],
      contactCards: [
        { title: "Email", value: "contact@example.com", icon: "email" },
        { title: "Phone", value: "+47 123 45 678", icon: "phone" },
        { title: "Office", value: "Oslo, Norway", icon: "location" },
      ] as ContactFormProps["contactCards"],
    },
  },
  MapEmbed: {
    label: "Map Embed",
    fields: {
      title: { type: "text", label: "Title" },
      lat: { type: "number", label: "Latitude" },
      lng: { type: "number", label: "Longitude" },
      zoom: {
        type: "select",
        label: "Zoom Level",
        options: [
          { label: "City", value: 12 },
          { label: "Neighborhood", value: 14 },
          { label: "Street", value: 16 },
          { label: "Building", value: 18 },
        ],
      },
      height: {
        type: "select",
        label: "Height",
        options: [
          { label: "Small (250px)", value: "250px" },
          { label: "Medium (400px)", value: "400px" },
          { label: "Large (550px)", value: "550px" },
        ],
      },
    },
    render: (props: MapEmbedProps) => {
      const lat = props.lat ?? 59.9139;
      const lng = props.lng ?? 10.7522;
      const zoom = props.zoom ?? 14;
      const height = props.height ?? "400px";

      // Build OpenStreetMap embed bounding box from center + zoom
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
    },
    defaultProps: {
      title: "",
      lat: 59.9139,
      lng: 10.7522,
      zoom: 14,
      height: "400px",
    },
  },
} as const;
