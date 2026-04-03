import { checkNavAccess } from "@/lib/authorization";
import { redirect } from "next/navigation";
import { getBenefitAnalyticsSummary } from "@/app/actions/benefit-analytics";
import { AnalyticsDashboardClient } from "./_components/analytics-dashboard-client";

export const metadata = {
  title: "Benefits Analytics | BISO Admin",
};

export default async function BenefitAnalyticsPage() {
  const hasAccess = await checkNavAccess("benefitsAnalytics");
  if (!hasAccess) redirect("/unauthorized");

  const summary = await getBenefitAnalyticsSummary();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-bold text-2xl tracking-tight">
          Benefits Analytics
        </h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Engagement insights across the campus benefits catalog
        </p>
      </div>
      <AnalyticsDashboardClient summary={summary} />
    </div>
  );
}
