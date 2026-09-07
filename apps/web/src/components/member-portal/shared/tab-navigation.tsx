"use client";

import { Badge } from "@repo/ui/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@repo/ui/components/ui/tabs";
import { Gift, Shield, Sparkles, User, Zap } from "lucide-react";
import { motion } from "motion/react";
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

const tabs = [
  { id: "home", icon: Sparkles },
  { id: "benefits", icon: Gift, memberOnly: true, showCount: true },
  { id: "campus", icon: Shield },
  { id: "opportunities", icon: Zap },
  { id: "membership", icon: Shield, memberOnly: true },
  { id: "profile", icon: User },
];

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
    if (
      hash &&
      [
        "home",
        "benefits",
        "campus",
        "opportunities",
        "membership",
        "profile",
      ].includes(hash)
    ) {
      setActiveTab(hash);
    }

    // Listen for hash changes
    const handleHashChange = () => {
      const newHash = window.location.hash.slice(1);
      if (
        newHash &&
        [
          "home",
          "benefits",
          "campus",
          "opportunities",
          "membership",
          "profile",
        ].includes(newHash)
      ) {
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
      <div className="mb-8 overflow-x-auto">
        <TabsList className="inline-flex h-auto w-full min-w-max gap-2 rounded-2xl bg-section p-2 sm:w-auto dark:bg-inverted">
          {tabs.map((tab) => (
            <TabsTrigger
              // A keyboard user had no way to see which tab they were on: the
              // trigger carried no focus styling at all. An **outline**, not a
              // ring — the active trigger sets `data-[state=active]:shadow-lg`,
              // and the winning `box-shadow` declaration drops the ring layer,
              // so `--tw-ring-shadow` computes correctly and paints nothing.
              // Measured before changing it: ring colour `#3aa3e1`, ring shadow
              // `0 0 0 4px #3aa3e1`, and a `box-shadow` carrying neither.
              // `outline-solid` is load-bearing: the shared `TabsTrigger` sets
              // `focus-visible:outline-none`, and tailwind-merge keeps both —
              // `outline-none` is a *style*, `outline-2` a *width*, so they do
              // not collide and the style wins. Without it the outline has a
              // width and no style, and paints nothing.
              className="relative flex items-center gap-2 rounded-xl px-4 py-2.5 font-medium text-muted-foreground transition-all duration-300 hover:text-foreground focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-solid focus-visible:outline-offset-2 data-[state=active]:bg-linear-to-r data-[state=active]:from-brand-gradient-from data-[state=active]:to-brand-gradient-to data-[state=active]:text-white data-[state=active]:shadow-lg dark:data-[state=active]:shadow-brand/30"
              key={tab.id}
              value={tab.id}
            >
              <motion.div
                animate={{ scale: activeTab === tab.id ? 1.1 : 1 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <tab.icon className="h-4 w-4" />
              </motion.div>
              <span className="hidden sm:inline">{t(tab.id)}</span>

              {/* Benefits count badge */}
              {tab.showCount && (
                <Badge
                  className={`ml-1 h-5 min-w-5 rounded-full px-1.5 text-xs ${
                    activeTab === tab.id
                      ? "border-white/30 bg-white/20 text-white"
                      : "border-brand-border bg-brand-muted text-brand dark:border-brand-border-strong"
                  }`}
                  variant="outline"
                >
                  {isMember ? benefitsCount : "?"}
                </Badge>
              )}

              {/* Lock indicator for non-members */}
              {tab.memberOnly && !isMember && (
                <span className="ml-0.5 text-xs opacity-80">🔒</span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {children}
    </Tabs>
  );
}
