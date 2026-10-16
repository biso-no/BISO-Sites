"use client";

import { Tabs, TabsList, TabsTrigger } from "@repo/ui/components/ui/tabs";
import type { LucideIcon } from "lucide-react";
import {
  Gift,
  Lock,
  MapPin,
  ShieldCheck,
  Sparkles,
  User,
  Zap,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

interface TabNavigationProps {
  benefitsCount: number;
  children: React.ReactNode;
  defaultTab?: string;
  hasBIIdentity: boolean;
  isGuest?: boolean;
  isMember: boolean;
}

const TAB_IDS = [
  "home",
  "benefits",
  "campus",
  "opportunities",
  "membership",
  "profile",
] as const;

const tabs: {
  icon: LucideIcon;
  id: (typeof TAB_IDS)[number];
  memberOnly?: boolean;
  showCount?: boolean;
}[] = [
  { id: "home", icon: Sparkles },
  { id: "benefits", icon: Gift, memberOnly: true, showCount: true },
  { id: "campus", icon: MapPin },
  { id: "opportunities", icon: Zap },
  { id: "membership", icon: ShieldCheck, memberOnly: true },
  { id: "profile", icon: User },
];

const isTabId = (value: string) =>
  (TAB_IDS as readonly string[]).includes(value);

/**
 * The portal's tab bar — the same recessed bar as `/profile`'s.
 *
 * A keyboard user had no way to see which tab they were on: the trigger
 * carried no focus styling at all. An **outline**, not a ring, because a ring
 * is composed into `box-shadow` and an active trigger's own shadow slot drops
 * it. `outline-solid` is load-bearing: the shared `TabsTrigger` sets
 * `focus-visible:outline-none`, and tailwind-merge keeps both — `outline-none`
 * is a *style*, `outline-2` a *width*, so they do not collide and the style
 * wins. Without it the outline has a width and no style, and paints nothing.
 */
const triggerClass =
  "type-body-sm h-auto shrink-0 gap-2 rounded-biso-sm px-4 py-2 font-semibold text-ink-muted hover:text-ink data-[state=active]:bg-surface data-[state=active]:text-ink data-[state=active]:shadow-none focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-solid focus-visible:outline-offset-2";

export function TabNavigation({
  defaultTab = "home",
  benefitsCount,
  isMember,
  children,
}: TabNavigationProps) {
  const t = useTranslations("memberPortal.tabs");
  const [activeTab, setActiveTab] = useState(defaultTab);

  useEffect(() => {
    // Read hash from URL on mount
    const hash = window.location.hash.slice(1);
    if (hash && isTabId(hash)) {
      setActiveTab(hash);
    }

    // Listen for hash changes
    const handleHashChange = () => {
      const newHash = window.location.hash.slice(1);
      if (newHash && isTabId(newHash)) {
        setActiveTab(newHash);
      } else if (!newHash) {
        setActiveTab(defaultTab);
      }
    };

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, [defaultTab]);

  const handleTabChange = (tab: string) => {
    window.location.hash = tab;
    setActiveTab(tab);
  };

  return (
    <Tabs className="w-full" onValueChange={handleTabChange} value={activeTab}>
      {/* Six labelled tabs do not fit a phone, so the bar scrolls inside
          itself rather than widening the page. `relative` is load-bearing:
          the `sr-only` "locked" labels are absolutely positioned, and a
          scroll box clips them only if it is their containing block —
          without it they sat 200px past a 375px viewport and widened the
          whole page. */}
      <div className="relative mb-8 overflow-x-auto">
        <TabsList className="h-auto w-full min-w-max justify-start gap-1 rounded-biso-md border border-edge bg-surface-sunken p-1 text-ink-muted">
          {tabs.map((tab) => (
            <TabsTrigger className={triggerClass} key={tab.id} value={tab.id}>
              <tab.icon aria-hidden="true" className="size-4 shrink-0" />
              <span>{t(tab.id)}</span>

              {tab.showCount && isMember ? (
                <span className="type-data rounded-biso-pill border border-edge px-1.5 text-ink-muted text-xs">
                  {benefitsCount}
                </span>
              ) : null}

              {/* Members-only tabs say so in words as well as with the
                  padlock, so the lock is not colour- or icon-only meaning. */}
              {tab.memberOnly && !isMember ? (
                <>
                  <Lock aria-hidden="true" className="size-3.5 shrink-0" />
                  <span className="sr-only">{t("locked")}</span>
                </>
              ) : null}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {children}
    </Tabs>
  );
}
