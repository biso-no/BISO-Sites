"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { PageSize } from "@/lib/list-params";
import type { ApprovalRequest } from "../../../_actions/approvals";
import { approveRequest, rejectRequest } from "../../../_actions/approvals";
import { PaginationBar } from "../../../_components/pagination-bar";
import { StatusBadge } from "../../../_components/status-badge";
import { SERIF_STACK, STUDIO } from "../../../_components/studio";

interface ApprovalsReviewClientProps {
  labels: {
    action: string;
    approve: string;
    approveError: string;
    approveSuccess: string;
    reason: string;
    reasonPlaceholder: string;
    reject: string;
    rejectError: string;
    rejectSuccess: string;
    requester: string;
    resourceType: string;
  };
  page: number;
  requests: ApprovalRequest[];
  size: PageSize;
  total: number;
}

function parsePayload(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function PayloadSummary({ raw }: { raw: string }) {
  const data = parsePayload(raw);
  const entries = Object.entries(data)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .slice(0, 4);

  if (entries.length === 0) {
    return null;
  }

  return (
    <dl className="mt-2 space-y-0.5">
      {entries.map(([k, v]) => (
        <div className="flex gap-1.5 text-[11px]" key={k}>
          <dt
            className="min-w-0 shrink-0 font-medium capitalize"
            style={{ color: STUDIO.ink3 }}
          >
            {k.replace(/_/g, " ")}:
          </dt>
          <dd className="min-w-0 truncate" style={{ color: STUDIO.ink2 }}>
            {String(v)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function ApprovalCard({
  labels,
  onApprove,
  onReject,
  request,
}: {
  labels: ApprovalsReviewClientProps["labels"];
  onApprove: (id: string) => void;
  onReject: (id: string, reason: string) => void;
  request: ApprovalRequest;
}) {
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");

  const formattedDate = new Date(request.$createdAt).toLocaleDateString(
    undefined,
    { day: "numeric", month: "short", year: "numeric" }
  );

  return (
    <div
      className="flex flex-col overflow-hidden rounded-2xl border"
      style={{
        background: "rgba(255,255,255,0.46)",
        borderColor: STUDIO.rule,
      }}
    >
      {/* Card header */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p
              className="truncate text-lg leading-6"
              style={{ color: STUDIO.ink, fontFamily: SERIF_STACK }}
            >
              {request.action}
            </p>
            <p className="mt-0.5 text-[11px]" style={{ color: STUDIO.ink4 }}>
              {formattedDate}
            </p>
          </div>
          <StatusBadge size="sm" status="pending" />
        </div>

        <div className="mt-3 space-y-1">
          <div className="flex gap-2 text-[12px]">
            <span style={{ color: STUDIO.ink3 }}>{labels.requester}:</span>
            <span
              className="min-w-0 truncate font-medium"
              style={{ color: STUDIO.ink2 }}
            >
              {request.requester_email}
            </span>
          </div>
          <div className="flex gap-2 text-[12px]">
            <span style={{ color: STUDIO.ink3 }}>{labels.resourceType}:</span>
            <span
              className="min-w-0 truncate font-medium capitalize"
              style={{ color: STUDIO.ink2 }}
            >
              {request.resource_type}
            </span>
          </div>
        </div>

        <PayloadSummary raw={request.payload} />
      </div>

      {/* Actions */}
      <div className="p-4 pt-0">
        {rejectOpen ? (
          <div className="space-y-2">
            <textarea
              autoFocus
              className="w-full resize-none rounded-xl border px-3 py-2 text-[12.5px] outline-none"
              onChange={(e) => setReason(e.target.value)}
              placeholder={labels.reasonPlaceholder}
              rows={2}
              style={{
                background: "rgba(255,255,255,0.7)",
                borderColor: STUDIO.rule2,
                color: STUDIO.ink,
              }}
              value={reason}
            />
            <div className="flex gap-2">
              <button
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 font-medium text-xs transition-all"
                onClick={() => {
                  setRejectOpen(false);
                  setReason("");
                }}
                style={{
                  background: STUDIO.paper2,
                  color: STUDIO.ink3,
                }}
                type="button"
              >
                Avbryt
              </button>
              <button
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 font-medium text-xs transition-all disabled:opacity-50"
                disabled={!reason.trim()}
                onClick={() => {
                  onReject(request.$id, reason.trim());
                  setRejectOpen(false);
                  setReason("");
                }}
                style={{
                  background: "rgba(107,30,30,0.08)",
                  border: "0.5px solid rgba(107,30,30,0.2)",
                  color: STUDIO.claret,
                }}
                type="button"
              >
                <XCircle size={13} />
                {labels.reject}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 font-medium text-xs transition-all"
              onClick={() => setRejectOpen(true)}
              style={{
                background: "rgba(107,30,30,0.08)",
                border: "0.5px solid rgba(107,30,30,0.2)",
                color: STUDIO.claret,
              }}
              type="button"
            >
              <XCircle size={13} />
              {labels.reject}
            </button>
            <button
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 font-medium text-xs transition-all"
              onClick={() => onApprove(request.$id)}
              style={{
                background: "rgba(47,93,58,0.08)",
                border: "0.5px solid rgba(47,93,58,0.22)",
                color: STUDIO.leaf,
              }}
              type="button"
            >
              <CheckCircle2 size={13} />
              {labels.approve}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function ApprovalsReviewClient({
  labels,
  page,
  requests: initialRequests,
  size,
  total,
}: ApprovalsReviewClientProps) {
  const [requests, setRequests] = useState(initialRequests);
  const [, startTransition] = useTransition();

  function handleApprove(id: string) {
    startTransition(async () => {
      const result = await approveRequest(id);
      if ("error" in result) {
        toast.error(labels.approveError);
      } else {
        toast.success(labels.approveSuccess);
        setRequests((prev) => prev.filter((r) => r.$id !== id));
      }
    });
  }

  function handleReject(id: string, reason: string) {
    startTransition(async () => {
      const result = await rejectRequest(id, reason);
      if ("error" in result) {
        toast.error(labels.rejectError);
      } else {
        toast.success(labels.rejectSuccess);
        setRequests((prev) => prev.filter((r) => r.$id !== id));
      }
    });
  }

  if (requests.length === 0) {
    return null;
  }

  return (
    <div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {requests.map((request) => (
          <ApprovalCard
            key={request.$id}
            labels={labels}
            onApprove={handleApprove}
            onReject={handleReject}
            request={request}
          />
        ))}
      </div>

      <PaginationBar page={page} size={size} sizeSelectable total={total} />
    </div>
  );
}
