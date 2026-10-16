"use client";

import { cn } from "@repo/ui/lib/utils";
import { CheckCircle, ExternalLink, Loader2, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import {
  statusPanelPrimaryAction,
  statusPanelSecondaryAction,
} from "@/components/ui/status-panel";

interface ApprovalReceipt {
  amount: number;
  date: string | null;
  description: string;
  fileId: string | null;
  id: string;
  type: string;
}

interface ApprovalContext {
  campusLabel: string;
  currency: string;
  departmentLabel: string;
  description: string;
  expired: boolean;
  receipts: ApprovalReceipt[];
  reimbursementNumber: string;
  status: "pending" | "approved" | "rejected";
  stepLabel: string;
  total: number;
}

type Decision = "approved" | "rejected";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

/**
 * The destructive action in the danger colour. `text-surface` on `bg-danger`
 * holds in both themes — white on the light theme's red, navy on the dark
 * theme's lighter one (same pairing as `privacy-controls.tsx`).
 */
const dangerFilled = `type-label inline-flex items-center justify-center gap-2 rounded-biso-pill bg-danger px-5 py-3 text-surface transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`;

function fileUrl(token: string, fileId: string): string {
  return `${API_BASE}/api/expenses/approve/file?token=${encodeURIComponent(token)}&fileId=${encodeURIComponent(fileId)}`;
}

function formatAmount(amount: number): string {
  return amount.toLocaleString("nb-NO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * The page an approver lands on from the reimbursement email. Loads the
 * request through the token-gated `apps/api` endpoint and records the
 * decision there; nothing about the flow changed in the redesign, only the
 * surface it renders on — the navy `PageHeader`, then the request on paper.
 */
export function ApprovalClient({
  token,
  intent,
}: {
  token: string;
  intent?: string;
}) {
  const t = useTranslations("common.approval");
  const noteId = useId();
  const [context, setContext] = useState<ApprovalContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [outcome, setOutcome] = useState<Decision | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(
          `${API_BASE}/api/expenses/approve?token=${encodeURIComponent(token)}`
        );
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? t("invalidLink"));
          return;
        }
        setContext(data.context);
      } catch {
        setError(t("loadFailed"));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token, t]);

  const decide = async (decision: Decision) => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/expenses/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, decision, reason: reason || undefined }),
      });
      const data = await res.json();
      if (!(res.ok && data.success)) {
        setError(data.error ?? t("decisionFailed"));
        return;
      }
      setOutcome(decision);
    } catch {
      setError(t("decisionFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <PageHeader eyebrow={context?.stepLabel} title={t("title")} />
      <Section tone="paper" width="prose">
        <ApprovalBody
          context={context}
          decide={decide}
          error={error}
          intent={intent}
          loading={loading}
          noteId={noteId}
          outcome={outcome}
          reason={reason}
          setReason={setReason}
          submitting={submitting}
          token={token}
        />
      </Section>
    </>
  );
}

function ApprovalBody({
  context,
  decide,
  error,
  intent,
  loading,
  noteId,
  outcome,
  reason,
  setReason,
  submitting,
  token,
}: {
  context: ApprovalContext | null;
  decide: (decision: Decision) => void;
  error: string | null;
  intent?: string;
  loading: boolean;
  noteId: string;
  outcome: Decision | null;
  reason: string;
  setReason: (value: string) => void;
  submitting: boolean;
  token: string;
}) {
  const t = useTranslations("common.approval");

  if (loading) {
    return (
      <p
        className="type-body flex items-center gap-3 text-ink-muted"
        role="status"
      >
        <Loader2 aria-hidden="true" className="size-5 animate-spin" />
        {t("loading")}
      </p>
    );
  }

  if (error && !context) {
    return (
      <p className="type-body text-danger" role="alert">
        {error}
      </p>
    );
  }

  if (!context) {
    return null;
  }

  if (outcome || context.status !== "pending") {
    const decided = outcome ?? (context.status as Decision);
    return (
      <div className="flex flex-col items-start gap-3" role="status">
        {decided === "approved" ? (
          <CheckCircle aria-hidden="true" className="size-10 text-success" />
        ) : (
          <XCircle aria-hidden="true" className="size-10 text-danger" />
        )}
        <h2 className="type-display-sm break-words text-ink">
          {t(`decided.${decided}`, { number: context.reimbursementNumber })}
        </h2>
        <p className="type-body text-ink-muted">
          {t(`decidedBody.${decided}`)}
        </p>
      </div>
    );
  }

  if (context.expired) {
    return (
      <p className="type-body text-danger" role="alert">
        {t("expired")}
      </p>
    );
  }

  return (
    <>
      <div className="rounded-biso-md border border-edge bg-surface-raised p-5">
        <dl className="grid gap-4 sm:grid-cols-2">
          <Field label={t("reference")} value={context.reimbursementNumber} />
          <Field
            label={t("amount")}
            value={`${formatAmount(context.total)} ${context.currency}`}
          />
          <Field
            label={t("department")}
            value={`${context.departmentLabel} — ${context.campusLabel}`}
          />
        </dl>
        {context.description ? (
          <p className="type-body mt-4 text-ink">{context.description}</p>
        ) : null}
      </div>

      <h2 className="type-heading-section mt-10 mb-4 text-ink">
        {t("receipts")}
      </h2>
      <ul className="space-y-2">
        {context.receipts.map((receipt) => (
          <li
            className="flex flex-wrap items-center justify-between gap-3 rounded-biso-sm border border-edge bg-surface-raised px-4 py-3"
            key={receipt.id}
          >
            <div className="min-w-0">
              <p className="type-body-sm break-words font-semibold text-ink">
                {receipt.description || t("receipt")}
              </p>
              <p className="type-data text-ink-muted">
                {receipt.date ? `${receipt.date} · ` : ""}
                {formatAmount(receipt.amount)} {context.currency}
              </p>
            </div>
            {receipt.fileId ? (
              <a
                className={`type-body-sm inline-flex items-center gap-1 rounded-biso-sm text-ink-accent underline underline-offset-4 hover:no-underline ${focusRing}`}
                href={fileUrl(token, receipt.fileId)}
                rel="noopener noreferrer"
                target="_blank"
              >
                {t("viewReceipt")}
                <ExternalLink aria-hidden="true" className="size-3.5" />
              </a>
            ) : null}
          </li>
        ))}
      </ul>

      <div className="mt-10 space-y-3">
        <label className="type-label block text-ink-muted" htmlFor={noteId}>
          {t("noteLabel")}
        </label>
        <textarea
          className={`type-body-sm w-full rounded-biso-sm border border-edge bg-surface px-3 py-2 text-ink placeholder:text-ink-muted ${focusRing}`}
          id={noteId}
          onChange={(event) => setReason(event.target.value)}
          placeholder={t("notePlaceholder")}
          rows={3}
          value={reason}
        />
        {error ? (
          <p className="type-body-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-3">
          <button
            className={cn(
              intent === "reject"
                ? statusPanelSecondaryAction
                : statusPanelPrimaryAction,
              "flex-1 justify-center disabled:cursor-not-allowed disabled:opacity-50"
            )}
            disabled={submitting}
            onClick={() => decide("approved")}
            type="button"
          >
            {submitting ? (
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            ) : null}
            {t("approve")}
          </button>
          <button
            className={cn(dangerFilled, "flex-1")}
            disabled={submitting}
            onClick={() => decide("rejected")}
            type="button"
          >
            {t("reject")}
          </button>
        </div>
      </div>
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="type-label text-ink-muted">{label}</dt>
      <dd className="type-body mt-1 font-semibold text-ink">{value}</dd>
    </div>
  );
}
