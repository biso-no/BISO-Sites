"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

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

/** A query string pushed but not yet committed, plus the route it belongs to. */
type PendingWrite = { path: string; query: string } | null;

const PendingWriteContext = createContext<{
  current: PendingWrite;
} | null>(null);

/**
 * Shares the not-yet-committed query string between every `useListParams()`
 * instance beneath it.
 *
 * One screen holds several: the shop studio has one for its filter controls
 * and one per search box. A per-instance ref merged a hook's writes only with
 * its own, so changing a filter and then letting the debounced search fire
 * dropped the filter. A module-level global would share it too, but it would
 * also outlive the tree — the App Router keeps a layout mounted across route
 * changes — so the store is scoped to a provider instead.
 */
export function ListParamsProvider({ children }: { children: ReactNode }) {
  const pending = useRef<PendingWrite>(null);
  return (
    <PendingWriteContext.Provider value={pending}>
      {children}
    </PendingWriteContext.Provider>
  );
}

export function useListParams() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const committed = searchParams.toString();
  // The query string this hook last pushed, kept until the navigation it
  // started actually commits. `useSearchParams` reports the pre-navigation
  // value for that whole window, so without this a second filter change would
  // clone the stale snapshot and silently drop the first — easy to hit on the
  // orders tab, which has several independent controls plus a debounced search
  // box while its queries are still loading.
  const lastCommitted = useRef(committed);
  // Without a provider the hook still works, just without cross-instance
  // merging — a lone list surface has nothing to merge with.
  const ownPending = useRef<PendingWrite>(null);
  const pending = useContext(PendingWriteContext) ?? ownPending;
  // Any committed change supersedes the optimistic copy — our own push landing,
  // or an external navigation such as Back, which must not be merged into.
  // Whichever instance renders first clears it; the rest are no-ops.
  if (lastCommitted.current !== committed) {
    lastCommitted.current = committed;
    pending.current = null;
  }

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
      const base =
        pending.current?.path === pathname ? pending.current.query : committed;
      const params = new URLSearchParams(base);

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
      pending.current = { path: pathname, query: qs };
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, committed, pending]
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
