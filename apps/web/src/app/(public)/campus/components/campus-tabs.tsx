"use client";

import { useEffect, useState } from "react";
import { Target, GraduationCap, Briefcase, Users } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/components/ui/tabs";
import type { Locale } from "@/i18n/config";

interface CampusTabsProps {
  locale: Locale;
  children: {
    overview: React.ReactNode;
    students: React.ReactNode;
    partners: React.ReactNode;
    team: React.ReactNode;
  };
}

export function CampusTabs({ locale, children }: CampusTabsProps) {
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
      label: locale === "en" ? "For Partners" : "For partnere",
      icon: Briefcase,
    },
    {
      value: "team",
      label: locale === "en" ? "Our Team" : "Vårt team",
      icon: Users,
    },
  ];

  return (
    <>
      {/* Sticky Tab Navigation */}
      <div className="sticky top-0 z-40 bg-background border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4">
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList className="w-full justify-start h-auto p-0 bg-transparent border-0 rounded-none grid grid-cols-4">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="rounded-none text-muted-foreground data-[state=active]:border-b-2 data-[state=active]:border-[#3DA9E0] data-[state=active]:text-[#3DA9E0] data-[state=active]:bg-transparent px-6 py-5 text-base font-medium transition-colors hover:text-[#3DA9E0]"
                  >
                    <Icon className="w-5 h-5 mr-2" />
                    {tab.label}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Tab Content */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsContent value="overview">
          {children.overview}
        </TabsContent>

        <TabsContent value="students">
          {children.students}
        </TabsContent>

        <TabsContent value="partners">
          {children.partners}
        </TabsContent>

        <TabsContent value="team">
          {children.team}
        </TabsContent>
      </Tabs>
    </>
  );
}
