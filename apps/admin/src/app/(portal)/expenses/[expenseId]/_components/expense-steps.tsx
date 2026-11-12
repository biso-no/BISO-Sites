import { useLocale, useTranslations } from "next-intl";
import { MONO_STACK, STUDIO, StudioPanel } from "../../../_components/studio";
import { normalizeLocale } from "../../../shop/_components/shop-studio-theme";
import type { ExpenseDetailStep } from "../../expenses-data";
import { ChangeApproverDialog } from "./change-approver-dialog";

const STATUS_KEYS = ["pending", "approved", "rejected", "skipped"];

export function formatDateTime(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(
    normalizeLocale(locale) === "no" ? "nb-NO" : "en-GB",
    {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Europe/Oslo",
    }
  ).format(new Date(iso));
}

export function ExpenseSteps({
  canChangeApprover = false,
  expenseId,
  steps,
}: {
  canChangeApprover?: boolean;
  expenseId: string;
  steps: ExpenseDetailStep[];
}) {
  const t = useTranslations("adminPortal.expenses");
  const locale = useLocale();
  return (
    <StudioPanel className="mt-4 p-5">
      <h3 className="font-medium text-[14px]">{t("detail.stepsTitle")}</h3>
      {steps.length === 0 ? (
        <p className="mt-2 text-[13px]" style={{ color: STUDIO.ink3 }}>
          {t("detail.noSteps")}
        </p>
      ) : (
        <ol className="mt-3 space-y-3">
          {steps.map((s) => {
            const who = s.decidedBy ?? s.decidedByEmail ?? "";
            const role = t(`roles.${s.role}` as never);
            return (
              <li className="text-[13px]" key={s.id}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{role}</span>
                  <span style={{ color: STUDIO.ink3 }}>{s.approverEmail}</span>
                  <span style={{ fontFamily: MONO_STACK }}>
                    {STATUS_KEYS.includes(s.status)
                      ? t(`steps.${s.status}` as never)
                      : s.status}
                  </span>
                  {s.isCurrent && (
                    <span
                      className="font-medium"
                      style={{ color: STUDIO.gold }}
                    >
                      {t("steps.current")}
                    </span>
                  )}
                  {s.isCurrent && canChangeApprover && (
                    <ChangeApproverDialog
                      approvalId={s.id}
                      expenseId={expenseId}
                    />
                  )}
                </div>
                {s.decidedAt && (
                  <p style={{ color: STUDIO.ink2 }}>
                    {s.onBehalf
                      ? t("steps.onBehalf", { name: who, role })
                      : t("steps.byOn", { name: who })}
                    {" · "}
                    {formatDateTime(s.decidedAt, locale)}
                  </p>
                )}
                {s.reason && (
                  <p style={{ color: STUDIO.ink2 }}>
                    {t("steps.reason", { reason: s.reason })}
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </StudioPanel>
  );
}
