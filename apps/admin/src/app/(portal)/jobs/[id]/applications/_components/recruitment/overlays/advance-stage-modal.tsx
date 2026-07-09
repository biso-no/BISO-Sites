"use client";

import { JobApplicationsStatus } from "@repo/api/types/appwrite";
import { getAllowedRecruitmentApplicationTransitions } from "@repo/shared/types/recruitment";
import { ArrowRight, Check, Copy } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import {
  draftRecruitmentEmail,
  updateJobApplicationStatus,
} from "@/app/(portal)/_actions/jobs";
import { useRecruitment } from "../recruitment-context";
import {
  cx,
  STAGE_OF_STATUS,
  stageMeta,
  type WorkspaceCandidate,
} from "../view-model";
import { ModalShell } from "./modal-shell";

type EmailStage =
  | "interview_invite"
  | "rejection"
  | "request_more_info"
  | "offer"
  | "thank_you";

const EMAIL_STAGE_BY_STATUS: Record<string, EmailStage> = {
  accepted: "offer",
  interview: "interview_invite",
  rejected: "rejection",
  reviewed: "thank_you",
};

const NEXT_STEPS: Record<string, string[]> = {
  accepted: [
    "Send the formal offer letter",
    "Schedule an onboarding call",
    "Archive the remaining candidates",
  ],
  interview: [
    "Send the interview invitation with a booking link",
    "Auto-create the Teams meeting",
    "Notify the panel",
  ],
  rejected: [
    "Send a respectful rejection note",
    "Keep the candidate in the talent pool (with consent)",
  ],
  reviewed: [
    "Send the shortlist note",
    "Suggest interview slots within 48h",
    "Add to the Round 1 panel calendar",
  ],
};

