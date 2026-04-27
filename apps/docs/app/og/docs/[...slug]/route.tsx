import { getPageImage, source } from "@/lib/source";
import { notFound } from "next/navigation";
import { ImageResponse } from "next/og";

export const revalidate = false;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await params;
  const page = source.getPage(slug.slice(0, -1));
  if (!page) {
    notFound();
  }

  const title = page.data.title ?? "Untitled";
  const titleFontSize = title.length > 40 ? 52 : 64;

  return new ImageResponse(
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        width: "100%",
        height: "100%",
        background:
          "linear-gradient(135deg, #001731 0%, #002a5c 60%, #0a3d6b 100%)",
        padding: "60px 72px",
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
        position: "relative",
      }}
    >
      {/* Subtle brand blue glow top-right */}
      <div
        style={{
          position: "absolute",
          top: -120,
          right: -80,
          width: 480,
          height: 480,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(61,169,224,0.22) 0%, transparent 70%)",
        }}
      />
      {/* Yellow accent glow bottom-left */}
      <div
        style={{
          position: "absolute",
          bottom: -100,
          left: -60,
          width: 360,
          height: 360,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(247,214,74,0.12) 0%, transparent 70%)",
        }}
      />

      {/* Site wordmark */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: "#3DA9E0",
          }}
        />
        <span
          style={{
            color: "rgba(255,255,255,0.55)",
            fontSize: 18,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          BISO Docs
        </span>
      </div>

      {/* Page title + description */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 20,
          maxWidth: 880,
        }}
      >
        <div
          style={{
            width: 48,
            height: 4,
            borderRadius: 2,
            background: "#3DA9E0",
          }}
        />
        <div
          style={{
            color: "#ffffff",
            fontSize: titleFontSize,
            fontWeight: 700,
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
          }}
        >
          {title}
        </div>
        {page.data.description && (
          <div
            style={{
              color: "rgba(255,255,255,0.60)",
              fontSize: 24,
              lineHeight: 1.5,
              maxWidth: 740,
            }}
          >
            {page.data.description}
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span style={{ color: "#3DA9E0", fontSize: 18, fontWeight: 600 }}>
          biso.no
        </span>
        <span
          style={{
            color: "rgba(255,255,255,0.30)",
            fontSize: 16,
          }}
        >
          BI Student Organisation
        </span>
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
    }
  );
}

export function generateStaticParams() {
  return source.getPages().map((page) => ({
    lang: page.locale,
    slug: getPageImage(page).segments,
  }));
}
