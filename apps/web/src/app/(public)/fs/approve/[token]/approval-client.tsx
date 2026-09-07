"use client";

import { Button } from "@repo/ui/components/ui/button";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { CheckCircle, ExternalLink, Loader2, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

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

function fileUrl(token: string, fileId: string): string {
  return `${API_BASE}/api/expenses/approve/file?token=${encodeURIComponent(token)}&fileId=${encodeURIComponent(fileId)}`;
}

export function ApprovalClient({
  token,
  intent,
}: {
  token: string;
  intent?: string;
}) {
  const t = useTranslations("common.approval");
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
          setError(data.error ?? "This approval link is invalid.");
          return;
        }
        setContext(data.context);
      } catch {
        setError("Could not load the approval request.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token]);

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
        setError(data.error ?? "Could not record your decision.");
        return;
      }
      setOutcome(decision);
    } catch {
      setError("Could not record your decision.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Centered>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </Centered>
    );
  }

  if (error && !context) {
    return (
      <Centered>
        <p className="text-destructive">{error}</p>
      </Centered>
    );
  }

  if (!context) {
    return null;
  }

  if (outcome || context.status !== "pending") {
    const decided = outcome ?? (context.status as Decision);
    return (
      <Centered>
        <div className="flex flex-col items-center gap-3 text-center">
          {decided === "approved" ? (
            <CheckCircle className="h-10 w-10 text-emerald-600" />
          ) : (
            <XCircle className="h-10 w-10 text-red-600" />
          )}
          <h1 className="font-semibold text-xl">
            Reimbursement {context.reimbursementNumber} {decided}
          </h1>
          <p className="text-muted-foreground text-sm">
            Thanks — this request has been {decided}.
          </p>
        </div>
      </Centered>
    );
  }

  if (context.expired) {
    return (
      <Centered>
        <p className="text-destructive">{t("expired")}</p>
      </Centered>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="font-semibold text-2xl">{t("title")}</h1>
      <p className="mt-1 text-muted-foreground text-sm">{context.stepLabel}</p>

      <div className="mt-6 rounded-xl border bg-card p-5">
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <Field label="Reference" value={context.reimbursementNumber} />
          <Field
            label="Amount"
            value={`${context.total.toLocaleString("nb-NO", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })} ${context.currency}`}
          />
          <Field
            label="Department"
            value={`${context.departmentLabel} — ${context.campusLabel}`}
          />
        </dl>
        <p className="mt-4 text-sm">{context.description}</p>
      </div>

      <h2 className="mt-8 mb-2 font-medium">Receipts</h2>
      <ul className="space-y-2">
        {context.receipts.map((receipt) => (
          <li
            className="flex items-center justify-between rounded-lg border bg-card px-4 py-3 text-sm"
            key={receipt.id}
          >
            <div>
              <p className="font-medium">{receipt.description || "Receipt"}</p>
              <p className="text-muted-foreground text-xs">
                {receipt.date ?? ""} ·{" "}
                {receipt.amount.toLocaleString("nb-NO", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{" "}
                {context.currency}
              </p>
            </div>
            {receipt.fileId && (
              <a
                className="flex items-center gap-1 text-primary text-xs hover:underline"
                href={fileUrl(token, receipt.fileId)}
                rel="noopener noreferrer"
                target="_blank"
              >
                View <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-8 space-y-3">
        <Textarea
          onChange={(event) => setReason(event.target.value)}
          placeholder={t("notePlaceholder")}
          rows={2}
          value={reason}
        />
        {error && <p className="text-destructive text-sm">{error}</p>}
        <div className="flex gap-3">
          <Button
            className="flex-1"
            disabled={submitting}
            onClick={() => decide("approved")}
            variant={intent === "reject" ? "outline" : "default"}
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Approve"
            )}
          </Button>
          <Button
            className="flex-1"
            disabled={submitting}
            onClick={() => decide("rejected")}
            variant="destructive"
          >
            Reject
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs uppercase tracking-wider">
        {label}
      </dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      {children}
    </div>
  );
}
