"use client";

import { CalendarDays, Check, Copy, Link2, Video } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { createBookingToken } from "@/app/(portal)/_actions/interviews";
import { useRecruitment } from "../recruitment-context";
import {
  cx,
  formatShortDate,
  type PendingScorecard,
  type WorkspaceInterview,
} from "../view-model";

const HOURS = [9, 10, 11, 12, 13, 14, 15, 16];
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface HeatCell {
  label: string;
  status: "open" | "booked" | "proposed";
}

function buildDays(): { iso: string; label: string }[] {
  const days: { iso: string; label: string }[] = [];
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  while (days.length < 10) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) {
      days.push({
        iso: cursor.toISOString().slice(0, 10),
        label: `${DAY_LABELS[day]} ${cursor.getDate()}`,
      });
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

export function InterviewsTab({
  interviews,
  pendingScorecards,
}: {
  interviews: WorkspaceInterview[];
  pendingScorecards: PendingScorecard[];
}) {
  const { panel, candidates, actions } = useRecruitment();
  const primaryPanel = panel.filter((member) => member.scope === "primary");
  const days = useMemo(buildDays, []);
  const [duration, setDuration] = useState(30);
  const [bookingUrl, setBookingUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [issuing, startIssue] = useTransition();

  const cellMap = useMemo(() => {
    const map = new Map<string, HeatCell>();
    for (const interview of interviews) {
      if (!interview.startsAt) {
        continue;
      }
      const date = new Date(interview.startsAt);
      const key = `${date.toISOString().slice(0, 10)}-${date.getHours()}`;
      map.set(key, {
        label: `${interview.candidateName} — ${interview.status}`,
        status: interview.status === "proposed" ? "proposed" : "booked",
      });
    }
    return map;
  }, [interviews]);

  const candidateForApp = (applicationId: string) =>
    candidates.find((candidate) => candidate.id === applicationId) ?? null;

  const issueBooking = () => {
    setBookingError(null);
    const firstCandidate = candidates.find((c) => c.stage === "interview");
    if (!firstCandidate) {
      setBookingError("No candidate in the interview stage yet.");
      return;
    }
    const panelIds = primaryPanel.slice(0, 4).map((member) => member.id);
    if (panelIds.length === 0) {
      setBookingError("No panel members available to book against.");
      return;
    }
    const now = new Date();
    const to = new Date(now.getTime() + 14 * 86_400_000);
    startIssue(async () => {
      const result = await createBookingToken({
        application_id: firstCandidate.id,
        duration_minutes: duration,
        expires_in_days: 14,
        panel_user_ids: panelIds,
        window_from: now.toISOString(),
        window_to: to.toISOString(),
      });
      if (result.error) {
        setBookingError(result.error);
      } else if (result.data) {
        setBookingUrl(result.data.url);
      }
    });
  };

  const copyUrl = () => {
    if (bookingUrl) {
      navigator.clipboard?.writeText(bookingUrl).then(
        () => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        },
        () => setBookingError("Could not copy to clipboard.")
      );
    }
  };

  const scheduled = interviews
    .filter((interview) => interview.status !== "cancelled")
    .sort((a, b) => (a.startsAt ?? "").localeCompare(b.startsAt ?? ""));

  return (
    <div className="iv-tab rcr-pad">
      <div className="iv-main">
        <div className="iv-card">
          <div className="iv-card-head">
            <h3>Panel calendar</h3>
            <span className="iv-legend">
              <i className="open" /> Open <i className="booked" /> Booked{" "}
              <i className="proposed" /> Proposed
            </span>
          </div>
          <div
            className="heatmap"
            style={{ gridTemplateColumns: `54px repeat(${days.length}, 1fr)` }}
          >
            <span className="hm-corner" />
            {days.map((day) => (
              <span className="hm-day" key={day.iso}>
                {day.label}
              </span>
            ))}
            {HOURS.map((hour) => (
              <FragmentRow
                cellMap={cellMap}
                days={days}
                hour={hour}
                key={hour}
              />
            ))}
          </div>
        </div>

        <div className="iv-card">
          <div className="iv-card-head">
            <h3>Scheduled & proposed</h3>
          </div>
          {scheduled.length === 0 ? (
            <p className="iv-empty">No interviews scheduled yet.</p>
          ) : (
            <div className="iv-list">
              {scheduled.map((interview) => {
                const candidate = candidateForApp(interview.applicationId);
                return (
                  <div className="iv-row" key={interview.id}>
                    <div className="iv-row-main">
                      <strong>{interview.candidateName}</strong>
                      <span className="iv-row-sub">
                        Round {interview.round} ·{" "}
                        {formatShortDate(interview.startsAt)}
                        {interview.teams ? " · Teams" : ""}
                      </span>
                    </div>
                    <span className="iv-panel">
                      {interview.panel.map((member) => (
                        <span className="iv-panel-chip" key={member}>
                          {member}
                        </span>
                      ))}
                    </span>
                    <span className={`iv-status ${interview.status}`}>
                      {interview.status}
                    </span>
                    {candidate ? (
                      <button
                        className="btn-ghost"
                        onClick={() => actions.openSchedule(candidate)}
                        type="button"
                      >
                        Reschedule
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="iv-side">
        <div className="iv-card" data-tour="interviews-schedule">
          <div className="iv-card-head">
            <h3>
              <Link2 size={14} /> Send a booking link
            </h3>
          </div>
          <p className="iv-side-note">
            The candidate picks any slot within your panel&apos;s availability.
          </p>
          <div className="iv-duration">
            {[30, 45, 60].map((value) => (
              <button
                className={cx("iv-dur", duration === value && "on")}
                key={value}
                onClick={() => setDuration(value)}
                type="button"
              >
                {value} min
              </button>
            ))}
          </div>
          {bookingUrl ? (
            <div className="iv-url">
              <input readOnly value={bookingUrl} />
              <button onClick={copyUrl} title="Copy" type="button">
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
          ) : null}
          {bookingError ? <p className="iv-error">{bookingError}</p> : null}
          <button
            className="btn-dark iv-issue"
            disabled={issuing}
            onClick={issueBooking}
            type="button"
          >
            <Video size={13} />{" "}
            {issuing ? "Generating…" : "Generate booking link"}
          </button>
        </div>

        <div className="iv-card">
          <div className="iv-card-head">
            <h3>
              <CalendarDays size={14} /> Pending scorecards
            </h3>
          </div>
          {pendingScorecards.length === 0 ? (
            <p className="iv-empty">All scorecards are in.</p>
          ) : (
            <div className="iv-pending">
              {pendingScorecards.map((task) => {
                const candidate = candidateForApp(task.applicationId);
                return (
                  <div
                    className={cx("iv-task", task.due && "due")}
                    key={task.interviewId}
                  >
                    <div>
                      <strong>{task.candidateName}</strong>
                      <span>Round {task.round}</span>
                    </div>
                    {candidate ? (
                      <button
                        className={task.due ? "btn-dark" : "btn-ghost"}
                        onClick={() =>
                          actions.openScorecard(candidate, task.round)
                        }
                        type="button"
                      >
                        Write
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="iv-card">
          <div className="iv-card-head">
            <h3>Panel</h3>
          </div>
          <div className="iv-panel-list">
            {primaryPanel.length === 0 ? (
              <p className="iv-empty">No reviewers configured.</p>
            ) : (
              primaryPanel.map((member) => (
                <div className="iv-panel-member" key={member.id}>
                  <span>{member.name}</span>
                  <span className="iv-panel-role">{member.role}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function FragmentRow({
  cellMap,
  days,
  hour,
}: {
  cellMap: Map<string, HeatCell>;
  days: { iso: string; label: string }[];
  hour: number;
}) {
  return (
    <>
      <span className="hm-hour">{hour}:00</span>
      {days.map((day) => {
        const cell = cellMap.get(`${day.iso}-${hour}`);
        return (
          <span
            className={`hm-cell ${cell?.status ?? "open"}`}
            key={`${day.iso}-${hour}`}
            title={cell?.label ?? "Open"}
          />
        );
      })}
    </>
  );
}
