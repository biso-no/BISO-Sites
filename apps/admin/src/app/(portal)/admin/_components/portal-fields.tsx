import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

const INPUT_BASE =
  "w-full px-3 py-2.5 text-sm rounded-xl outline-none transition-all";
const INPUT_STYLE: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  color: "#fff",
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
        <label
          className="font-medium text-xs"
          style={{ color: "rgba(255,255,255,0.60)" }}
        >
          {label}
          {required && (
            <span className="ml-1" style={{ color: "#f87171" }}>
              *
            </span>
          )}
        </label>
      )}
      {children}
      {hint && !error && (
        <p className="text-xs" style={{ color: "rgba(255,255,255,0.30)" }}>
          {hint}
        </p>
      )}
      {error && (
        <p className="text-xs" style={{ color: "#f87171" }}>
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
          ? "rgba(248,113,113,0.50)"
          : "rgba(255,255,255,0.08)";
        props.onBlur?.(e);
      }}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = error
          ? "rgba(248,113,113,0.70)"
          : "rgba(61,169,224,0.50)";
        props.onFocus?.(e);
      }}
      style={{
        ...INPUT_STYLE,
        ...(error ? { borderColor: "rgba(248,113,113,0.50)" } : {}),
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
          ? "rgba(248,113,113,0.50)"
          : "rgba(255,255,255,0.08)";
        props.onBlur?.(e);
      }}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = error
          ? "rgba(248,113,113,0.70)"
          : "rgba(61,169,224,0.50)";
        props.onFocus?.(e);
      }}
      style={{
        ...INPUT_STYLE,
        ...(error ? { borderColor: "rgba(248,113,113,0.50)" } : {}),
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
          ? "rgba(248,113,113,0.50)"
          : "rgba(255,255,255,0.08)";
        props.onBlur?.(e);
      }}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = error
          ? "rgba(248,113,113,0.70)"
          : "rgba(61,169,224,0.50)";
        props.onFocus?.(e);
      }}
      style={{
        ...INPUT_STYLE,
        ...(error ? { borderColor: "rgba(248,113,113,0.50)" } : {}),
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
          style={{ background: "#000a16" }}
          value={opt.value}
        >
          {opt.label}
        </option>
      ))}
    </select>
  );
}
