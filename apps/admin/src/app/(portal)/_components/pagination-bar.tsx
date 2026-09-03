"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback } from "react";
import {
  DEFAULT_PAGE_SIZE,
  lastReachablePage,
  PAGE_SIZES,
} from "@/lib/list-params";
import { STUDIO } from "./studio";

interface PaginationBarProps {
  page: number;
  /** Alternate page key for a route rendering two independent tables. */
  pageKey?: string;
  /**
   * Real page size the surface is paging by. `PageSize` (25|50|100) can't
   * express legacy surfaces still paging by 20, so this accepts any number —
   * the size picker only renders when `sizeSelectable` is true.
   */
  size?: number;
  /**
   * Alternate size key, for the same reason as `pageKey`: two tables on one
   * route must not fight over a single `?size=`.
   */
  sizeKey?: string;
  /**
   * Whether the surface's server action actually reads `?size=` and honours
   * it. This must be explicit, not inferred from `size`'s value — a legacy
   * surface can coincidentally page by a number that's also in `PAGE_SIZES`
   * (e.g. Documents pages by 25) while its action still ignores the query
   * param, which would render a picker that changes the URL but not the
   * results. Defaults to `false`; opt in per surface once its action wires
   * up `?size=`.
   */
  sizeSelectable?: boolean;
  total: number;
}

export function PaginationBar({
  total,
  page,
  size = DEFAULT_PAGE_SIZE,
  pageKey = "page",
  sizeKey = "size",
  sizeSelectable = false,
}: PaginationBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations("adminPortal.common.pagination");
  // Bounded by MAX_OFFSET as well as by the row count (see
  // `lastReachablePage`): Appwrite rejects an offset past that regardless of
  // how many rows would otherwise remain, so a page beyond it must never be
  // offered as a clickable link.
  const totalPages = lastReachablePage(total, size);

  const push = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  const goToPage = useCallback(
    (p: number) => {
      push((params) => {
        if (p <= 1) {
          params.delete(pageKey);
        } else {
          params.set(pageKey, String(p));
        }
      });
    },
    [push, pageKey]
  );

  const changeSize = useCallback(
    (next: number) => {
      push((params) => {
        if (next === DEFAULT_PAGE_SIZE) {
          params.delete(sizeKey);
        } else {
          params.set(sizeKey, String(next));
        }
        // A new page size invalidates the current offset.
        params.delete(pageKey);
      });
    },
    [push, pageKey, sizeKey]
  );

  // Nothing to show for a genuinely empty list — the surface renders its own
  // EmptyState. A single page still renders: the size picker and total matter.
  if (total === 0) {
    return null;
  }

  // A single page with no size picker has nothing to offer — rendering a
  // "3 total · page 1 of 1" line plus a rule is noise on surfaces that never
  // asked for pagination UI.
  if (totalPages <= 1 && !sizeSelectable) {
    return null;
  }

  const pages: (number | "…")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) {
      pages.push(i);
    }
  } else {
    pages.push(1);
    if (page > 4) {
      pages.push("…");
    }
    const start = Math.max(2, page - 1);
    const end = Math.min(totalPages - 1, page + 1);
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    if (page < totalPages - 3) {
      pages.push("…");
    }
    pages.push(totalPages);
  }

  const btnBase =
    "flex items-center justify-center min-w-[32px] h-8 px-2 rounded-lg text-xs font-medium transition-all cursor-pointer";

  return (
    <div
      className="mt-6 flex flex-wrap items-center justify-between gap-3 pt-4"
      style={{ borderTop: `1px solid ${STUDIO.rule}` }}
    >
      <div className="flex items-center gap-3">
        <p className="text-xs" style={{ color: STUDIO.ink3 }}>
          {t("summary", { page, pages: totalPages, total })}
        </p>

        {sizeSelectable && (
          <label
            className="flex items-center gap-1.5 text-xs"
            style={{ color: STUDIO.ink3 }}
          >
            {t("perPage")}
            <select
              className="rounded-lg px-2 py-1 text-xs outline-none"
              onChange={(e) => changeSize(Number(e.target.value))}
              style={{
                background: STUDIO.white,
                border: `0.5px solid ${STUDIO.rule2}`,
                color: STUDIO.ink2,
              }}
              value={size}
            >
              {PAGE_SIZES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <button
            aria-label={t("previous")}
            className={btnBase}
            disabled={page <= 1}
            onClick={() => goToPage(page - 1)}
            style={{
              background: STUDIO.paper2,
              border: `0.5px solid ${STUDIO.rule2}`,
              color: page <= 1 ? STUDIO.ink4 : STUDIO.ink2,
              cursor: page <= 1 ? "not-allowed" : "pointer",
            }}
            type="button"
          >
            <ChevronLeft size={14} />
          </button>

          {pages.map((p, i) =>
            p === "…" ? (
              <span
                className="flex h-8 w-8 items-center justify-center text-xs"
                key={`ellipsis-${i}`}
                style={{ color: STUDIO.ink4 }}
              >
                …
              </span>
            ) : (
              <button
                aria-current={p === page ? "page" : undefined}
                className={btnBase}
                key={p}
                onClick={() => goToPage(p as number)}
                style={
                  p === page
                    ? { background: STUDIO.ink, color: STUDIO.white }
                    : {
                        background: STUDIO.paper2,
                        border: `0.5px solid ${STUDIO.rule2}`,
                        color: STUDIO.ink2,
                      }
                }
                type="button"
              >
                {p}
              </button>
            )
          )}

          <button
            aria-label={t("next")}
            className={btnBase}
            disabled={page >= totalPages}
            onClick={() => goToPage(page + 1)}
            style={{
              background: STUDIO.paper2,
              border: `0.5px solid ${STUDIO.rule2}`,
              color: page >= totalPages ? STUDIO.ink4 : STUDIO.ink2,
              cursor: page >= totalPages ? "not-allowed" : "pointer",
            }}
            type="button"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
