"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { OVERFLOW_TRIGGER_KEY } from "./nav-config";

/**
 * Sub-pixel rounding means a set of items that measures as *exactly* filling
 * the row can still spill by a fraction of a pixel. Keep a couple of pixels
 * free so the last item we decide to keep really does fit.
 */
const SAFETY_MARGIN_PX = 4;

const EMPTY_KEYS: readonly string[] = [];

/** `useLayoutEffect` warns when it runs during SSR; the nav is server-rendered. */
const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

function sameKeys(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((key, index) => key === b[index]);
}

interface FixedTotals {
  count: number;
  width: number;
}

/**
 * Items that never collapse are always mounted, so the row is their own source
 * of truth — including any width the current campus, locale or auth state gives
 * them.
 */
function measureFixed(row: HTMLElement, collapsible: Set<string>): FixedTotals {
  let width = 0;
  let count = 0;
  for (const el of row.querySelectorAll<HTMLElement>("[data-nav-key]")) {
    const key = el.dataset.navKey ?? "";
    if (key === OVERFLOW_TRIGGER_KEY || collapsible.has(key)) {
      continue;
    }
    width += el.getBoundingClientRect().width;
    count += 1;
  }
  return { count, width };
}

function measureWidths(root: HTMLElement): Map<string, number> {
  const widths = new Map<string, number>();
  for (const el of root.querySelectorAll<HTMLElement>("[data-nav-key]")) {
    widths.set(el.dataset.navKey ?? "", el.getBoundingClientRect().width);
  }
  return widths;
}

interface DecideHiddenInput {
  available: number;
  dropOrder: readonly string[];
  fixed: FixedTotals;
  gap: number;
  ghostWidths: Map<string, number>;
}

/**
 * Adds collapsible items back highest-priority first (the tail of `dropOrder`)
 * and stops at the first one that does not fit. Widths are positive, so once
 * one item fails every lower-priority item fails too.
 */
function decideHidden({
  available,
  dropOrder,
  fixed,
  gap,
  ghostWidths,
}: DecideHiddenInput): readonly string[] {
  const triggerWidth = ghostWidths.get(OVERFLOW_TRIGGER_KEY) ?? 0;
  const kept = new Set<string>();
  let keptWidth = 0;

  for (const key of [...dropOrder].reverse()) {
    const nextWidth = keptWidth + (ghostWidths.get(key) ?? 0);
    const stillHiding = kept.size + 1 < dropOrder.length;
    const count = fixed.count + kept.size + 1 + (stillHiding ? 1 : 0);
    const total =
      fixed.width +
      nextWidth +
      (stillHiding ? triggerWidth : 0) +
      gap * Math.max(0, count - 1);
    if (total > available) {
      break;
    }
    kept.add(key);
    keptWidth = nextWidth;
  }

  return dropOrder.filter((key) => !kept.has(key));
}

interface UseNavOverflowOptions {
  /**
   * Keys of the collapsible row items, ordered by drop priority — index 0 is
   * surrendered to the overflow menu first. Must contain only keys that are
   * actually rendered this pass (e.g. drop `memberPortal` for guests).
   */
  dropOrder: readonly string[];
  /**
   * Changes whenever the rendered item *set* or their labels change — auth
   * state, locale. The row's own width does not change when an item's label
   * does, so a width observer alone would keep serving a stale decision.
   */
  signature: string;
}

