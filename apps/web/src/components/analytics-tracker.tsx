"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

interface AnalyticsTrackerProps {
  locale: string;
}

export function AnalyticsTracker({ locale }: AnalyticsTrackerProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastPathRef = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname) return;

    const query = searchParams.toString();
    const fullPath = query ? `${pathname}?${query}` : pathname;

    if (lastPathRef.current === fullPath) {
      return;
    }

    const nextReferrer = lastPathRef.current
      ? `${window.location.origin}${lastPathRef.current}`
      : document.referrer || null;

    const body = JSON.stringify({
      path: fullPath,
      locale,
      referrer: nextReferrer,
    });

    const url = "/api/analytics/page-view";
    const blob = new Blob([body], { type: "application/json" });

    const send = () => {
      if (navigator.sendBeacon) {
        navigator.sendBeacon(url, blob);
        return;
      }
      fetch(url, {
        method: "POST",
        body,
        headers: {
          "Content-Type": "application/json",
        },
        keepalive: true,
      }).catch(() => {});
    };

    send();
    lastPathRef.current = fullPath;
  }, [pathname, searchParams, locale]);

  return null;
}
