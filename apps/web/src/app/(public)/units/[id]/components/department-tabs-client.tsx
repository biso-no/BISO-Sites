"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/components/ui/tabs";
import { Newspaper, ShoppingBag, Target, Users } from "lucide-react";
import { useState } from "react";
import type { DepartmentTranslation } from "@/lib/actions/departments";
import { NewsTab } from "./news-tab";
import { OverviewTab } from "./overview-tab";
import { ProductsTab } from "./products-tab";
import { TeamTab } from "./team-tab";

interface DepartmentTabsClientProps {
  department: DepartmentTranslation;
  isMember: boolean;
}

export function DepartmentTabsClient({ department, isMember }: DepartmentTabsClientProps) {
  const [activeTab, setActiveTab] = useState("overview");

  const tabs = [
    { value: "overview", label: "Overview", icon: Target },
    { value: "team", label: "Our Team", icon: Users },
    { value: "news", label: "News & Updates", icon: Newspaper },
    { value: "products", label: "Products & Tickets", icon: ShoppingBag },
  ];

  return (
    <>
      {/* Sticky Tab Navigation */}
      <div className="sticky top-0 z-40 bg-background border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
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
      <div className="max-w-7xl mx-auto px-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsContent value="overview" className="py-12">
            <OverviewTab department={department} />
          </TabsContent>

          <TabsContent value="team" className="py-12">
            <TeamTab department={department} />
          </TabsContent>

          <TabsContent value="news" className="py-12">
            <NewsTab news={department.news || []} />
          </TabsContent>

          <TabsContent value="products" className="py-12">
            <ProductsTab products={department.products || []} isMember={isMember} />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
