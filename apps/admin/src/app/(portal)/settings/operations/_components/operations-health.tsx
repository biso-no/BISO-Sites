import Link from "next/link";
import type {
  IntegrationHealthReport,
  IntegrationStatusValue,
} from "@/lib/integration-health";
import type { TeamHealthReport } from "@/lib/team-health";
import { STUDIO, studioSurface } from "../../../_components/studio";

export interface OperationsLabels {
  integrationsTitle: string;
  missingSuffix: string;
  runbook: string;
  status: {
    configured: string;
    incomplete: string;
    not_configured: string;
  };
  teamsAllPresent: string;
  teamsEndpointNote: string;
  teamsMissingSuffix: string;
  teamsTitle: string;
  teamsUnavailable: string;
}

const STATUS_STYLE: Record<
  IntegrationStatusValue,
  { background: string; color: string }
> = {
  configured: { background: "rgba(47,93,58,0.08)", color: STUDIO.leaf },
  incomplete: { background: "rgba(180,83,9,0.10)", color: "#b45309" },
  not_configured: { background: "rgba(107,30,30,0.08)", color: STUDIO.claret },
};

function StatusPill({
  status,
  label,
}: {
  status: IntegrationStatusValue;
  label: string;
}) {
  return (
    <span
      className="shrink-0 rounded-full px-2.5 py-0.5 text-xs"
      style={STATUS_STYLE[status]}
    >
      {label}
    </span>
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl p-6" style={studioSurface}>
      <h3 className="mb-4 font-medium text-sm" style={{ color: STUDIO.ink }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

export function OperationsHealth({
  integrations,
  teamHealth,
  labels,
}: {
  integrations: IntegrationHealthReport;
  teamHealth: TeamHealthReport | null;
  labels: OperationsLabels;
}) {
  return (
    <div className="space-y-5">
      <SectionCard title={labels.integrationsTitle}>
        <div>
          {integrations.entries.map((entry) => (
            <div
              className="flex items-start justify-between gap-4 py-3.5"
              key={entry.id}
              style={{ borderBottom: `0.5px solid ${STUDIO.rule}` }}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm" style={{ color: STUDIO.ink }}>
                    {entry.label}
                  </p>
                  {entry.missingKeys.length > 0 && (
                    <span className="text-xs" style={{ color: STUDIO.ink4 }}>
                      {entry.missingKeys.length} {labels.missingSuffix}
                    </span>
                  )}
                </div>
                <p
                  className="mt-0.5 max-w-prose text-xs"
                  style={{ color: STUDIO.ink4 }}
                >
                  {entry.purpose}
                </p>
                <Link
                  className="mt-1 inline-block text-xs underline"
                  href={entry.runbook}
                  style={{ color: STUDIO.ink3 }}
                >
                  {labels.runbook}
                </Link>
              </div>
              <StatusPill
                label={labels.status[entry.status]}
                status={entry.status}
              />
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title={labels.teamsTitle}>
        {renderTeamHealth(teamHealth, labels)}
        <p className="mt-3 text-xs" style={{ color: STUDIO.ink4 }}>
          {labels.teamsEndpointNote}
        </p>
      </SectionCard>
    </div>
  );
}

function renderTeamHealth(
  teamHealth: TeamHealthReport | null,
  labels: OperationsLabels
) {
  if (!teamHealth) {
    return (
      <p className="text-sm" style={{ color: STUDIO.claret }}>
        {labels.teamsUnavailable}
      </p>
    );
  }

  if (teamHealth.ok) {
    return <StatusPill label={labels.teamsAllPresent} status="configured" />;
  }

  return (
    <div>
      <StatusPill
        label={`${teamHealth.missingCount} ${labels.teamsMissingSuffix}`}
        status="not_configured"
      />
      <div className="mt-3">
        {teamHealth.missing.map((team) => (
          <div
            className="py-2.5"
            key={team.id}
            style={{ borderTop: `0.5px solid ${STUDIO.rule}` }}
          >
            <div className="flex items-center gap-2">
              <p className="text-sm" style={{ color: STUDIO.ink }}>
                {team.label}
              </p>
              <code
                className="rounded px-1.5 py-0.5 text-[11px]"
                style={{ background: STUDIO.paper2, color: STUDIO.ink3 }}
              >
                {team.id}
              </code>
            </div>
            <p className="mt-0.5 text-xs" style={{ color: STUDIO.ink4 }}>
              {team.fix}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
