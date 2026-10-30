import { cn } from "@repo/ui/lib/utils";
import { APP_STORE_URLS, type MobilePlatform } from "@/lib/app-links";

export interface AppStoreBadgeProps {
  className?: string;
  hint: string;
  onClick?: () => void;
  platform: MobilePlatform;
  storeName: string;
}

/**
 * Store download button styled for either the Apple App Store or Google Play.
 * Kept free of `"use client"` so `FooterV2` (a Server Component) and
 * `MobileAppBanner` (a Client Component) can share the same markup.
 */
export function AppStoreBadge({
  className,
  hint,
  onClick,
  platform,
  storeName,
}: AppStoreBadgeProps) {
  const href = APP_STORE_URLS[platform];

  return (
    <a
      aria-label={`${hint} ${storeName}`}
      className={cn(
        "inline-flex shrink-0 items-center gap-2.5 rounded-biso-md border border-edge bg-surface-raised px-3.5 py-2 text-left text-ink transition-colors hover:border-ink-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
        className
      )}
      data-store-platform={platform}
      data-surface="deep"
      href={href}
      onClick={onClick}
      rel="noopener noreferrer"
      target="_blank"
    >
      {platform === "ios" ? <AppleIcon /> : <GooglePlayIcon />}
      <span className="leading-none">
        <span className="block font-medium text-[10px] text-ink-muted leading-none tracking-wide">
          {hint}
        </span>
        <span className="mt-0.5 block font-bold text-ink text-sm leading-tight">
          {storeName}
        </span>
      </span>
    </a>
  );
}

function AppleIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-5 shrink-0 text-ink"
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.96 6.33c.67-.81 1.12-1.94 1-3.08-.96.04-2.13.64-2.82 1.45-.61.7-.15 1.85-1.03 2.97 1.08.08 2.18-.53 2.85-1.34" />
    </svg>
  );
}

function GooglePlayIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-5 shrink-0"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M3.61 1.814L13.793 12 3.61 22.186a1.75 1.75 0 0 1-.61-1.33V3.144c0-.523.226-1.004.61-1.33Z"
        fill="#4285F4"
      />
      <path
        d="M17.185 8.608 13.793 12l3.392 3.392 3.83-2.188c.64-.366.64-1.292 0-1.658l-3.83-2.938Z"
        fill="#FBBC05"
      />
      <path
        d="M17.185 15.392 13.793 12 3.61 22.186c.455.383 1.116.458 1.693.128l11.882-6.922Z"
        fill="#EA4335"
      />
      <path
        d="M3.61 1.814 15.492 8.736l1.693.872L13.793 12 3.61 1.814Z"
        fill="#34A853"
      />
    </svg>
  );
}
