import type { CSSProperties, ReactNode } from "react";
import { STUDIO } from "../../_components/studio";
import {
  fieldInputStyle,
  Pill,
} from "../../communications/_components/composer/ui";
import { BOARD_FOCUS_RING } from "../_lib/board-styles";

/** Error text on the panel's paper: 6.4:1. */
export const PANEL_ERROR_COLOR = "#b91c1c";

/** The composer's field look on white, without its `outline: 0`. */
export const panelInputStyle: CSSProperties = fieldInputStyle({
  background: "#fff",
  outline: undefined,
});

/** Visible focus, and a calm look when the item is read-only. */
export const PANEL_INPUT_CLASS = `${BOARD_FOCUS_RING} disabled:cursor-not-allowed disabled:opacity-60`;

const QUESTION_CLASS =
  "mb-2 flex flex-wrap items-baseline gap-x-2 font-semibold text-[13.5px] leading-5";

function QuestionText({
  children,
  help,
}: {
  children: ReactNode;
  help?: string;
}) {
  return (
    <>
      {children}
      {help ? (
        <span
          className="font-normal text-[12.5px]"
          style={{ color: STUDIO.ink3 }}
        >
          {help}
        </span>
      ) : null}
    </>
  );
}

/** A question that names one control, as its `<label>`. */
export function PanelLabel({
  children,
  help,
  htmlFor,
}: {
  children: ReactNode;
  help?: string;
  htmlFor: string;
}) {
  return (
    <label
      className={QUESTION_CLASS}
      htmlFor={htmlFor}
      style={{ color: STUDIO.ink }}
    >
      <QuestionText help={help}>{children}</QuestionText>
    </label>
  );
}

/** A question that names a group of choices through `aria-labelledby`. */
export function PanelQuestion({
  children,
  help,
  id,
}: {
  children: ReactNode;
  help?: string;
  id: string;
}) {
  return (
    <p className={QUESTION_CLASS} id={id} style={{ color: STUDIO.ink }}>
      <QuestionText help={help}>{children}</QuestionText>
    </p>
  );
}

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) {
    return null;
  }
  return (
    <p
      className="mt-1.5 text-[13px] leading-5"
      id={id}
      style={{ color: PANEL_ERROR_COLOR }}
    >
      {message}
    </p>
  );
}

/** What an input with a possible error under it needs for screen readers. */
export function errorProps(
  errorId: string,
  message: string | undefined
): { "aria-describedby"?: string; "aria-invalid"?: true } {
  return message ? { "aria-describedby": errorId, "aria-invalid": true } : {};
}

export interface Choice<T extends string> {
  label: string;
  value: T;
}

/**
 * A question answered by a row of toggle buttons, exactly one of them on.
 * The question is the fieldset's legend, so each button is read with it.
 */
export function ChoiceGroup<T extends string>({
  choices,
  disabled,
  legend,
  onChange,
  value,
}: {
  choices: Choice<T>[];
  disabled: boolean;
  legend: string;
  onChange: (value: T) => void;
  value: T;
}) {
  return (
    <fieldset className="m-0 min-w-0 border-0 p-0">
      <legend
        className="p-0 pb-2 font-semibold text-[13.5px] leading-5"
        style={{ color: STUDIO.ink }}
      >
        {legend}
      </legend>
      <div className="flex flex-wrap gap-2">
        {choices.map((choice) => (
          <Pill
            active={choice.value === value}
            className={BOARD_FOCUS_RING}
            disabled={disabled}
            key={choice.value}
            onClick={() => onChange(choice.value)}
          >
            {choice.label}
          </Pill>
        ))}
      </div>
    </fieldset>
  );
}
