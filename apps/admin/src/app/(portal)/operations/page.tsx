import { getTranslations } from "next-intl/server";
import { requireNavAccess } from "@/lib/authorization";
import { checkIntegrationHealth } from "@/lib/integration-health";
import type { TeamHealthReport } from "@/lib/team-health";
import { fetchRequiredTeamHealth } from "@/lib/team-health-check";
import { PageHeader } from "../_components/page-header";
import { OperationsHealth } from "./_components/operations-health";

async function safeTeamHealth(): Promise<TeamHealthReport | null> {
  try {
    return await fetchRequiredTeamHealth();
  } catch (error) {
    console.error("Failed to load team health:", error);
    return null;
  }
}

export default async function OperationsPage() {
  // portal.settings is restricted to globaladmin; the helper redirects/404s
  // for anyone else, so reaching this line means the user IS a global admin.
  await requireNavAccess("portal.settings");
  const t = await getTranslations("adminPortal.operations");

  // Presence only — secret values never leave the server.
  const integrations = checkIntegrationHealth((key) =>
    Boolean(process.env[key]?.trim())
  );
  const teamHealth = await safeTeamHealth();

  return (
    <div className="pb-12">
      <PageHeader description={t("description")} title={t("title")} />

      <OperationsHealth
        integrations={integrations}
        labels={{
          integrationsTitle: t("integrationsTitle"),
          missingSuffix: t("missingSuffix"),
          runbook: t("runbook"),
          status: {
            configured: t("status.configured"),
            incomplete: t("status.incomplete"),
            not_configured: t("status.notConfigured"),
          },
          teamsAllPresent: t("teamsAllPresent"),
          teamsEndpointNote: t("teamsEndpointNote"),
          teamsMissingSuffix: t("teamsMissingSuffix"),
          teamsTitle: t("teamsTitle"),
          teamsUnavailable: t("teamsUnavailable"),
        }}
        teamHealth={teamHealth}
      />
    </div>
  );
}
