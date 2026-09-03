"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type ParamValue = string | number | null | undefined;

export function useListParams() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const get = useCallback(
    (key: string, fallback = "") => searchParams.get(key) ?? fallback,
    [searchParams]
  );

  /**
   * Writes params into the address bar. Empty / nullish values are deleted so a
   * clean list stays at `/news` rather than `/news?page=1&q=&size=25`.
   * Any filter change resets pagination unless `keepPage` is set.
   */
  const setParams = useCallback(
    (updates: Record<string, ParamValue>, opts?: { keepPage?: boolean }) => {
      const params = new URLSearchParams(searchParams.toString());

      for (const [key, value] of Object.entries(updates)) {
        const next = value === null || value === undefined ? "" : String(value);
        if (next === "") {
          params.delete(key);
        } else {
          params.set(key, next);
        }
      }

      if (!opts?.keepPage) {
        params.delete("page");
      }

      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  return { get, setParams };
}

/**
 * Debounced search box state bound to a URL param.
 *
 * The effect is guarded on `value !== current` rather than a first-render ref:
 * `setParams` is rebuilt whenever `useSearchParams()` changes identity, so an
 * unguarded effect would re-run on its own push and loop forever.
 *
 * Known limitation: the input is seeded from the URL on mount and is not
 * re-synced afterwards, so a browser Back that changes `q` updates the results
 * but leaves the text in the box. Re-syncing fights the debounce; the results
 * are the source of truth.
 */
export function useUrlSearch(key = "q", delay = 300) {
  const { get, setParams } = useListParams();
  const current = get(key);
  const [value, setValue] = useState(current);

  useEffect(() => {
    if (value === current) {
      return;
    }
    const timer = setTimeout(() => setParams({ [key]: value }), delay);
    return () => clearTimeout(timer);
  }, [value, current, key, delay, setParams]);

  return [value, setValue] as const;
}
