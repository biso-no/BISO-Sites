"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { STUDIO } from "../../_components/studio";

interface InboxTabsProps {
  approvals: number;
  submissions: number;
}

export function InboxTabs({ approvals, submissions }: InboxTabsProps) {
  const pathname = usePathname();
  const t = useTranslations("adminPortal.nav");
  const tabs = [
    { count: approvals, href: "/inbox/approvals", label: t("approvals") },
    { count: submissions, href: "/inbox/submissions", label: t("submissions") },
  ];

  return (
    <div
      className="mb-6 flex items-center gap-1 border-b"
      style={{ borderColor: STUDIO.rule }}
    >
      {tabs.map((tab) => {
        const active = pathname.startsWith(tab.href);
        return (
          <Link
            className="-mb-px flex items-center gap-2 border-b-2 px-3 py-2 text-[13px] transition"
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
            {tab.label}
            {tab.count > 0 && (
              <span
                className="rounded-full px-1.5 py-0.5 font-mono text-[10px] leading-none"
                style={{ background: STUDIO.claret, color: STUDIO.paper }}
              >
                {tab.count}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
