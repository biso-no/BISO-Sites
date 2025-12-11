"use client";

import type { Locale } from "@repo/i18n/config";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@repo/ui/components/ui/tabs";
import { Briefcase, GraduationCap, Target, Users } from "lucide-react";
import { useEffect, useState } from "react";

type CampusTabsProps = {
  locale: Locale;
  content: {
    overview: React.ReactNode;
    students: React.ReactNode;
    partners: React.ReactNode;
    team: React.ReactNode;
  };
};

export function CampusTabs({ locale, content }: CampusTabsProps) {
  const [activeTab, setActiveTab] = useState("overview");

  // Sync with URL hash on mount and hash change
  useEffect(() => {
    const updateTabFromHash = () => {
      const hash = window.location.hash.slice(1);
      const validTabs = ["overview", "students", "partners", "team"];
      if (hash && validTabs.includes(hash)) {
        setActiveTab(hash);
      } else {
        setActiveTab("overview");
      }
    };

    // Set initial tab from hash
    updateTabFromHash();

    // Listen for hash changes
    window.addEventListener("hashchange", updateTabFromHash);
    return () => window.removeEventListener("hashchange", updateTabFromHash);
  }, []);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    window.location.hash = tab;
  };

  const tabs = [
    {
      value: "overview",
      label: locale === "en" ? "Overview" : "Oversikt",
      icon: Target,
    },
    {
      value: "students",
      label: locale === "en" ? "For Students" : "For studenter",
      icon: GraduationCap,
    },
    {
      value: "partners",
      label: locale === "en" ? "For Businesses" : "For bedrifter",
      icon: Briefcase,
    },
    {
      value: "team",
      label: locale === "en" ? "Management" : "Ledelsen",
      icon: Users,
    },
  ];

  return (
    <>
      {/* Sticky Tab Navigation */}
      <div className="sticky top-0 z-40 border-border border-b bg-background shadow-sm">
        <div className="mx-auto max-w-7xl px-4">
          <Tabs onValueChange={handleTabChange} value={activeTab}>
            <TabsList className="grid h-auto w-full grid-cols-4 justify-start rounded-none border-0 bg-transparent p-0">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <TabsTrigger
                    className="rounded-none px-6 py-5 font-medium text-base text-muted-foreground transition-colors hover:text-brand data-[state=active]:border-brand data-[state=active]:border-b-2 data-[state=active]:bg-transparent data-[state=active]:text-brand"
                    key={tab.value}
                    value={tab.value}
                  >
                    <Icon className="mr-2 h-5 w-5" />
                    {tab.label}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Tab Content */}
      <Tabs onValueChange={handleTabChange} value={activeTab}>
        <TabsContent value="overview">{content.overview}</TabsContent>

        <TabsContent value="students">{content.students}</TabsContent>

        <TabsContent value="partners">{content.partners}</TabsContent>

        <TabsContent value="team">{content.team}</TabsContent>
      </Tabs>
    </>
  );
}
