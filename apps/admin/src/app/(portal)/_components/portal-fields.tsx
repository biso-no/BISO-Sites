import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { STUDIO } from "./studio";

const INPUT_BASE =
  "w-full px-3 py-2.5 text-sm rounded-lg outline-none transition-all";
const INPUT_STYLE: React.CSSProperties = {
  background: "rgba(255,255,255,0.62)",
  border: `0.5px solid ${STUDIO.rule2}`,
  color: STUDIO.ink,
};

interface FieldProps {
  children: ReactNode;
  error?: string;
  hint?: string;
  label?: string;
  required?: boolean;
}

export function PortalField({
  label,
  error,
  hint,
  required,
  children,
}: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <span
          className="font-medium text-[11px] uppercase tracking-[0.06em]"
          style={{ color: STUDIO.ink3 }}
        >
          {label}
          {required && (
            <span className="ml-1" style={{ color: STUDIO.claret }}>
              *
            </span>
          )}
        </span>
      )}
      {children}
      {hint && !error && (
        <p className="text-xs" style={{ color: STUDIO.ink4 }}>
          {hint}
        </p>
      )}
      {error && (
        <p className="text-xs" style={{ color: STUDIO.claret }}>
          {error}
        </p>
      )}
    </div>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  error?: boolean;
};

export function PortalInput({
  error,
  className = "",
  style,
  ...props
}: InputProps) {
  return (
    <input
      className={`${INPUT_BASE} ${className}`}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = error
          ? "rgba(107,30,30,0.50)"
          : STUDIO.rule2;
        props.onBlur?.(e);
      }}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = error
          ? "rgba(107,30,30,0.70)"
          : STUDIO.claret;
        props.onFocus?.(e);
      }}
      style={{
        ...INPUT_STYLE,
        ...(error ? { borderColor: "rgba(107,30,30,0.50)" } : {}),
        ...style,
      }}
      {...props}
    />
  );
}

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  error?: boolean;
};

export function PortalTextarea({
  error,
  className = "",
  style,
  ...props
}: TextareaProps) {
  return (
    <textarea
      className={`${INPUT_BASE} resize-none ${className}`}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = error
          ? "rgba(107,30,30,0.50)"
          : STUDIO.rule2;
        props.onBlur?.(e);
      }}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = error
          ? "rgba(107,30,30,0.70)"
          : STUDIO.claret;
        props.onFocus?.(e);
      }}
      style={{
        ...INPUT_STYLE,
        ...(error ? { borderColor: "rgba(107,30,30,0.50)" } : {}),
        ...style,
      }}
      {...props}
    />
  );
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  error?: boolean;
  options: { value: string; label: string }[];
  placeholder?: string;
};

export function PortalSelect({
  error,
  options,
  placeholder,
  className = "",
  style,
  ...props
}: SelectProps) {
  return (
    <select
      className={`${INPUT_BASE} ${className}`}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = error
          ? "rgba(107,30,30,0.50)"
          : STUDIO.rule2;
        props.onBlur?.(e);
      }}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = error
          ? "rgba(107,30,30,0.70)"
          : STUDIO.claret;
        props.onFocus?.(e);
      }}
      style={{
        ...INPUT_STYLE,
        ...(error ? { borderColor: "rgba(107,30,30,0.50)" } : {}),
        ...style,
      }}
      {...props}
    >
      {placeholder && (
        <option disabled value="">
          {placeholder}
        </option>
      )}
      {options.map((opt) => (
        <option
          key={opt.value}
          style={{ background: STUDIO.paper }}
          value={opt.value}
        >
          {opt.label}
        </option>
      ))}
    </select>
  );
}
