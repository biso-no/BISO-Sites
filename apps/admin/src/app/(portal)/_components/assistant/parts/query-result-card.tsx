"use client";

import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { MONO_STACK, SERIF_STACK, STUDIO } from "../../studio";

const DOMAIN_ROUTES: Record<string, string> = {
  jobs: "/jobs",
  events: "/events",
  news: "/news",
  pages: "/pages",
  shop: "/shop",
  benefits: "/benefits",
  documents: "/documents",
};

interface QueryResultRow {
  $createdAt?: string;
  $id?: string;
  $updatedAt?: string;
  id?: string;
  slug?: string;
  status?: string;
  title?: string;
  title_no?: string;
  translations?: Array<{ locale: string; title?: string }>;
}

interface QueryResultCardProps {
  data: unknown;
  domain: string;
}

function extractRows(data: unknown): QueryResultRow[] {
  if (!data || typeof data !== "object") {
    return [];
  }
  const d = data as Record<string, unknown>;
  if (Array.isArray(d.rows)) {
    return d.rows as QueryResultRow[];
  }
  if (Array.isArray(d)) {
    return d as QueryResultRow[];
  }
  return [];
}

function getTitle(row: QueryResultRow): string {
  if (row.title) {
    return row.title;
  }
  if (row.title_no) {
    return row.title_no;
  }
  if (row.translations) {
    const noTitle = row.translations.find((t) => t.locale === "no")?.title;
    const enTitle = row.translations.find((t) => t.locale === "en")?.title;
    return noTitle ?? enTitle ?? "Untitled";
  }
  return "Untitled";
}

function getTotal(data: unknown): number | null {
  if (!data || typeof data !== "object") {
    return null;
  }
  const d = data as Record<string, unknown>;
  return typeof d.total === "number" ? d.total : null;
}

export function QueryResultCard({ data, domain }: QueryResultCardProps) {
  const rows = extractRows(data);
  const total = getTotal(data);
  const basePath = DOMAIN_ROUTES[domain] ?? `/${domain}`;

  if (rows.length === 0) {
    return (
      <div
        className="mt-2 rounded-xl border p-4"
        style={{
          background: "rgba(255,255,255,0.72)",
          borderColor: STUDIO.rule2,
        }}
      >
        <p
          className="text-[13px] italic"
          style={{ color: STUDIO.ink3, fontFamily: SERIF_STACK }}
        >
          No results found.
        </p>
      </div>
    );
  }

  return (
    <div
      className="mt-2 overflow-hidden rounded-xl border"
      style={{
        background: "rgba(255,255,255,0.72)",
        borderColor: STUDIO.rule2,
        boxShadow: "0 2px 8px rgba(26,24,20,0.06)",
      }}
    >
      <div
        className="flex items-center justify-between border-b px-3.5 py-2"
        style={{
          borderColor: STUDIO.rule,
          background: "rgba(250,247,242,0.8)",
        }}
      >
        <span
          className="font-semibold text-[10px] uppercase tracking-wide"
          style={{ color: STUDIO.ink3, fontFamily: MONO_STACK }}
        >
          {domain}
        </span>
        {total !== null && (
          <span
            className="text-[10px]"
            style={{ color: STUDIO.ink4, fontFamily: MONO_STACK }}
          >
            {rows.length} / {total}
          </span>
        )}
      </div>

      <ul>
        {rows.slice(0, 8).map((row, i) => {
          const id = row.$id ?? row.id;
          const href = id ? `${basePath}/${id}` : basePath;
          const title = getTitle(row);

          return (
            <li
              className="flex items-center gap-2 border-b px-3.5 py-2.5 last:border-0"
              key={id ?? i}
              style={{ borderColor: STUDIO.rule }}
            >
              <div className="min-w-0 flex-1">
                <p
                  className="truncate text-[13px]"
                  style={{ color: STUDIO.ink }}
                >
                  {title}
                </p>
                {row.status && (
                  <p
                    className="text-[10px] uppercase tracking-wide"
                    style={{ color: STUDIO.ink4, fontFamily: MONO_STACK }}
                  >
                    {row.status}
                  </p>
                )}
              </div>
              {id && (
                <Link href={href} style={{ color: STUDIO.sky }} title="Open">
                  <ExternalLink size={12} />
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
