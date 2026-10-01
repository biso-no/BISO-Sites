import { PortalInput } from "./portal-fields";
import { STUDIO } from "./studio";

interface VersionInputProps {
  disabled?: boolean;
  onBlur?: () => void;
  onChange: (value: string) => void;
  value: string;
}

/** Numeric version field with a fixed "v" attached, like a dialling prefix. */
export function VersionInput({
  disabled,
  onBlur,
  onChange,
  value,
}: VersionInputProps) {
  return (
    <div className="flex">
      <span
        aria-hidden="true"
        className="flex select-none items-center rounded-l-lg px-3 text-sm"
        style={{
          background: "rgba(255,255,255,0.4)",
          border: `0.5px solid ${STUDIO.rule2}`,
          borderRight: "none",
          color: STUDIO.ink3,
        }}
      >
        v
      </span>
      <PortalInput
        aria-label="Version number"
        className="rounded-l-none"
        disabled={disabled}
        inputMode="decimal"
        onBlur={onBlur}
        onChange={(e) => onChange(e.target.value)}
        placeholder="12"
        value={value}
      />
    </div>
  );
}
