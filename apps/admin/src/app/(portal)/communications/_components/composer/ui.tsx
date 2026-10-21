import {
  AlertTriangle,
  Briefcase,
  Bus,
  CalendarDays,
  Megaphone,
  Newspaper,
} from "lucide-react";
import type { ContentLocale } from "@/lib/content-translation";
import type { ComposerTypeId } from "./composer-state";

export const BRAND = {
  bisoBlue: "#1A77E9",
  claret: "#6b1e1e",
  gold: "#b08a3e",
  green: "#2f5d3a",
  ink: "#1a1814",
  ink2: "#3a342a",
  ink3: "#6b6357",
  ink4: "#9c9385",
  leaf: "#2f5d3a",
  paper: "#faf7f2",
  paper2: "#f3eee5",
  paper3: "#ede6d8",
  red: "#b91c1c",
  rule: "#e5dcca",
  rule2: "#d8cdb6",
} as const;

export const SERIF = "'Instrument Serif', Georgia, serif";
export const MONO = "ui-monospace, Menlo, Monaco, monospace";

export type LocaleCode = ContentLocale;

export function LocaleTabs({
  locale,
  pendingNo,
  setLocale,
}: {
  locale: LocaleCode;
  pendingNo: boolean;
  setLocale: (locale: LocaleCode) => void;
}) {
  return (
    <div
      style={{
        background: BRAND.paper2,
        border: `0.5px solid ${BRAND.rule2}`,
        borderRadius: 8,
        display: "inline-flex",
        gap: 2,
        marginBottom: 8,
        padding: 3,
      }}
    >
      {(["no", "en"] as const).map((item) => {
        const on = locale === item;
        return (
          <button
            key={item}
            onClick={() => setLocale(item)}
            style={{
              alignItems: "center",
              background: on ? "white" : "transparent",
              border: 0,
              borderRadius: 5,
              boxShadow: on ? "0 1px 2px rgba(0,0,0,.05)" : "none",
              color: on ? BRAND.ink : BRAND.ink3,
              cursor: "pointer",
              display: "flex",
              fontSize: 11,
              gap: 6,
              padding: "4px 12px",
            }}
            type="button"
          >
            {item === "en" ? "English" : "Norsk"}
            {item === "no" && pendingNo && (
              <span
                style={{
                  background: BRAND.gold,
                  borderRadius: "50%",
                  height: 5,
                  width: 5,
                }}
                title="Not yet filled"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

export function FieldLabel({
  children,
  help,
  required,
}: {
  children: React.ReactNode;
  help?: string;
  required?: boolean;
}) {
  return (
    <div
      style={{
        alignItems: "center",
        color: BRAND.ink3,
        display: "flex",
        fontSize: 11.5,
        fontWeight: 500,
        gap: 8,
        letterSpacing: ".04em",
        textTransform: "uppercase",
      }}
    >
      {children}
      {required && (
        <span style={{ color: BRAND.claret, fontSize: 10 }}>required</span>
      )}
      {help && (
        <span
          style={{
            color: BRAND.ink4,
            fontSize: 10.5,
            fontWeight: 400,
            letterSpacing: 0,
            marginLeft: "auto",
            textTransform: "none",
          }}
        >
          {help}
        </span>
      )}
    </div>
  );
}

export function fieldInputStyle(
  extra?: React.CSSProperties
): React.CSSProperties {
  return {
    appearance: "none",
    background: "rgba(255,255,255,.6)",
    border: `0.5px solid ${BRAND.rule2}`,
    borderRadius: 8,
    color: BRAND.ink,
    fontSize: 14,
    outline: 0,
    padding: "10px 12px",
    transition: "border-color .15s, background .15s",
    width: "100%",
    ...extra,
  };
}

export function StepIntro({
  eyebrow,
  title,
}: {
  eyebrow: string;
  title: string;
}) {
  return (
    <div style={{ padding: "8px 0 18px" }}>
      <span
        style={{
          color: BRAND.ink4,
          fontSize: 11,
          letterSpacing: ".08em",
          textTransform: "uppercase",
        }}
      >
        {eyebrow}
      </span>
      <div
        style={{
          color: BRAND.ink,
          fontFamily: SERIF,
          fontSize: 40,
          letterSpacing: "-0.015em",
          lineHeight: 1.05,
          marginTop: 4,
        }}
      >
        {title}
      </div>
    </div>
  );
}
export const TYPE_ICONS: Record<ComposerTypeId, typeof Megaphone> = {
  event: CalendarDays,
  general: Megaphone,
  job: Briefcase,
  news: Newspaper,
  trip: Bus,
  urgent: AlertTriangle,
};

/** A rounded toggle used for campus and topic choices. */
export function Pill({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      aria-pressed={active}
      onClick={onClick}
      style={{
        background: active ? BRAND.ink : "white",
        border: `1px solid ${active ? BRAND.ink : BRAND.rule2}`,
        borderRadius: 999,
        color: active ? "white" : BRAND.ink,
        cursor: "pointer",
        fontSize: 12.5,
        padding: "5px 11px",
        transition: "background .12s, border-color .12s",
      }}
      type="button"
    >
      {children}
    </button>
  );
}
