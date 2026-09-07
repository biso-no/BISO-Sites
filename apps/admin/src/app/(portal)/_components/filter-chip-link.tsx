"use client";

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { useListParams } from "./use-list-params";

interface FilterChipLinkProps {
  active?: boolean;
  children: ReactNode;
  className?: string;
  /** Where the chip points, built from the committed query string. */
  href: string;
  /** What the chip writes, merged with any push still in flight. */
  params: Record<string, string | number | null | undefined>;
  style?: CSSProperties;
}

/**
 * A filter chip that stays a real link.
 *
 * `href` keeps middle-click, modified clicks and "copy link address" working,
 * and is exactly what a server-rendered chip produces. A plain left click goes
 * through `useListParams` instead, because the href can only be built from the
 * COMMITTED query string: if a debounced search push has not landed yet,
 * following that href navigates back to the pre-search URL and silently throws
 * away what the user just typed.
 */
export function FilterChipLink({
  active,
  children,
  className,
  href,
  params,
  style,
}: FilterChipLinkProps) {
  const { setParams } = useListParams();

  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={className}
      href={href}
      onClick={(event) => {
        // A modified or non-primary click belongs to the browser — it is how
        // people open a filter in a new tab.
        if (
          event.defaultPrevented ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey ||
          event.button
        ) {
          return;
        }
        event.preventDefault();
        setParams(params);
      }}
      style={style}
    >
      {children}
    </Link>
  );
}
