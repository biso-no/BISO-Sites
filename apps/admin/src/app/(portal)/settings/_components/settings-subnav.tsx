"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { STUDIO } from "../../_components/studio";

const TABS = [
  { exact: true, href: "/settings", labelKey: "general" },
  { exact: false, href: "/settings/operations", labelKey: "operations" },
  { exact: false, href: "/settings/feature-flags", labelKey: "featureFlags" },
  { exact: false, href: "/settings/payments", labelKey: "payments" },
] as const;

export function SettingsSubnav() {
  const pathname = usePathname();
  const t = useTranslations("adminPortal.nav");

  return (
    <div
      className="mb-6 flex items-center gap-1 border-b"
      style={{ borderColor: STUDIO.rule }}
    >
      {TABS.map((tab) => {
        const active = tab.exact
          ? pathname === tab.href
          : pathname.startsWith(tab.href);
        return (
          <Link
            className="-mb-px border-b-2 px-3 py-2 text-[13px] transition"
            href={tab.href}
            key={tab.href}
            style={
              active
                ? {
                    borderColor: STUDIO.ink,
                    color: STUDIO.ink,
                    fontWeight: 600,
                  }
                : { borderColor: "transparent", color: STUDIO.ink3 }
            }
          >
            {t(tab.labelKey)}
          </Link>
        );
      })}
    </div>
  );
}
