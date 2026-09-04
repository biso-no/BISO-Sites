"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type ParamValue = string | number | null | undefined;

interface SetParamsOptions {
  /** Leave the page param untouched — for a change that does not renarrow. */
  keepPage?: boolean;
  /**
   * Page param to reset. Defaults to `page`. A route rendering two independent
   * tables pages the second one by another key (the shop studio's orders tab
   * uses `opage`); clearing the hardcoded `page` there would leave the real
   * page param stale, so a filter change would land the user on page 7 of a
   * freshly narrowed result set — usually an empty table.
   */
  pageKey?: string;
}

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
   * Any filter change resets pagination (`opts.pageKey`, default `page`)
   * unless `keepPage` is set.
   */
  const setParams = useCallback(
    (updates: Record<string, ParamValue>, opts?: SetParamsOptions) => {
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
        params.delete(opts?.pageKey ?? "page");
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
 * A URL change this hook did not cause — a browser Back/Forward, or a link —
 * wins over the local draft. Without that, `current` and `value` disagree after
 * a Back, the debounce reads the disagreement as fresh typing, and 300ms later
 * it writes the stale term back and silently undoes the navigation. `pushed`
 * tracks what this hook last wrote so the two cases can be told apart.
 */
export function useUrlSearch(
  key = "q",
  delay = 300,
  opts?: { pageKey?: string }
) {
  const { get, setParams } = useListParams();
  const current = get(key);
  const [value, setValue] = useState(current);
  const pageKey = opts?.pageKey;
  // The last term this hook wrote to the URL. Anything else showing up in
  // `current` arrived from outside and must be adopted, not overwritten.
  const pushed = useRef(current);

  useEffect(() => {
    if (current === pushed.current) {
      return;
    }
    pushed.current = current;
    setValue(current);
  }, [current]);

  useEffect(() => {
    if (value === current) {
      return;
    }
    const timer = setTimeout(() => {
      pushed.current = value;
      setParams({ [key]: value }, { pageKey });
    }, delay);
    return () => clearTimeout(timer);
  }, [value, current, key, delay, pageKey, setParams]);

  return [value, setValue] as const;
}
