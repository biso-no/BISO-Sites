"use client";

import { useLayoutEffect, useRef } from "react";

/**
 * The `<style>` element of a page theme. Receives finished CSS that
 * `PageThemeStyle` has already validated on the server.
 *
 * Next keeps the previous route mounted in a hidden `<Activity>`, and
 * `display:none` does not disable a `<style>`, so the sheet would keep
 * recolouring every page. The layout effect switches the sheet on while the
 * page is visible and off (`media="not all"`) when React runs its cleanup for a
 * hidden Activity. SSR still emits the element, so the first paint is themed.
 */
export function PageThemeStyleClient({ css }: { css: string }) {
  const ref = useRef<HTMLStyleElement>(null);

  useLayoutEffect(() => {
    const style = ref.current;
    if (!style) {
      return;
    }
    style.media = "all";
    return () => {
      style.media = "not all";
    };
  }, []);

  return <style ref={ref}>{css}</style>;
}