export function AdvanceStageModal({
  candidate,
  onClose,
}: {
  candidate: WorkspaceCandidate;
  onClose: () => void;
}) {
  const { updateCandidate } = useRecruitment();
  const allowed = getAllowedRecruitmentApplicationTransitions(
    candidate.stage as JobApplicationsStatus
  );
  const forward =
    allowed.find((status) => status !== JobApplicationsStatus.REJECTED) ??
    allowed[0];
  const [target, setTarget] = useState<JobApplicationsStatus | null>(
    forward ?? null
  );
  const [includeEmail, setIncludeEmail] = useState(true);
  const [email, setEmail] = useState<{ subject: string; body: string } | null>(
    null
  );
  const [emailError, setEmailError] = useState<string | null>(null);
  const [loadingEmail, startLoadEmail] = useTransition();
  const [submitting, startSubmit] = useTransition();
  const [copied, setCopied] = useState(false);
  const [steps, setSteps] = useState<Set<number>>(new Set([0, 1, 2]));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!(includeEmail && target)) {
      return;
    }
    const stage = EMAIL_STAGE_BY_STATUS[target];
    if (!stage) {
      return;
    }
    startLoadEmail(async () => {
      const result = await draftRecruitmentEmail(candidate.id, { stage });
      if (result.error) {
        setEmailError(result.error);
        setEmail(null);
      } else if (result.data) {
        setEmail(result.data);
        setEmailError(null);
      }
    });
  }, [candidate.id, includeEmail, target]);

  if (!target) {
    return (
      <ModalShell
        eyebrow={`Advance · ${candidate.name}`}
        icon={<ArrowRight size={16} />}
        onClose={onClose}
        title="No further stage"
      >
        <p className="adv-terminal">
          {candidate.name} is already in a terminal stage (
          {stageMeta(STAGE_OF_STATUS[candidate.stage]).label}).
        </p>
      </ModalShell>
    );
  }

  const fromStage = stageMeta(STAGE_OF_STATUS[candidate.stage]);
  const toStage = stageMeta(STAGE_OF_STATUS[target]);

  const submit = () => {
    setError(null);
    const previous = candidate.stage;
    updateCandidate(candidate.id, { stage: target });
    startSubmit(async () => {
      const result = await updateJobApplicationStatus(candidate.id, {
        status: target,
      });
      if (result.error) {
        updateCandidate(candidate.id, { stage: previous });
        setError(result.error);
        return;
      }
      onClose();
    });
  };

  const copyEmail = () => {
    if (email) {
      navigator.clipboard?.writeText(`${email.subject}\n\n${email.body}`).then(
        () => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        },
        () => undefined
      );
    }
  };

  return (
    <ModalShell
      eyebrow={`Advance · ${candidate.name}`}
      footer={
        <>
          <span className="m-foot-note">
            {includeEmail
              ? "AI drafted the email — copy it into your mail client to send."
              : "No email will be drafted."}
          </span>
          <div className="m-foot-actions">
            <button className="btn-ghost" onClick={onClose} type="button">
              Cancel
            </button>
            <button
              className="btn-dark"
              disabled={submitting}
              onClick={submit}
              type="button"
            >
              {submitting ? "Advancing…" : `Move to ${toStage.label}`}
            </button>
          </div>
        </>
      }
      icon={<ArrowRight size={16} />}
      onClose={onClose}
      title="Advance candidate"
    >
      <div className="adv-flow">
        <span className="adv-stage">
          <span className="adv-dot" style={{ background: fromStage.tint }} />
          {fromStage.label}
        </span>
        <ArrowRight size={16} />
        <span className="adv-stage to">
          <span className="adv-dot" style={{ background: toStage.tint }} />
          {toStage.label}
        </span>
      </div>

      {allowed.length > 1 ? (
        <div className="adv-targets">
          {allowed.map((status) => (
            <button
              className={cx("adv-target", target === status && "on")}
              key={status}
              onClick={() => setTarget(status)}
              type="button"
            >
              {stageMeta(STAGE_OF_STATUS[status]).label}
            </button>
          ))}
        </div>
      ) : null}

      <label className="adv-email-toggle">
        <input
          checked={includeEmail}
          onChange={(event) => setIncludeEmail(event.target.checked)}
          type="checkbox"
        />
        Draft a candidate notification email
      </label>

      {includeEmail ? (
        <div className="adv-email">
          <EmailDraftBlock
            copied={copied}
            email={email}
            emailError={emailError}
            loadingEmail={loadingEmail}
            onCopy={copyEmail}
            onPatch={(patch) =>
              setEmail((prev) => (prev ? { ...prev, ...patch } : prev))
            }
          />
        </div>
      ) : null}

      <div className="adv-steps">
        <h4>AI-suggested next steps</h4>
        {(NEXT_STEPS[target] ?? []).map((step, index) => (
          <label className="adv-step" key={step}>
            <input
              checked={steps.has(index)}
              onChange={() =>
                setSteps((prev) => {
                  const next = new Set(prev);
                  if (next.has(index)) {
                    next.delete(index);
                  } else {
                    next.add(index);
                  }
                  return next;
                })
              }
              type="checkbox"
            />
            {step}
          </label>
        ))}
      </div>

      {error ? <p className="sched-error">{error}</p> : null}
    </ModalShell>
  );
}

function EmailDraftBlock({
  loadingEmail,
  email,
  emailError,
  copied,
  onCopy,
  onPatch,
}: {
  copied: boolean;
  email: { subject: string; body: string } | null;
  emailError: string | null;
  loadingEmail: boolean;
  onCopy: () => void;
  onPatch: (patch: { body?: string; subject?: string }) => void;
}) {
  if (loadingEmail) {
    return <p className="adv-email-loading">Drafting with AI…</p>;
  }
  if (emailError) {
    return <p className="sched-error">Failed to draft: {emailError}</p>;
  }
  if (!email) {
    return (
      <p className="adv-email-loading">
        Email drafting unavailable (no AI key configured).
      </p>
    );
  }
  return (
    <>
      <div className="adv-email-head">
        <span className="adv-email-tag">AI v4.2 · personalized</span>
        <button className="btn-ghost" onClick={onCopy} type="button">
          {copied ? <Check size={12} /> : <Copy size={12} />} Copy
        </button>
      </div>
      <input
        className="adv-email-subject"
        onChange={(event) => onPatch({ subject: event.target.value })}
        value={email.subject}
      />
      <textarea
        className="adv-email-body"
        onChange={(event) => onPatch({ body: event.target.value })}
        value={email.body}
      />
    </>
  );
}
