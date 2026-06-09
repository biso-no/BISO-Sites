"use client";

import type {
  DepartmentFixDecision,
  DepartmentRemediationPlan,
  RemediationGroup,
} from "@repo/shared/types/user-management";
import { AlertTriangle, Check, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { applyDepartmentFixes } from "../../../_actions/it-remediation";
import { EmptyState } from "../../../_components/empty-state";
import { STUDIO, StudioButton } from "../../../_components/studio";

type Segment = "safe" | "review" | "closed";

interface RemediationClientProps {
  departmentNames: string[];
  departmentToCampus: Record<string, string>;
  plan: DepartmentRemediationPlan;
}

function groupDecision(
  group: RemediationGroup,
  department: string | null,
  campusName: string | null
): DepartmentFixDecision | null {
  if (!(department && campusName)) {
    return null;
  }
  return {
    campusName,
    department,
    userIds: group.affectedUsers.map((u) => u.id),
  };
}

export function RemediationClient({
  departmentNames,
  departmentToCampus,
  plan,
}: RemediationClientProps) {
  const t = useTranslations("adminPortal.it.audit");
  const router = useRouter();
  const [segment, setSegment] = useState<Segment>("safe");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"success" | "error" | null>(
    null
  );

  const segments: Array<{ count: number; key: Segment; label: string }> = [
    { count: plan.safe.length, key: "safe", label: t("segments.safe") },
    { count: plan.review.length, key: "review", label: t("segments.review") },
    { count: plan.closed.length, key: "closed", label: t("segments.closed") },
  ];

  const segmentDescriptions: Record<Segment, string> = {
    closed: t("closedDescription"),
    review: t("reviewDescription"),
    safe: t("safeDescription"),
  };

  function apply(decisions: DepartmentFixDecision[]) {
    if (decisions.length === 0) {
      return;
    }
    startTransition(async () => {
      const result = await applyDepartmentFixes(decisions);
      if (result.error) {
        setMessage(result.error);
        setMessageType("error");
      } else if (result.data) {
        setMessage(
          t("applied", {
            failed: result.data.failed.length,
            succeeded: result.data.succeeded,
          })
        );
        setMessageType("success");
        router.refresh();
      }
    });
  }

  function applyAllSafe() {
    const decisions = plan.safe
      .map((group) =>
        groupDecision(
          group,
          group.suggestedDepartment,
          group.suggestedCampusName
        )
      )
      .filter((d): d is DepartmentFixDecision => d !== null);
    apply(decisions);
  }

  const active = plan[segment];

  return (
    <div>
      <p className="mb-4 text-sm" style={{ color: STUDIO.ink3 }}>
        {t("summary", {
          compliant: plan.compliantCount,
          flagged: plan.safe.length + plan.review.length + plan.closed.length,
          total: plan.totalScanned,
        })}
      </p>

      <div
        className="mb-5 flex items-center gap-1 border-b"
        style={{ borderColor: STUDIO.rule }}
      >
        {segments.map((s) => (
          <button
            className="-mb-px border-b-2 px-4 py-2.5 font-medium text-sm"
            key={s.key}
            onClick={() => {
              setSegment(s.key);
              setMessage(null);
              setMessageType(null);
            }}
            style={{
              borderColor: segment === s.key ? STUDIO.claret : "transparent",
              color: segment === s.key ? STUDIO.ink : STUDIO.ink3,
            }}
            type="button"
          >
            {s.label} ({s.count})
          </button>
        ))}
      </div>

      <p className="mb-4 text-xs" style={{ color: STUDIO.ink4 }}>
        {segmentDescriptions[segment]}
      </p>

      {message && (
        <p
          className="mb-4 text-sm"
          style={{
            color: messageType === "error" ? STUDIO.claret : STUDIO.leaf,
          }}
        >
          {message}
        </p>
      )}

      {segment === "safe" && plan.safe.length > 0 && (
        <div className="mb-4">
          <StudioButton
            disabled={pending}
            onClick={applyAllSafe}
            variant="primary"
          >
            {pending ? (
              <Loader2 className="animate-spin" size={15} />
            ) : (
              <Check size={15} />
            )}
            {t("applyAllSafe")}
          </StudioButton>
        </div>
      )}

      {active.length === 0 ? (
        <EmptyState
          description={t("allClearDescription")}
          icon={<Check size={28} />}
          title={t("allClear")}
        />
      ) : (
        <div className="space-y-2">
          {active.map((group) => (
            <GroupRow
              departmentNames={departmentNames}
              departmentToCampus={departmentToCampus}
              group={group}
              key={group.value || "__blank__"}
              onApply={apply}
              pending={pending}
              segment={segment}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function GroupRow({
  departmentNames,
  departmentToCampus,
  group,
  onApply,
  pending,
  segment,
}: {
  departmentNames: string[];
  departmentToCampus: Record<string, string>;
  group: RemediationGroup;
  onApply: (decisions: DepartmentFixDecision[]) => void;
  pending: boolean;
  segment: Segment;
}) {
  const t = useTranslations("adminPortal.it.audit");
  const [chosen, setChosen] = useState<string | null>(
    group.suggestedDepartment
  );

  useEffect(() => {
    setChosen(group.suggestedDepartment);
  }, [group.suggestedDepartment]);

  const displayValue = group.value || t("blankDepartment");
  const count = group.affectedUsers.length;

  let infoSuffix = "";
  if (segment === "safe" && group.suggestedDepartment) {
    infoSuffix = t("writesWithOffice", {
      department: group.suggestedDepartment,
      office: group.suggestedCampusName ?? "",
    });
  } else if (segment === "review") {
    infoSuffix = group.suggestedDepartment
      ? t("suggestion", {
          department: group.suggestedDepartment,
          score: Math.round((group.score ?? 0) * 100),
        })
      : t("noSuggestion");
  }

  return (
    <div
      className="rounded-2xl px-5 py-4"
      style={{
        background: "rgba(255,255,255,0.46)",
        border: `0.5px solid ${STUDIO.rule}`,
      }}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p
            className="truncate font-medium text-sm"
            style={{ color: STUDIO.ink }}
          >
            {displayValue}
          </p>
          <p className="mt-1 text-xs" style={{ color: STUDIO.ink4 }}>
            {t("affectedUsers", { count })}
            {infoSuffix ? ` · ${infoSuffix}` : ""}
          </p>
        </div>

        {segment === "review" && (
          <div className="flex items-center gap-2">
            <select
              aria-label={t("selectDepartment")}
              className="rounded-lg border px-3 py-2 text-sm"
              onChange={(e) => setChosen(e.target.value || null)}
              style={{ borderColor: STUDIO.rule2, color: STUDIO.ink2 }}
              value={chosen ?? ""}
            >
              <option value="">{t("selectDepartment")}</option>
              {departmentNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <StudioButton
              disabled={pending || !chosen}
              onClick={() => {
                const campusName =
                  group.suggestedCampusName ??
                  (chosen ? (departmentToCampus[chosen] ?? null) : null);
                const decision = groupDecision(group, chosen, campusName);
                if (decision) {
                  onApply([decision]);
                }
              }}
              variant="secondary"
            >
              {t("applyGroup")}
            </StudioButton>
          </div>
        )}

        {segment === "closed" && (
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs"
            style={{ background: "rgba(107,30,30,0.08)", color: STUDIO.claret }}
          >
            <AlertTriangle size={12} />
            {t("segments.closed")}
          </span>
        )}
      </div>
    </div>
  );
}
