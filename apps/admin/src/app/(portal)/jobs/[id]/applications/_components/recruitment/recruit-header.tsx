"use client";

import { ArrowLeft, Eye, Link2, Pencil, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import {
  cx,
  daysUntil,
  formatShortDate,
  type RecruitmentAnalytics,
  type WorkspaceJob,
  type WorkspaceKpis,
} from "./view-model";

function Snap({
  label,
  value,
  unit,
  delta,
  deltaTone = "up",
  alert,
  accent,
}: {
  accent?: boolean;
  alert?: boolean;
  delta?: string;
  deltaTone?: "up" | "down" | "warn";
  label: string;
  unit?: string;
  value: ReactNode;
}) {
  return (
    <div className={cx("snap", alert && "alert")}>
      <div className="lbl">{label}</div>
      <div className="val">
        {accent ? <em>{value}</em> : value}
        {unit ? <span className="unit">{unit}</span> : null}
      </div>
      {delta ? <div className={`delta ${deltaTone}`}>{delta}</div> : null}
    </div>
  );
}

function SnapStrip({
  kpis,
  analytics,
}: {
  analytics: RecruitmentAnalytics;
  kpis: WorkspaceKpis;
}) {
  const closingSoon = kpis.daysToClose != null && kpis.daysToClose <= 7;
  let daysToCloseDelta = "On track";
  if (kpis.daysToClose == null) {
    daysToCloseDelta = "No deadline set";
  } else if (closingSoon) {
    daysToCloseDelta = "Closing soon";
  }

  return (
    <div className="snap-strip">
      <Snap
        delta={
          kpis.newToday > 0 ? `+${kpis.newToday} new today` : "No new today"
        }
        deltaTone="up"
        label="Applicants"
        value={kpis.applicants}
      />
      <Snap
        accent
        delta={`${analytics.aboveNinety} above 90% match`}
        deltaTone="up"
        label="AI-shortlisted"
        value={kpis.aiShortlisted}
      />
      <Snap
        delta={
          kpis.awaitingConfirm > 0
            ? `${kpis.awaitingConfirm} awaiting confirm`
            : "All confirmed"
        }
        deltaTone="warn"
        label="Interviews"
        unit="this week"
        value={kpis.interviewsThisWeek}
      />
      <Snap
        delta="active candidates"
        deltaTone="up"
        label="In pipeline"
        value={kpis.inPipeline}
      />
      <Snap
        delta={kpis.offersOut > 0 ? "Signature pending" : "None yet"}
        deltaTone="warn"
        label="Offers out"
        value={kpis.offersOut}
      />
      <Snap
        alert={closingSoon}
        delta={daysToCloseDelta}
        deltaTone={closingSoon ? "down" : "up"}
        label="Days to close"
        value={kpis.daysToClose == null ? "—" : kpis.daysToClose}
      />
    </div>
  );
}

export function RecruitHeader({
  job,
  kpis,
  analytics,
  onBackToList,
  onEditJob,
  onShare,
  onPublicView,
  onOpenAI,
}: {
  analytics: RecruitmentAnalytics;
  job: WorkspaceJob;
  kpis: WorkspaceKpis;
  onBackToList: () => void;
  onEditJob: () => void;
  onOpenAI: () => void;
  onPublicView: () => void;
  onShare: () => void;
}) {
  const dl = daysUntil(job.deadline);
  const isLive = job.status === "published";

  return (
    <div className="rcr-head">
      <div className="top">
        <div className="titleblock">
          <div className="eyebrow">
            <button
              className="btn-ghost"
              onClick={onBackToList}
              style={{ padding: "3px 8px", fontSize: 11.5 }}
              type="button"
            >
              <ArrowLeft size={11} /> All jobs
            </button>
            <span className="crest">{job.departmentCrest}</span>
            {job.departmentName ?? "BISO"}
            <span className="pin" style={{ background: job.campusColor }} />
            {job.campusName ?? "BISO"}
            <span style={{ color: "var(--ink-4)" }}>·</span>
            <span className="mono" style={{ fontSize: 10.5 }}>
              {job.slug}
            </span>
          </div>
          <h1>
            {job.titleEn} <em>recruitment.</em>
          </h1>
          <div className="meta">
            {isLive ? (
              <span className="pulse-pill">
                <i /> Live · {kpis.applicants} applicants
              </span>
            ) : (
              <span
                className="pulse-pill"
                style={{
                  background: "rgba(176,138,62,0.09)",
                  borderColor: "rgba(176,138,62,0.24)",
                  color: "var(--gold)",
                }}
              >
                {job.status}
              </span>
            )}
            <span>
              <b>{kpis.inPipeline}</b> in pipeline
            </span>
            <span>
              <b>{kpis.newToday}</b> new today
            </span>
            {job.deadline ? (
              <span>
                Closes <b>{formatShortDate(job.deadline)}</b> ·{" "}
                <span
                  style={{
                    color:
                      dl != null && dl <= 5 ? "var(--claret)" : "var(--ink-3)",
                  }}
                >
                  {dl == null ? "open" : `${dl}d left`}
                </span>
              </span>
            ) : null}
            {job.commitment || job.term ? (
              <span>
                {[job.commitment, job.term].filter(Boolean).join(" · ")}
              </span>
            ) : null}
          </div>
        </div>
        <div className="actions">
          <button className="btn-ghost" onClick={onEditJob} type="button">
            <Pencil size={13} /> Edit posting
          </button>
          <button className="btn-ghost" onClick={onShare} type="button">
            <Link2 size={13} /> Share link
          </button>
          <button className="btn-ghost" onClick={onPublicView} type="button">
            <Eye size={13} /> Public view
          </button>
          <button className="btn-dark" onClick={onOpenAI} type="button">
            <Sparkles size={13} /> AI assistant
          </button>
        </div>
      </div>

      <SnapStrip analytics={analytics} kpis={kpis} />
    </div>
  );
}
