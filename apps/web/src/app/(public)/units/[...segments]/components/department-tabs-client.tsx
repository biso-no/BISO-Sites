"use client";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@repo/ui/components/ui/tabs";
import { Newspaper, ShoppingBag, Target, Users } from "lucide-react";
import { useTranslations } from "next-intl";
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

export function DepartmentTabsClient({
  department,
  isMember,
}: DepartmentTabsClientProps) {
  const t = useTranslations("units.detail");
  const [activeTab, setActiveTab] = useState("overview");

  const tabs = [
    { value: "overview", label: t("tabs.overview"), icon: Target },
    { value: "team", label: t("tabs.team"), icon: Users },
    { value: "news", label: t("tabs.news"), icon: Newspaper },
    { value: "products", label: t("tabs.products"), icon: ShoppingBag },
  ];

  return (
    // RD-031: one `<Tabs>` root, not two. The sticky list and the panels used
    // to live in separate roots, so Radix generated their ids independently
    // and every trigger's `aria-controls` pointed at a panel that does not
    // exist — axe reported it as a critical `aria-valid-attr-value`. With one
    // root the association is real, and so is arrow-key navigation between
    // tabs.
    <Tabs onValueChange={setActiveTab} value={activeTab}>
      {/* Sticky tab navigation */}
      <div className="sticky top-0 z-40 border-border border-b bg-background shadow-sm">
        <div className="mx-auto max-w-7xl px-4">
          {/* `grid-cols-4` with `whitespace-nowrap` triggers pushed this page
              23px past a 320px viewport — "News & Updates" is 103px on one
              line inside a 72px track. Two columns below `sm`, labels wrap;
              from `sm` up it is the same four-across row. */}
          <TabsList className="grid h-auto w-full grid-cols-2 justify-start rounded-none border-0 bg-transparent p-0 sm:grid-cols-4">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger
                  className="min-w-0 whitespace-normal rounded-none px-3 py-4 text-center font-medium text-base text-muted-foreground transition-colors hover:text-brand data-[state=active]:border-brand data-[state=active]:border-b-2 data-[state=active]:bg-transparent data-[state=active]:text-brand sm:whitespace-nowrap sm:px-6 sm:py-5"
                  key={tab.value}
                  value={tab.value}
                >
                  <Icon aria-hidden="true" className="mr-2 size-5 shrink-0" />
                  {tab.label}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4">
        <TabsContent className="py-12" value="overview">
          <OverviewTab department={department} />
        </TabsContent>

        <TabsContent className="py-12" value="team">
          <TeamTab department={department} />
        </TabsContent>

        <TabsContent className="py-12" value="news">
          <NewsTab news={department.news || []} />
        </TabsContent>

        <TabsContent className="py-12" value="products">
          <ProductsTab
            isMember={isMember}
            products={department.products || []}
          />
        </TabsContent>
      </div>
    </Tabs>
  );
}
