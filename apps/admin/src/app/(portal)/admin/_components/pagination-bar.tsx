"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

export const PAGE_SIZE = 20;

type PaginationBarProps = {
  total: number;
  page: number;
};

export function PaginationBar({ total, page }: PaginationBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const goToPage = useCallback(
    (p: number) => {
      const params = new URLSearchParams(searchParams.toString());
      if (p <= 1) {
        params.delete("page");
      } else {
        params.set("page", String(p));
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  if (totalPages <= 1) {
    return null;
  }

  // Build page number list with ellipsis
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
      className="mt-6 flex items-center justify-between pt-4"
      style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
    >
      <p className="text-xs" style={{ color: "rgba(255,255,255,0.30)" }}>
        {total} total · page {page} of {totalPages}
      </p>

      <div className="flex items-center gap-1">
        <button
          aria-label="Previous page"
          className={btnBase}
          disabled={page <= 1}
          onClick={() => goToPage(page - 1)}
          style={{
            background: "rgba(255,255,255,0.04)",
            color:
              page <= 1 ? "rgba(255,255,255,0.20)" : "rgba(255,255,255,0.60)",
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
              style={{ color: "rgba(255,255,255,0.25)" }}
            >
              …
            </span>
          ) : (
            <button
              className={btnBase}
              key={p}
              onClick={() => goToPage(p as number)}
              style={
                p === page
                  ? { background: "#3DA9E0", color: "#001731" }
                  : {
                      background: "rgba(255,255,255,0.04)",
                      color: "rgba(255,255,255,0.60)",
                    }
              }
              type="button"
            >
              {p}
            </button>
          )
        )}

        <button
          aria-label="Next page"
          className={btnBase}
          disabled={page >= totalPages}
          onClick={() => goToPage(page + 1)}
          style={{
            background: "rgba(255,255,255,0.04)",
            color:
              page >= totalPages
                ? "rgba(255,255,255,0.20)"
                : "rgba(255,255,255,0.60)",
            cursor: page >= totalPages ? "not-allowed" : "pointer",
          }}
          type="button"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
