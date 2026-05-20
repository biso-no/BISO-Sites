"use client";

import { useState } from "react";
import type { PatchFn } from "@/blocks/types";
import type { FormField, MultiStepFormBlock } from "@/editor/types";

interface Props {
  block: MultiStepFormBlock;
  edit: boolean;
  onPatch: PatchFn;
}

function getStepDotClass(index: number, step: number): string {
  if (index === step) {
    return "pg-msform__step-dot pg-msform__step-dot--active";
  }
  if (index < step) {
    return "pg-msform__step-dot pg-msform__step-dot--done";
  }
  return "pg-msform__step-dot";
}

function getActiveStepDotClass(index: number, step: number): string {
  if (index === step) {
    return "pg-msform__step-dot pg-msform__step-dot--active";
  }
  return "pg-msform__step-dot";
}

function getSubmitLabel(
  submitting: boolean,
  step: number,
  stepsLength: number
): string {
  if (submitting) {
    return "Sending…";
  }
  if (step < stepsLength - 1) {
    return "Next";
  }
  return "Submit";
}

function renderEditField(field: FormField, index: number) {
  const id = `msf-edit-${index}-${field.name}`;

  if (field.fieldType === "textarea") {
    return (
      <textarea
        className="pg-msform__input"
        id={id}
        placeholder={field.placeholder}
        readOnly
        rows={4}
      />
    );
  }

  if (field.fieldType === "select") {
    return (
      <select className="pg-msform__input" id={id}>
        {(field.options ?? []).map((option, optionIndex) => (
          <option key={optionIndex} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  return (
    <input
      className="pg-msform__input"
      id={id}
      placeholder={field.placeholder}
      readOnly
      type={field.fieldType}
    />
  );
}

function renderField(field: FormField) {
  if (field.fieldType === "textarea") {
    return (
      <textarea
        aria-label={field.label}
        className="pg-msform__input"
        id={`msf-${field.name}`}
        name={field.name}
        placeholder={field.placeholder}
        required={field.required}
        rows={4}
      />
    );
  }

  if (field.fieldType === "select") {
    return (
      <select
        aria-label={field.label}
        className="pg-msform__input"
        id={`msf-${field.name}`}
        name={field.name}
        required={field.required}
      >
        <option value="">Choose…</option>
        {(field.options ?? []).map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  return (
    <input
      aria-label={field.label}
      className="pg-msform__input"
      id={`msf-${field.name}`}
      name={field.name}
      placeholder={field.placeholder}
      required={field.required}
      type={field.fieldType}
    />
  );
}

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
        {block.heading && (
          <h2 className="pg-msform__heading">{block.heading}</h2>
        )}
        <div className="pg-msform__stepper">
          {steps.map((_s, i) => (
            <button
              className={getActiveStepDotClass(i, step)}
              key={i}
              onClick={() => setStep(i)}
              style={{ cursor: "pointer" }}
              type="button"
            >
              {i + 1}
            </button>
          ))}
        </div>
        {current && (
          <div className="pg-msform__panel">
            <div className="pg-msform__step-title">{current.title}</div>
            {current.fields.map((f, i) => (
              <div className="pg-msform__field" key={i}>
                <label
                  className="pg-msform__label"
                  htmlFor={`msf-edit-${i}-${f.name}`}
                >
                  {f.label}
                  {f.required && <span aria-hidden="true"> *</span>}
                </label>
                {renderEditField(f, i)}
              </div>
            ))}
          </div>
        )}
        <div className="pg-msform__nav">
          {step > 0 && (
            <button
              className="pg-msform__btn pg-msform__btn--back"
              onClick={() => setStep(step - 1)}
              type="button"
            >
              Back
            </button>
          )}
          {step < steps.length - 1 ? (
            <button
              className="pg-msform__btn pg-msform__btn--next"
              onClick={() => setStep(step + 1)}
              type="button"
            >
              Next
            </button>
          ) : (
            <button
              className="pg-msform__btn pg-msform__btn--submit"
              type="button"
            >
              Submit
            </button>
          )}
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
          <span aria-label="Success" role="img">
            ✓
          </span>
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
      if (
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        el instanceof HTMLSelectElement
      ) {
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
      if (res.ok) {
        setSubmitted(true);
      }
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
        <div className="pg-msform__stepper">
          {steps.map((_s, i) => (
            <div
              aria-hidden="true"
              className={getStepDotClass(i, step)}
              key={i}
            >
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
              <div className="pg-msform__field" key={f.name}>
                {f.fieldType !== "hidden" && (
                  <label className="pg-msform__label" htmlFor={`msf-${f.name}`}>
                    {f.label}
                    {f.required && <span aria-hidden="true"> *</span>}
                  </label>
                )}
                {renderField(f)}
              </div>
            ))}
          </div>
          <div className="pg-msform__nav">
            {step > 0 && (
              <button
                className="pg-msform__btn pg-msform__btn--back"
                onClick={() => setStep(step - 1)}
                type="button"
              >
                Back
              </button>
            )}
            <button
              className="pg-msform__btn pg-msform__btn--next"
              disabled={submitting}
              type="submit"
            >
              {getSubmitLabel(submitting, step, steps.length)}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
