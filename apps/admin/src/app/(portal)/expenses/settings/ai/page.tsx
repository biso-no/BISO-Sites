import {
  AI_RERUN_LIMIT,
  costTypeLabel,
} from "@repo/shared/utils/expense-cost-types";
import { redirect, unstable_rethrow } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { requireNavAccess } from "@/lib/authorization";
import { ROLES } from "@/lib/roles";
import { PageHeader } from "../../../_components/page-header";
import { ExpensesSettingsTabs } from "../_components/expenses-settings-tabs";
import { AiEvalClient, type AiEvalWindow } from "./_components/ai-eval-client";
import { AI_EVAL_ROW_CAP, loadAiEvalData } from "./ai-data";
import {
  AI_EVAL_WINDOW_DAYS,
  keptStats,
  OWN_TEXT_KEY,
  RECURRING_MIN_COUNT,
  recurringOwnTexts,
} from "./ai-model";

// The re-run check is a server action that waits on the model for minutes.
export const maxDuration = 300;

export default async function ExpenseAiSettingsPage() {
  const ctx = await requireNavAccess("portal.expensesSettings");
  // Global admins only, like the Types tab.
  if (!ctx.roles.includes(ROLES.GLOBAL_ADMIN)) {
    redirect("/expenses/settings/approvers");
  }
  const [t, ta, te, locale] = await Promise.all([
    getTranslations("adminPortal.expensesSettings"),
    getTranslations("adminPortal.expensesSettings.ai"),
    getTranslations("adminPortal.expenses.errors"),
    getLocale(),
  ]);

  let data: Awaited<ReturnType<typeof loadAiEvalData>> | null = null;
  try {
    data = await loadAiEvalData();
  } catch (error) {
    // A redirect or notFound from the load must still reach Next.
    unstable_rethrow(error);
    console.error("[expense-ai] AI tab load failed:", error);
    data = null;
  }

  const tabs = (
    <ExpensesSettingsTabs
      labels={{
        ai: t("tabAi"),
        approvers: t("tabApprovers"),
        types: t("tabTypes"),
      }}
      showGlobalTabs
    />
  );

  if (!data) {
    return (
      <div className="pb-12">
        <PageHeader description={ta("description")} title={t("title")} />
        {tabs}
        <p className="text-sm">{ta("loadError")}</p>
      </div>
    );
  }

  const labelBySlug = new Map(
    data.typeLabels.map((type) => [type.slug, costTypeLabel(type, locale)])
  );
  const nameOf = (slug: string) => labelBySlug.get(slug) ?? slug;
  const now = new Date();
  const windowFor = (days: 30 | 90): AiEvalWindow => {
    const stats = keptStats(data.rows, now, days);
    return {
      kept: stats.kept,
      keptRate: stats.keptRate,
      perType: stats.perType.map((type) => ({
        correctedTo: type.correctedTo.map((entry) => ({
          count: entry.count,
          to: entry.to === OWN_TEXT_KEY ? null : nameOf(entry.to),
        })),
        kept: type.kept,
        label: nameOf(type.slug),
        slug: type.slug,
        total: type.total,
      })),
      total: stats.total,
    };
  };

  return (
    <div className="pb-12">
      <PageHeader description={ta("description")} title={t("title")} />
      {tabs}
      <AiEvalClient
        capped={data.capped}
        labels={{
          capped: ta("capped", { count: AI_EVAL_ROW_CAP }),
          changedTo: ta("changedTo"),
          keptRate: ta("keptRate"),
          makeType: ta("makeType"),
          noData: ta("noData"),
          none: ta("none"),
          overall: ta("overall"),
          overallCount: ta.raw("overallCount") as string,
          ownText: ta("ownText"),
          perTypeTitle: ta("perTypeTitle"),
          picks: ta("picks"),
          recurringEmpty: ta("recurringEmpty"),
          recurringHint: ta("recurringHint", {
            count: RECURRING_MIN_COUNT,
            days: AI_EVAL_WINDOW_DAYS,
          }),
          recurringTitle: ta("recurringTitle"),
          rerun: {
            checked: ta("rerunChecked"),
            confidence: ta("rerunConfidence"),
            description: ta("rerunDescription"),
            errors: {
              ai_disabled: te("ai_disabled"),
              api_failed: te("api_failed"),
              failed: te("failed"),
              forbidden: te("forbidden"),
            },
            expected: ta("rerunExpected"),
            failed: ta("rerunFailed"),
            hint: ta("rerunHint", { limit: AI_RERUN_LIMIT }),
            lowConfidence: ta("rerunLowConfidence"),
            hitRate: ta("rerunHitRate"),
            missesTitle: ta("rerunMissesTitle"),
            noMisses: ta("rerunNoMisses"),
            noPick: ta("rerunNoPick"),
            pending: ta("rerunPending"),
            predicted: ta("rerunPredicted"),
            run: ta("rerunRun"),
            stoppedEarly: ta("rerunStoppedEarly"),
            title: ta("rerunTitle"),
            unscored: ta("rerunUnscored"),
            vendor: ta("rerunVendor"),
          },
          times: ta.raw("times") as string,
          type: ta("type"),
          window30: ta("window30"),
          window90: ta("window90"),
        }}
        recurring={recurringOwnTexts(data.ownTextRows)}
        typeNames={Object.fromEntries(labelBySlug)}
        windows={{ 30: windowFor(30), 90: windowFor(90) }}
      />
    </div>
  );
}
