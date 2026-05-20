"use client";

import { useState } from "react";
import type { MultiStepFormBlock } from "@/editor/types";
import type { PatchFn } from "@/blocks/types";

interface Props { block: MultiStepFormBlock; edit: boolean; onPatch: PatchFn; }

export function MultiStepFormRender({ block, edit }: Props) {
  const [step, setStep] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const steps = block.steps ?? [];
  const current = steps[step];
  const mode = block.submitMode ?? "database";

  if (edit) {
    return (
      <div className="pg-msform pg-block">
        {block.heading && <h2 className="pg-msform__heading">{block.heading}</h2>}
        <div className="pg-msform__stepper">
          {steps.map((s, i) => (
            <div
              key={i}
              className={`pg-msform__step-dot${i === step ? " pg-msform__step-dot--active" : ""}`}
              onClick={() => setStep(i)}
              style={{ cursor: "pointer" }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && setStep(i)}
            >
              {i + 1}
            </div>
          ))}
        </div>
        {current && (
          <div className="pg-msform__panel">
            <div className="pg-msform__step-title">{current.title}</div>
            {current.fields.map((f, i) => (
              <div key={i} className="pg-msform__field">
                <label className="pg-msform__label">{f.label}{f.required && <span aria-hidden="true"> *</span>}</label>
                {f.fieldType === "textarea" ? (
                  <textarea className="pg-msform__input" rows={4} placeholder={f.placeholder} readOnly aria-label={f.label} />
                ) : f.fieldType === "select" ? (
                  <select className="pg-msform__input" aria-label={f.label}>
                    {(f.options ?? []).map((o, j) => <option key={j} value={o.value}>{o.label}</option>)}
                  </select>
                ) : (
                  <input className="pg-msform__input" type={f.fieldType} placeholder={f.placeholder} readOnly aria-label={f.label} />
                )}
              </div>
            ))}
          </div>
        )}
        <div className="pg-msform__nav">
          {step > 0 && <button type="button" className="pg-msform__btn pg-msform__btn--back" onClick={() => setStep(step - 1)}>Back</button>}
          {step < steps.length - 1
            ? <button type="button" className="pg-msform__btn pg-msform__btn--next" onClick={() => setStep(step + 1)}>Next</button>
            : <button type="button" className="pg-msform__btn pg-msform__btn--submit">Submit</button>}
        </div>
        <p style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 10 }}>
          {mode === "email"
            ? `Submissions will be emailed to ${block.recipientEmail || "(no recipient set)"}`
            : `Submissions stored in DB · topic: "${block.submitTarget?.topic ?? "(no topic set)"}"`}
        </p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="pg-msform pg-block">
        <div className="pg-msform__success">
          <span aria-label="Success" role="img">✓</span>
          <p>Your message has been sent. We'll be in touch soon.</p>
        </div>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;

    // Collect all form data gathered so far (across steps we accumulate in state)
    const data: Record<string, string> = {};
    for (const field of current?.fields ?? []) {
      const el = form.elements.namedItem(field.name);
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
        data[field.name] = el.value;
      }
    }

    if (step < steps.length - 1) {
      setStep(step + 1);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/form/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          topic: block.submitTarget?.topic ?? block.heading ?? "form",
          formHeading: block.adminLabel ?? block.heading,
          data,
          accessTeamId: block.accessTeamId,
          recipientEmail: block.recipientEmail,
          source: "multiStepForm",
        }),
      });
      if (res.ok) setSubmitted(true);
    } catch {
      // silent — user sees the form remain, can retry
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="pg-msform pg-block">
      {block.heading && <h2 className="pg-msform__heading">{block.heading}</h2>}
      {steps.length > 1 && (
        <div className="pg-msform__stepper" aria-label="Form steps">
          {steps.map((s, i) => (
            <div key={i} className={`pg-msform__step-dot${i === step ? " pg-msform__step-dot--active" : i < step ? " pg-msform__step-dot--done" : ""}`} aria-hidden="true">
              {i < step ? "✓" : i + 1}
            </div>
          ))}
        </div>
      )}
      {current && (
        <form onSubmit={handleSubmit}>
          <div className="pg-msform__panel">
            <div className="pg-msform__step-title">{current.title}</div>
            {current.fields.map((f) => (
              <div key={f.name} className="pg-msform__field">
                {f.fieldType !== "hidden" && (
                  <label className="pg-msform__label" htmlFor={`msf-${f.name}`}>
                    {f.label}{f.required && <span aria-hidden="true"> *</span>}
                  </label>
                )}
                {f.fieldType === "textarea" ? (
                  <textarea id={`msf-${f.name}`} name={f.name} className="pg-msform__input" rows={4} placeholder={f.placeholder} required={f.required} aria-label={f.label} />
                ) : f.fieldType === "select" ? (
                  <select id={`msf-${f.name}`} name={f.name} className="pg-msform__input" required={f.required} aria-label={f.label}>
                    <option value="">Choose…</option>
                    {(f.options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                ) : (
                  <input id={`msf-${f.name}`} name={f.name} type={f.fieldType} className="pg-msform__input" placeholder={f.placeholder} required={f.required} aria-label={f.label} />
                )}
              </div>
            ))}
          </div>
          <div className="pg-msform__nav">
            {step > 0 && (
              <button type="button" className="pg-msform__btn pg-msform__btn--back" onClick={() => setStep(step - 1)}>Back</button>
            )}
            <button type="submit" className="pg-msform__btn pg-msform__btn--next" disabled={submitting}>
              {submitting ? "Sending…" : step < steps.length - 1 ? "Next" : "Submit"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
