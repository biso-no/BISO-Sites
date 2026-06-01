"use client";

import { CheckCircle, ExternalLink } from "lucide-react";
import Link from "next/link";
import { MONO_STACK, STUDIO } from "../../studio";

const DOMAIN_ROUTES: Record<string, string> = {
  jobs: "/jobs",
  events: "/events",
  news: "/news",
  pages: "/pages",
  shop: "/shop",
  benefits: "/benefits",
  documents: "/documents",
};

interface EntityResultCardProps {
  data: unknown;
  domain: string;
  operation?: "created" | "updated" | "published" | "deleted";
}

function extractId(data: unknown): string | null {
  if (!data || typeof data !== "object") {
    return null;
  }
  const d = data as Record<string, unknown>;
  return (d.data as string) ?? (d.$id as string) ?? (d.id as string) ?? null;
}

function extractTitle(data: unknown): string | null {
  if (!data || typeof data !== "object") {
    return null;
  }
  const d = data as Record<string, unknown>;
  if (d.data && typeof d.data === "object") {
    const inner = d.data as Record<string, unknown>;
    return (
      (inner.title as string) ??
      (inner.title_no as string) ??
      (inner.name as string) ??
      null
    );
  }
  return (
    (d.title as string) ?? (d.title_no as string) ?? (d.name as string) ?? null
  );
}

export function EntityResultCard({
  data,
  domain,
  operation = "created",
}: EntityResultCardProps) {
  const id = extractId(data);
  const title = extractTitle(data);
  const basePath = DOMAIN_ROUTES[domain] ?? `/${domain}`;
  const href = id ? `${basePath}/${id}` : basePath;

  const opLabels: Record<string, string> = {
    created: "Created",
    updated: "Updated",
    published: "Published",
    deleted: "Deleted",
  };
  const opColors: Record<string, string> = {
    created: STUDIO.leaf,
    updated: STUDIO.sky,
    published: STUDIO.gold,
    deleted: STUDIO.claret,
  };

  return (
    <div
      className="mt-2 flex items-start gap-3 rounded-xl border p-3.5"
      style={{
        background: "rgba(255,255,255,0.72)",
        borderColor: STUDIO.rule2,
        boxShadow: "0 2px 8px rgba(26,24,20,0.06)",
      }}
    >
      <CheckCircle
        size={16}
        style={{
          color: opColors[operation] ?? STUDIO.leaf,
          flexShrink: 0,
          marginTop: 2,
        }}
      />
      <div className="min-w-0 flex-1">
        <p
          className="font-medium text-xs uppercase tracking-wide"
          style={{
            color: opColors[operation] ?? STUDIO.leaf,
            fontFamily: MONO_STACK,
          }}
        >
          {opLabels[operation]} {domain}
        </p>
        {title && (
          <p
            className="mt-0.5 truncate text-[13px]"
            style={{ color: STUDIO.ink }}
          >
            {title}
          </p>
        )}
        {id && operation !== "deleted" && (
          <Link
            className="mt-1 inline-flex items-center gap-1 text-[11px] transition"
            href={href}
            style={{ color: STUDIO.sky }}
          >
            Open <ExternalLink size={10} />
          </Link>
        )}
      </div>
    </div>
  );
}
