"use client";

import { type FormEvent, useState } from "react";
import { buttonClass } from "@/blocks/_v2/button-link";
import { listOf } from "@/blocks/_v2/list";
import {
  type AnswerValue,
  FIELD_CLASS,
  formCopy,
  looksLikeEmail,
  postSubmission,
} from "@/blocks/_v2/submit-form";
import type { PatchFn } from "@/blocks/types";
import { EditableText } from "@/components/editor-shell/canvas/editable-text";
import { usePageFeedSource } from "@/editor/page-feed-context";
import { MAX_VALUE_LENGTH } from "@/editor/submit-rules";
import type {
  FormField,
  FormFieldOption,
  FormStep,
  MultiStepFormBlock,
} from "@/editor/types";

interface Props {
  block: MultiStepFormBlock;
  edit: boolean;
  onPatch: PatchFn;
}

type Status = "idle" | "pending" | "done" | "error";
type Answers = Record<string, AnswerValue>;
type Copy = ReturnType<typeof formCopy>;

const text = (v: unknown): string => (typeof v === "string" ? v : "");

const CHOICE_CLASS = "type-body flex items-center gap-3 text-ink";
const BOX_CLASS =
  "size-5 shrink-0 accent-[var(--color-action)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring";

const fieldsOf = (step: FormStep | undefined): FormField[] =>
  listOf<FormField>(step?.fields).filter(
    (f) => text(f.name) && f.fieldType !== "hidden"
  );

const optionsOf = (field: FormField): FormFieldOption[] =>
  listOf<FormFieldOption>(field.options);

function isEmpty(value: AnswerValue | undefined): boolean {
  if (typeof value === "boolean") {
    return !value;
  }
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  return !value?.trim();
}

/** The names of the step's fields that are required and unanswered, or bad. */
function problemsIn(step: FormStep | undefined, answers: Answers): string[] {
  return fieldsOf(step)
    .filter((field) => {
      const value = answers[field.name];
      if (field.required && isEmpty(value)) {
        return true;
      }
      return (
        field.fieldType === "email" &&
        typeof value === "string" &&
        value.trim() !== "" &&
        !looksLikeEmail(value)
      );
    })
    .map((field) => field.name);
}

interface FieldInputProps {
  answers: Answers;
  baseId: string;
  copy: Copy;
  edit: boolean;
  field: FormField;
  invalid: boolean;
  set: (name: string, value: AnswerValue) => void;
}

function FieldInput({
  answers,
  baseId,
  copy,
  edit,
  field,
  invalid,
  set,
}: FieldInputProps) {
  const id = `${baseId}-${field.name}`;
  const value = answers[field.name];
  const common = {
    "aria-describedby": invalid ? `${id}-err` : undefined,
    "aria-invalid": invalid || undefined,
    id,
    maxLength: MAX_VALUE_LENGTH,
    name: field.name,
    readOnly: edit,
  };

  if (field.fieldType === "textarea") {
    return (
      <textarea
        {...common}
        className={FIELD_CLASS}
        onChange={(e) => set(field.name, e.target.value)}
        placeholder={text(field.placeholder)}
        rows={4}
        value={typeof value === "string" ? value : ""}
      />
    );
  }

  if (field.fieldType === "select") {
    return (
      <select
        aria-describedby={common["aria-describedby"]}
        aria-invalid={common["aria-invalid"]}
        className={FIELD_CLASS}
        id={id}
        name={field.name}
        onChange={(e) => set(field.name, e.target.value)}
        value={typeof value === "string" ? value : ""}
      >
        <option value="">{copy.choose}</option>
        {optionsOf(field).map((option, i) => (
          <option key={i} value={text(option.value)}>
            {text(option.label)}
          </option>
        ))}
      </select>
    );
  }

  if (field.fieldType === "radio") {
    return (
      <div className="flex flex-col gap-2">
        {optionsOf(field).map((option, i) => (
          <label className={CHOICE_CLASS} key={i}>
            <input
              aria-describedby={common["aria-describedby"]}
              aria-invalid={common["aria-invalid"]}
              checked={value === text(option.value)}
              className={BOX_CLASS}
              name={field.name}
              onChange={() => set(field.name, text(option.value))}
              type="radio"
              value={text(option.value)}
            />
            {text(option.label)}
          </label>
        ))}
      </div>
    );
  }

  if (field.fieldType === "checkbox") {
    const options = optionsOf(field);
    // Without options it is one yes/no box; with options, a group of choices.
    if (options.length === 0) {
      return (
        <input
          aria-describedby={common["aria-describedby"]}
          aria-invalid={common["aria-invalid"]}
          checked={value === true}
          className={BOX_CLASS}
          id={id}
          name={field.name}
          onChange={(e) => set(field.name, e.target.checked)}
          type="checkbox"
        />
      );
    }
    const chosen = Array.isArray(value) ? value : [];
    return (
      <div className="flex flex-col gap-2">
        {options.map((option, i) => {
          const optionValue = text(option.value);
          return (
            <label className={CHOICE_CLASS} key={i}>
              <input
                aria-describedby={common["aria-describedby"]}
                aria-invalid={common["aria-invalid"]}
                checked={chosen.includes(optionValue)}
                className={BOX_CLASS}
                name={field.name}
                onChange={(e) =>
                  set(
                    field.name,
                    e.target.checked
                      ? [...chosen, optionValue]
                      : chosen.filter((item) => item !== optionValue)
                  )
                }
                type="checkbox"
                value={optionValue}
              />
              {text(option.label)}
            </label>
          );
        })}
      </div>
    );
  }

  return (
    <input
      {...common}
      className={FIELD_CLASS}
      onChange={(e) => set(field.name, e.target.value)}
      placeholder={text(field.placeholder)}
      type={field.fieldType === "email" ? "email" : "text"}
      value={typeof value === "string" ? value : ""}
    />
  );
}