interface NavOverflowResult {
  /** Attach to the invisible copy of every collapsible item + the trigger. */
  ghostRef: React.RefObject<HTMLDivElement | null>;
  /** Keys that do not fit and belong in the overflow menu. */
  hiddenKeys: readonly string[];
  /** Attach to the single flat flex row that holds the desktop nav items. */
  rowRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * Decides which desktop nav items fit the row and which spill into the "…"
 * menu, by measuring rather than by guessing at breakpoints.
 *
 * Why measured and not `2xl:inline`: the row's free width is
 * `viewport − logo − everything that never collapses`, and that last term moves
 * with things a media query cannot see — whether the visitor is signed in (the
 * account avatar and the member-portal button are wider than a "Log in"
 * button), whether they are already a member (no "Become a member" CTA), which
 * locale they read (Norwegian labels are longer), and which campus they picked
 * ("Bergen" vs "Trondheim"). Hand-tuned breakpoints were wrong for at least one
 * of those combinations, and the row silently overlapped the utility cluster
 * instead of degrading.
 *
 * Measurement works off a hidden, inert copy of the collapsible items — the
 * "ghost" — because an item that is currently in the overflow menu is not in
 * the DOM to measure. Items that never collapse are always mounted, so they
 * measure themselves straight out of the row.
 */
export function useNavOverflow({
  dropOrder,
  signature,
}: UseNavOverflowOptions): NavOverflowResult {
  const rowRef = useRef<HTMLDivElement | null>(null);
  const ghostRef = useRef<HTMLDivElement | null>(null);
  const [hiddenKeys, setHiddenKeys] = useState<readonly string[]>(EMPTY_KEYS);

  // Read inside `measure` so the callback stays stable across renders — it is
  // a ResizeObserver handler, and re-subscribing on every render would thrash.
  const dropOrderRef = useRef(dropOrder);
  dropOrderRef.current = dropOrder;
  const hiddenRef = useRef<readonly string[]>(EMPTY_KEYS);

  const measure = useCallback(() => {
    const row = rowRef.current;
    const ghost = ghostRef.current;
    if (!(row && ghost)) {
      return;
    }

    const available = row.clientWidth - SAFETY_MARGIN_PX;
    // `display: none` below the desktop breakpoint, or measured before first
    // paint. Either way there is nothing to decide yet — keep the previous
    // answer rather than collapsing the entire row into the overflow menu.
    if (available <= 0) {
      return;
    }

    const collapsible = new Set(dropOrderRef.current);
    const hidden = decideHidden({
      available,
      dropOrder: dropOrderRef.current,
      fixed: measureFixed(row, collapsible),
      gap: Number.parseFloat(getComputedStyle(row).columnGap) || 0,
      ghostWidths: measureWidths(ghost),
    });

    if (!sameKeys(hidden, hiddenRef.current)) {
      hiddenRef.current = hidden;
      setHiddenKeys(hidden);
    }
  }, []);

  // Re-measure when the item set or their labels change. Runs before paint so
  // an overflowing row is never shown, not even for a frame.
  useIsomorphicLayoutEffect(() => {
    measure();
  }, [measure, signature]);

  useEffect(() => {
    const row = rowRef.current;
    const ghost = ghostRef.current;
    if (!(row && ghost)) {
      return;
    }

    let frame = 0;
    // Deferring to the next frame keeps the observer from re-entering its own
    // callback ("ResizeObserver loop completed with undelivered notifications")
    // when a measurement changes what the row renders.
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };

    const resizeObserver = new ResizeObserver(schedule);
    resizeObserver.observe(row);

    // Every measured element is observed, in both the row and the ghost, and
    // not just the row itself. An item can change width without the row doing
    // so — a web font finishing loading, next-intl swapping the labels, or the
    // visitor picking a campus whose name is longer than the last one — and
    // each of those changes the answer. Re-observing an element already under
    // observation is a no-op, so this is safe to repeat.
    const observeItems = () => {
      for (const root of [row, ghost]) {
        for (const el of root.querySelectorAll<HTMLElement>("[data-nav-key]")) {
          resizeObserver.observe(el);
        }
      }
    };
    observeItems();

    // Items come and go — with the viewport, and with the visitor (the
    // member-portal entry only exists once signed in) — so pick new ones up as
    // they mount instead of measuring against the set that existed at
    // subscription time. `measure` is idempotent, so the re-measure this
    // triggers after its own DOM change settles on the second pass.
    const mutationObserver = new MutationObserver(() => {
      observeItems();
      schedule();
    });
    for (const root of [row, ghost]) {
      mutationObserver.observe(root, {
        characterData: true,
        childList: true,
        subtree: true,
      });
    }

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [measure]);

  return { ghostRef, hiddenKeys, rowRef };
}
