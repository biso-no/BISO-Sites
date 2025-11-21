"use client";

import { Tabs, TabsList, TabsTrigger } from "@repo/ui/components/ui/tabs";
import { Gift, Settings, Shield, Sparkles, User } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

type TabNavigationProps = {
  defaultTab?: string;
  benefitsCount: number;
  isMember: boolean;
  hasBIIdentity: boolean;
  children: React.ReactNode;
};

export function TabNavigation({
  defaultTab = "overview",
  benefitsCount,
  isMember,
  hasBIIdentity,
  children,
}: TabNavigationProps) {
  const t = useTranslations("memberPortal.tabs");
  const [activeTab, setActiveTab] = useState(defaultTab);

  useEffect(() => {
    // Read hash from URL on mount
    const hash = window.location.hash.slice(1);
    if (
      hash &&
      ["overview", "profile", "membership", "benefits", "settings"].includes(
        hash
      )
    ) {
      setActiveTab(hash);
    }

    // Listen for hash changes
    const handleHashChange = () => {
      const newHash = window.location.hash.slice(1);
      if (
        newHash &&
        ["overview", "profile", "membership", "benefits", "settings"].includes(
          newHash
        )
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
      <TabsList className="mb-8 w-full justify-start overflow-x-auto">
        <TabsTrigger className="flex items-center gap-2" value="overview">
          <Sparkles className="h-4 w-4" />
          {t("overview")}
        </TabsTrigger>
        <TabsTrigger className="flex items-center gap-2" value="profile">
          <User className="h-4 w-4" />
          {t("profile")}
        </TabsTrigger>
        <TabsTrigger
          className="relative flex items-center gap-2"
          value="membership"
        >
          <Shield className="h-4 w-4" />
          {t("membership")}
          {!isMember && <span className="ml-1 text-xs">🔒</span>}
        </TabsTrigger>
        <TabsTrigger
          className="relative flex items-center gap-2"
          value="benefits"
        >
          <Gift className="h-4 w-4" />
          {t("benefits")} ({isMember ? benefitsCount : "•••"})
          {!isMember && <span className="ml-1 text-xs">🔒</span>}
        </TabsTrigger>
        <TabsTrigger className="flex items-center gap-2" value="settings">
          <Settings className="h-4 w-4" />
          {t("settings")}
        </TabsTrigger>
      </TabsList>
      {children}
    </Tabs>
  );
}
