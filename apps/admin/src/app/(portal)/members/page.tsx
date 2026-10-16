import { Button } from "@repo/ui/components/ui/button";
import { ScanLine } from "lucide-react";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { requireNavAccess } from "@/lib/authorization";
import { parseListParams } from "@/lib/list-params";
import { getRosterStatus, listRosterMembers } from "../_actions/members";
import { PageHeader } from "../_components/page-header";
import { PaginationBar } from "../_components/pagination-bar";
import { MembersListClient } from "./_components/members-list-client";
import { RosterRefresh } from "./_components/roster-refresh";

interface MembersPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function MembersPage({ searchParams }: MembersPageProps) {
  await requireNavAccess("portal.members");
  const t = await getTranslations("adminPortal.members");
  const tPass = await getTranslations("adminPortal.memberPass");
  const format = await getFormatter();
  const params = parseListParams(await searchParams);

  const [{ rows: members, total }, status] = await Promise.all([
    listRosterMembers(params),
    getRosterStatus(),
  ]);

  const formatAt = (iso: string) =>
    format.dateTime(new Date(iso), {
      dateStyle: "medium",
      timeStyle: "short",
    });
  let statusText = status.lastRefreshedAt
    ? t("roster.lastRefreshed", { date: formatAt(status.lastRefreshedAt) })
    : t("roster.neverRefreshed");
  if (status.unavailable) {
    statusText = t("roster.statusUnavailable");
  } else if (status.lastFailedAt) {
    statusText = `${statusText} · ${t("roster.lastFailed", {
      date: formatAt(status.lastFailedAt),
    })}`;
  }

  return (
    <div className="pb-12">
      <PageHeader description={t("description")} title={t("title")}>
        <div className="flex gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href="/members/scan/links">{tPass("manageLinks")}</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/members/scan/access">{tPass("manageAccess")}</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/members/scan">
              <ScanLine className="mr-2 h-4 w-4" />
              {tPass("openScanner")}
            </Link>
          </Button>
        </div>
      </PageHeader>
      <div className="mb-4">
        <RosterRefresh
          canRefresh={status.canRefresh}
          labels={{
            alreadyRunning: t("roster.alreadyRunning"),
            failed: t("roster.failed"),
            notConfigured: t("roster.notConfigured"),
            queued: t("roster.queued"),
            refresh: t("roster.refresh"),
            refreshing: t("roster.refreshing"),
          }}
          running={status.running}
          statusText={statusText}
        />
      </div>
      <MembersListClient
        initialQuery={params.q}
        labels={{
          empty: t("empty"),
          emptyDescription: t("emptyDescription"),
          searchPlaceholder: t("searchPlaceholder"),
          unknownCampus: t("unknownCampus"),
          unnamed: t("unnamed"),
        }}
        members={members}
      />
      <PaginationBar
        page={params.page}
        size={params.size}
        sizeSelectable
        total={total}
      />
    </div>
  );
}
