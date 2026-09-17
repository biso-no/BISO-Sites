import { Button } from "@repo/ui/components/ui/button";
import { ScanLine } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireNavAccess } from "@/lib/authorization";
import { listMembers } from "../_actions/members";
import { PageHeader } from "../_components/page-header";
import { MembersListClient } from "./_components/members-list-client";

interface MembersPageProps {
  searchParams: Promise<{ q?: string; status?: string }>;
}

export default async function MembersPage({ searchParams }: MembersPageProps) {
  await requireNavAccess("portal.members");
  const t = await getTranslations("adminPortal.members");
  const tPass = await getTranslations("adminPortal.memberPass");
  const { q, status } = await searchParams;
  const query = q?.trim() ?? "";
  const statusFilter =
    status === "active" || status === "inactive" ? status : undefined;

  const members = await listMembers({
    q: query || undefined,
    status: statusFilter,
  });

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
      <MembersListClient
        initialQuery={query}
        initialStatus={statusFilter ?? ""}
        labels={{
          empty: t("empty"),
          emptyDescription: t("emptyDescription"),
          filterActive: t("filters.active"),
          filterAll: t("filters.all"),
          filterInactive: t("filters.inactive"),
          noCampus: t("noCampus"),
          noExpiry: t("noExpiry"),
          noPlan: t("noPlan"),
          searchPlaceholder: t("searchPlaceholder"),
          statusActive: t("status.active"),
          statusInactive: t("status.inactive"),
          unnamed: t("unnamed"),
        }}
        members={members}
      />
    </div>
  );
}
