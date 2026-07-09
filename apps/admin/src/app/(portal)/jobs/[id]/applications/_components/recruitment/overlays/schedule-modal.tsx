"use client";

import { JobApplicationsStatus } from "@repo/api/types/appwrite";
import { CalendarPlus, Check } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import {
  createInterview,
  proposeInterviewSlots,
} from "@/app/(portal)/_actions/interviews";
import { updateJobApplicationStatus } from "@/app/(portal)/_actions/jobs";
import { useRecruitment } from "../recruitment-context";
import { Avatar } from "../shared";
import { cx, type WorkspaceCandidate } from "../view-model";
import { ModalShell } from "./modal-shell";

const HOURS = [9, 10, 11, 12, 13, 14, 15, 16];
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function buildDays(count: number): { iso: string; label: string }[] {
  const days: { iso: string; label: string }[] = [];
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  while (days.length < count) {
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

export function ScheduleModal({
  candidate,
  onClose,
}: {
  candidate: WorkspaceCandidate;
  onClose: () => void;
}) {
  const { panel, allowOtherCampusPanel, updateCandidate } = useRecruitment();
  const days = useMemo(() => buildDays(6), []);
  const [round, setRound] = useState(candidate.interview?.round ?? 1);
  const [duration, setDuration] = useState(45);
  const [location, setLocation] = useState("Teams");
  const [showOtherCampuses, setShowOtherCampuses] = useState(false);
  const [selectedPanel, setSelectedPanel] = useState<Set<string>>(
    new Set(
      panel
        .filter((member) => member.scope === "primary" && member.email)
        .slice(0, 2)
        .map((m) => m.id)
    )
  );
  const visiblePanel =
    allowOtherCampusPanel && showOtherCampuses
      ? panel
      : panel.filter((member) => member.scope === "primary");
  const [slot, setSlot] = useState<{
    hour: number;
    iso: string;
    label?: string;
  } | null>(null);
  const [available, setAvailable] = useState<Set<string>>(new Set());
  const [checking, startCheck] = useTransition();
  const [submitting, startSubmit] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const panelEmails = panel
    .filter((member) => selectedPanel.has(member.id) && member.email)
    .map((member) => member.email as string);

  const checkAvailability = () => {
    if (panelEmails.length === 0) {
      setError("Select at least one panelist with an email first.");
      return;
    }
    setError(null);
    const from = new Date();
    const to = new Date(from.getTime() + 14 * 86_400_000);
    startCheck(async () => {
      const result = await proposeInterviewSlots({
        durationMinutes: duration,
        from: from.toISOString(),
        panelEmails,
        to: to.toISOString(),
      });
      const keys = new Set<string>();
      for (const proposed of result.slots) {
        const date = new Date(proposed.starts_at);
        keys.add(`${date.toISOString().slice(0, 10)}-${date.getHours()}`);
      }
      setAvailable(keys);
      if (keys.size === 0) {
        setError("No common availability found (or calendar not connected).");
      }
    });
  };

  const submit = () => {
    if (!slot) {
      return;
    }
    setError(null);
    const starts = new Date(
      `${slot.iso}T${String(slot.hour).padStart(2, "0")}:00:00`
    );
    const ends = new Date(starts.getTime() + duration * 60_000);
    const participants = panel
      .filter((member) => selectedPanel.has(member.id) && member.email)
      .map((member, index) => ({
        display_name: member.name,
        email: member.email as string,
        is_lead: index === 0,
        role: "interviewer" as const,
        user_id: member.id,
      }));
    if (participants.length === 0) {
      setError("Select at least one panelist with an email.");
      return;
    }
    startSubmit(async () => {
      const result = await createInterview({
        application_id: candidate.id,
        auto_create_teams_meeting:
          location === "Teams" || location === "Hybrid",
        ends_at: ends.toISOString(),
        location,
        participants,
        round,
        starts_at: starts.toISOString(),
        timezone: "Europe/Oslo",
        title: `${candidate.name} — Round ${round}`,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      if (candidate.stage === "reviewed") {
        await updateJobApplicationStatus(candidate.id, {
          status: JobApplicationsStatus.INTERVIEW,
        });
        updateCandidate(candidate.id, {
          stage: JobApplicationsStatus.INTERVIEW,
        });
      }
      if (result.data?.warning) {
        window.alert(result.data.warning);
      }
      onClose();
    });
  };

  const togglePanel = (id: string) => {
    setSelectedPanel((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  let submitLabel = "Pick a slot";
  if (submitting) {
    submitLabel = "Scheduling…";
  } else if (slot) {
    submitLabel = `Send invite for ${slot.label ?? `${slot.hour}:00`}`;
  }

  return (
    <ModalShell
      eyebrow={`Schedule · ${candidate.name}`}
      footer={
        <>
          <span className="m-foot-note">
            Teams meeting auto-created · invites sent to the panel
          </span>
          <div className="m-foot-actions">
            <button className="btn-ghost" onClick={onClose} type="button">
              Cancel
            </button>
            <button
              className="btn-dark"
              disabled={!slot || submitting}
              onClick={submit}
              type="button"
            >
              {submitLabel}
            </button>
          </div>
        </>
      }
      icon={<CalendarPlus size={16} />}
      onClose={onClose}
      title="Schedule an interview"
      wide
    >
      <div className="sched-grid">
        <div className="sched-controls">
          <div className="sched-field">
            <span>Round</span>
            <div className="sched-segment">
              {[1, 2, 3].map((value) => (
                <button
                  className={round === value ? "on" : ""}
                  key={value}
                  onClick={() => setRound(value)}
                  type="button"
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
          <div className="sched-field">
            <span>Duration</span>
            <div className="sched-segment">
              {[30, 45, 60].map((value) => (
                <button
                  className={duration === value ? "on" : ""}
                  key={value}
                  onClick={() => setDuration(value)}
                  type="button"
                >
                  {value}m
                </button>
              ))}
            </div>
          </div>
          <div className="sched-field">
            <span>Location</span>
            <div className="sched-segment">
              {["Teams", "Nydalen", "Hybrid"].map((value) => (
                <button
                  className={location === value ? "on" : ""}
                  key={value}
                  onClick={() => setLocation(value)}
                  type="button"
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
          <div className="sched-field">
            <span>Panel</span>
            {allowOtherCampusPanel ? (
              <label className="sched-other-campus">
                <input
                  checked={showOtherCampuses}
                  onChange={(event) =>
                    setShowOtherCampuses(event.target.checked)
                  }
                  type="checkbox"
                />
                Include HR from other campuses
              </label>
            ) : null}
            <div className="sched-panel">
              {visiblePanel.length === 0 ? (
                <p className="sched-empty">No reviewers configured.</p>
              ) : null}
              {visiblePanel.map((member) => (
                <button
                  className={`sched-panelist${
                    selectedPanel.has(member.id) ? "on" : ""
                  }${member.email ? "" : "disabled"}`}
                  disabled={!member.email}
                  key={member.id}
                  onClick={() => member.email && togglePanel(member.id)}
                  type="button"
                >
                  <Avatar name={member.name} size={20} />
                  {member.name.split(" ")[0]}
                  {selectedPanel.has(member.id) ? <Check size={12} /> : null}
                </button>
              ))}
            </div>
            <button
              className="btn-ghost sched-check"
              disabled={checking}
              onClick={checkAvailability}
              type="button"
            >
              {checking ? "Checking…" : "Check availability"}
            </button>
          </div>
        </div>

        <div className="sched-cal">
          <div
            className="sched-cal-grid"
            style={{ gridTemplateColumns: `48px repeat(${days.length}, 1fr)` }}
          >
            <span className="sched-corner" />
            {days.map((day) => (
              <span className="sched-day" key={day.iso}>
                {day.label}
              </span>
            ))}
            {HOURS.map((hour) => (
              <ScheduleRow
                available={available}
                days={days}
                hour={hour}
                key={hour}
                onPick={(iso, label) => setSlot({ hour, iso, label })}
                selected={slot}
              />
            ))}
          </div>
          {error ? <p className="sched-error">{error}</p> : null}
        </div>
      </div>
    </ModalShell>
  );
}

function ScheduleRow({
  available,
  days,
  hour,
  onPick,
  selected,
}: {
  available: Set<string>;
  days: { iso: string; label: string }[];
  hour: number;
  onPick: (iso: string, label: string) => void;
  selected: { iso: string; hour: number } | null;
}) {
  return (
    <>
      <span className="sched-hour">{hour}:00</span>
      {days.map((day) => {
        const key = `${day.iso}-${hour}`;
        const isAvail = available.has(key);
        const isSel = selected?.iso === day.iso && selected.hour === hour;
        return (
          <button
            className={cx("sched-cell", isAvail && "avail", isSel && "pick")}
            key={key}
            onClick={() => onPick(day.iso, `${day.label} ${hour}:00`)}
            type="button"
          >
            {isSel ? <Check size={12} /> : null}
          </button>
        );
      })}
    </>
  );
}