export function MultiStepFormRender({ block, edit, onPatch }: Props) {
  const { locale, slug } = usePageFeedSource();
  const copy = formCopy(locale);
  const steps = listOf<FormStep>(block.steps);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [problems, setProblems] = useState<string[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const baseId = text(block.id) || "form";
  const at = Math.min(step, Math.max(steps.length - 1, 0));
  const current = steps[at];
  const last = at >= steps.length - 1;
  const heading = text(block.heading);

  const set = (name: string, value: AnswerValue) => {
    setAnswers((previous) => ({ ...previous, [name]: value }));
    setProblems((previous) => previous.filter((item) => item !== name));
  };

  const go = (to: number) => {
    setProblems([]);
    setStep(to);
  };

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (status === "pending") {
      return;
    }
    if (!edit) {
      const found = problemsIn(current, answers);
      if (found.length > 0) {
        setProblems(found);
        return;
      }
    }
    if (!last) {
      go(at + 1);
      return;
    }
    if (edit) {
      return;
    }
    setStatus("pending");
    const names = new Set(steps.flatMap((s) => fieldsOf(s).map((f) => f.name)));
    const data: Answers = {};
    for (const [name, value] of Object.entries(answers)) {
      if (names.has(name)) {
        data[name] = value;
      }
    }
    const ok = await postSubmission({
      blockId: text(block.id),
      data,
      locale,
      slug,
    });
    setStatus(ok ? "done" : "error");
  }

  const title =
    edit || heading.trim() ? (
      <EditableText
        className="type-heading-section m-0 min-w-0 hyphens-auto break-words text-ink"
        edit={edit}
        onChange={(v) => onPatch("heading", v)}
        tag="h2"
        value={heading}
      />
    ) : null;

  if (status === "done") {
    return (
      <div className="flex flex-col gap-4 break-words">
        {title}
        <p className="type-body m-0 text-ink" role="status">
          {copy.formDone}
        </p>
      </div>
    );
  }

  if (!current) {
    return edit ? title : null;
  }

  let submitLabel: string = copy.next;
  if (last) {
    submitLabel = status === "pending" ? copy.sending : copy.submit;
  }

  const updateStepTitle = (value: string) =>
    onPatch(
      "steps",
      steps.map((s, i) => (i === at ? { ...s, title: value } : s))
    );

  return (
    <div className="flex max-w-2xl flex-col gap-6 break-words">
      {title}
      <form className="flex flex-col gap-6" noValidate onSubmit={handleSubmit}>
        <div className="flex flex-col gap-1">
          {steps.length > 1 ? (
            <p className="type-label m-0 text-ink-muted">
              {copy.step(at + 1, steps.length)}
            </p>
          ) : null}
          {edit || text(current.title).trim() ? (
            <EditableText
              className="type-heading-card m-0 min-w-0 break-words text-ink"
              edit={edit}
              onChange={updateStepTitle}
              tag="h3"
              value={text(current.title)}
            />
          ) : null}
        </div>
        {fieldsOf(current).map((field) => {
          const id = `${baseId}-${field.name}`;
          const invalid = problems.includes(field.name);
          const grouped =
            field.fieldType === "radio" ||
            (field.fieldType === "checkbox" && optionsOf(field).length > 0);
          const label = (
            <>
              {text(field.label)}
              {field.required ? <span aria-hidden="true"> *</span> : null}
            </>
          );
          return (
            <div className="flex flex-col gap-2" key={field.name}>
              {grouped ? (
                <fieldset
                  aria-describedby={invalid ? `${id}-err` : undefined}
                  className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0"
                >
                  <legend className="type-label p-0 text-ink">{label}</legend>
                  <FieldInput
                    answers={answers}
                    baseId={baseId}
                    copy={copy}
                    edit={edit}
                    field={field}
                    invalid={invalid}
                    set={set}
                  />
                </fieldset>
              ) : (
                <>
                  <label className="type-label text-ink" htmlFor={id}>
                    {label}
                  </label>
                  <FieldInput
                    answers={answers}
                    baseId={baseId}
                    copy={copy}
                    edit={edit}
                    field={field}
                    invalid={invalid}
                    set={set}
                  />
                </>
              )}
              {invalid ? (
                <p
                  className="type-body-sm m-0 text-danger"
                  id={`${id}-err`}
                  role="alert"
                >
                  {field.fieldType === "email" && !isEmpty(answers[field.name])
                    ? copy.emailInvalid
                    : copy.required}
                </p>
              ) : null}
            </div>
          );
        })}
        {status === "error" ? (
          <p className="type-body-sm m-0 text-danger" role="alert">
            {copy.failed}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-3">
          {at > 0 ? (
            <button
              className={buttonClass("secondary")}
              onClick={() => go(at - 1)}
              type="button"
            >
              {copy.back}
            </button>
          ) : null}
          <button
            className={`${buttonClass("primary")} disabled:opacity-60`}
            disabled={status === "pending"}
            type="submit"
          >
            {submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
