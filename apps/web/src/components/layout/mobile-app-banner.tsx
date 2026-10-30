"use client";

import { trackEvent } from "@repo/shared/utils/analytics";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import {
  APP_BANNER_DISMISSED_KEY,
  APP_STORE_URLS,
  detectMobilePlatform,
  type MobilePlatform,
} from "@/lib/app-links";
import { AppStoreBadge } from "./app-store-badge";

export function wasAppBannerDismissed(): boolean {
  try {
    return Boolean(localStorage.getItem(APP_BANNER_DISMISSED_KEY));
  } catch {
    return false;
  }
}

export function persistAppBannerDismissal(): void {
  try {
    localStorage.setItem(APP_BANNER_DISMISSED_KEY, "1");
  } catch {
    // Without storage it simply returns on the next visit.
  }
}

export function MobileAppBannerView({
  onDismiss,
  platform,
}: {
  onDismiss: () => void;
  platform: MobilePlatform;
}) {
  const t = useTranslations("common.appBanner");
  const isIos = platform === "ios";
  const hint = isIos ? t("appleHint") : t("googleHint");
  const storeName = isIos ? t("appleStore") : t("googlePlay");

  const handleStoreClick = () => {
    trackEvent("outbound_click", {
      url: APP_STORE_URLS[platform],
      label: storeName,
      surface: "app_banner",
    });
  };

  return (
    <aside
      aria-label={t("title")}
      className="fixed inset-x-3 bottom-3 z-40 mx-auto max-w-md rounded-biso-lg border border-edge bg-surface p-3.5 text-ink shadow-elev-2 sm:inset-x-4 sm:bottom-4"
      data-surface="deep"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="type-heading-card text-ink text-sm">{t("title")}</p>
          <p className="type-body-sm mt-0.5 text-ink-muted text-xs">
            {t("subtitle")}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <AppStoreBadge
            hint={hint}
            onClick={handleStoreClick}
            platform={platform}
            storeName={storeName}
          />
          <button
            aria-label={t("dismiss")}
            className="rounded-biso-sm p-1.5 text-ink-muted transition-colors hover:bg-surface-raised hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            onClick={onDismiss}
            type="button"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}

/**
 * Shown on iOS and Android devices when the visitor has not dismissed it.
 * Presents the store button matching their device (App Store on iOS/iPadOS,
 * Google Play on Android) and remembers dismissal in `localStorage`.
 */
export function MobileAppBanner() {
  const [platform, setPlatform] = useState<MobilePlatform | null>(null);

  useEffect(() => {
    if (wasAppBannerDismissed()) {
      return;
    }
    const detected = detectMobilePlatform(
      window.navigator.userAgent,
      window.navigator.maxTouchPoints
    );
    if (detected) {
      setPlatform(detected);
    }
  }, []);

  if (!platform) {
    return null;
  }

  const dismiss = () => {
    persistAppBannerDismissal();
    setPlatform(null);
  };

  return <MobileAppBannerView onDismiss={dismiss} platform={platform} />;
}
