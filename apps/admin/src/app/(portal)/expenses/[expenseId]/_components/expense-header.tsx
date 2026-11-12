import type { ApproverHint } from "@repo/shared/utils/expense-hints";
import { useTranslations } from "next-intl";
import { MONO_STACK, STUDIO, StudioPanel } from "../../../_components/studio";
import { fmtNOK } from "../../../shop/_components/shop-studio-theme";
import { ExpenseStatusBadge } from "../../_components/expense-status-badge";
import type { ExpenseDetail } from "../../expenses-data";

function Field({
  label,
  children,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <div>
      <dt
        className="text-[11px] uppercase tracking-[0.05em]"
        style={{ color: STUDIO.ink4, fontFamily: MONO_STACK }}
      >
        {label}
      </dt>
      <dd className="mt-0.5 text-[14px]" style={{ color: STUDIO.ink }}>
        {children}
      </dd>
    </div>
  );
}

export function ExpenseHeader({ detail }: { detail: ExpenseDetail }) {
  const t = useTranslations("adminPortal.expenses.detail");
  return (
    <StudioPanel className="mt-6 p-5">
      <div className="flex flex-wrap items-center gap-3">
        <h2
          className="font-semibold text-[20px]"
          style={{ fontFamily: MONO_STACK }}
        >
          {detail.reference}
        </h2>
        <ExpenseStatusBadge status={detail.status} />
      </div>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label={t("submittedBy")}>
          {detail.submitter.name}
          <span className="block text-[12px]" style={{ color: STUDIO.ink3 }}>
            {detail.submitter.email}
          </span>
        </Field>
        <Field label={t("department")}>{detail.department.name}</Field>
        <Field label={t("campus")}>{detail.campus.name}</Field>
        <Field label={t("total")}>{fmtNOK(detail.total)}</Field>
        <Field label={t("bankAccount")}>
          <span style={{ fontFamily: MONO_STACK }}>{detail.bankAccount}</span>
        </Field>
        {detail.event && <Field label={t("event")}>{detail.event.title}</Field>}
        {detail.ledgerTransactionId && (
          <Field label={t("ledgerTransaction")}>
            <span style={{ fontFamily: MONO_STACK }}>
              {detail.ledgerTransactionId}
            </span>
          </Field>
        )}
      </dl>
      {detail.description && (
        <p className="mt-4 whitespace-pre-wrap text-[14px]">
          {detail.description}
        </p>
      )}
      {detail.occasion && (
        <p className="mt-2 text-[13px]" style={{ color: STUDIO.ink2 }}>
          <span style={{ color: STUDIO.ink4 }}>{t("occasion")}: </span>
          {detail.occasion}
        </p>
      )}
      <div
        className="mt-3 space-y-1 text-[13px]"
        style={{ color: STUDIO.ink2 }}
      >
        {detail.switches.financialManager && (
          <p>{t("switchFinancialManager")}</p>
        )}
        {detail.switches.controller && <p>{t("switchController")}</p>}
        {detail.presidentFallback && <p>{t("presidentFallback")}</p>}
      </div>
    </StudioPanel>
  );
}

export function ExpenseHints({ hints }: { hints: ApproverHint[] }) {
  const t = useTranslations("adminPortal.expenses");
  if (hints.length === 0) {
    return null;
  }
  const line = (hint: ApproverHint) => {
    const data = hint.data ?? {};
    if (hint.code === "receipt_issue") {
      const issue = String(data.issue ?? "");
      return t("hintsText.receipt_issue", {
        issue: issue ? t(`issues.${issue}` as never) : "",
      });
    }
    const key =
      hint.code === "possible_duplicate" && data.reimbursementNumber
        ? "possible_duplicate_number"
        : hint.code;
    return t(`hintsText.${key}` as never, data as never);
  };
  return (
    <section
      aria-label={t("detail.hintsTitle")}
      className="mt-4 rounded-2xl border p-4"
      style={{
        background: "rgba(176,138,62,0.09)",
        borderColor: "rgba(176,138,62,0.24)",
      }}
    >
      <h3 className="font-medium text-[13px]">{t("detail.hintsTitle")}</h3>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px]">
        {hints.map((hint, i) => (
          <li key={`${hint.code}-${hint.attachmentId ?? ""}-${i}`}>
            {line(hint)}
          </li>
        ))}
      </ul>
    </section>
  );
}
