"use client";

import { ShieldCheck } from "lucide-react";
import { useState, useTransition } from "react";
import { setAutoScreen } from "../../../_actions/recruitment-workspace";
import { useRecruitment } from "../recruitment-context";
import { cx } from "../view-model";

function Toggle({
  on,
  onChange,
  disabled,
}: {
  disabled?: boolean;
  onChange?: (value: boolean) => void;
  on: boolean;
}) {
  return (
    <button
      aria-pressed={on}
      className={cx("set-toggle", on && "on")}
      disabled={disabled}
      onClick={() => onChange?.(!on)}
      type="button"
    >
      <span className="set-knob" />
    </button>
  );
}

export function SettingsTab() {
  const { job, jobId, panel } = useRecruitment();
  const [autoScreen, setAuto] = useState(job.autoScreen);
  const [, startSave] = useTransition();

  const toggleAuto = (value: boolean) => {
    setAuto(value);
    startSave(async () => {
      const result = await setAutoScreen(jobId, value);
      if (result.error) {
        setAuto(!value);
      }
    });
  };

  return (
    <div className="settings-tab rcr-pad" data-tour="settings-access">
      <div className="set-card">
        <h3>Pipeline automations</h3>
        <div className="set-row">
          <div>
            <p className="set-row-title">Auto-screen applications</p>
            <p className="set-row-sub">
              Run AI screening on every new application as it arrives.
            </p>
          </div>
          <Toggle on={autoScreen} onChange={toggleAuto} />
        </div>
        <div className="set-row">
          <div>
            <p className="set-row-title">Teams meeting auto-create</p>
            <p className="set-row-sub">
              Interviews scheduled with a panel get a Teams link automatically.
            </p>
          </div>
          <span className="set-pill">On via panel</span>
        </div>
        <div className="set-row muted">
          <div>
            <p className="set-row-title">Auto-advance above 85% match</p>
            <p className="set-row-sub">Planned — not yet available.</p>
          </div>
          <Toggle disabled on={false} />
        </div>
        <div className="set-row muted">
          <div>
            <p className="set-row-title">Auto-archive below 60% match</p>
            <p className="set-row-sub">Planned — not yet available.</p>
          </div>
          <Toggle disabled on={false} />
        </div>
      </div>

      <div className="set-card">
        <h3>Access</h3>
        <p className="set-row-sub" style={{ marginBottom: 12 }}>
          {panel.length} {panel.length === 1 ? "person" : "people"} can review
          this vacancy. Campus and department admins always have access.
        </p>
        <div className="set-people">
          {panel.map((member) => (
            <div className="set-person" key={member.id}>
              <span>{member.name}</span>
              <span className="set-person-role">
                {member.email ?? member.role}
              </span>
            </div>
          ))}
          {panel.length === 0 ? (
            <p className="set-row-sub">No reviewers found for this scope.</p>
          ) : null}
        </div>
      </div>

      <div className="set-card">
        <h3>
          <ShieldCheck size={15} /> Data retention &amp; GDPR
        </h3>
        <ul className="set-gdpr">
          <li>
            Applicant data is retained for 6 months after the vacancy closes,
            then auto-purged.
          </li>
          <li>
            Every application records explicit GDPR consent and a processing
            purpose.
          </li>
          <li>
            Resumes are stored in the private <code>resumes</code> bucket with
            scoped access only.
          </li>
          <li>
            Audience:{" "}
            <strong>
              {job.audience === "members" ? "Members only" : "Public"}
            </strong>
          </li>
        </ul>
      </div>
    </div>
  );
}
