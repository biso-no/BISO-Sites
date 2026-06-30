"use client";

import { ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { setCampusFilter } from "@/lib/actions/campus";
import { STUDIO } from "./studio";

interface CampusSwitcherProps {
  availableCampuses: string[];
  canSwitch: boolean;
  currentCampus: string;
  roleLabel: string;
}

function campusInitial(name: string): string {
  if (name === "All Campuses") {
    return "·";
  }
  return name.charAt(0).toUpperCase();
}

function campusAvatarBg(name: string): string {
  if (name === "All Campuses") {
    return STUDIO.ink2;
  }
  return STUDIO.claret;
}

export function CampusSwitcher({
  availableCampuses,
  canSwitch,
  currentCampus,
  roleLabel,
}: CampusSwitcherProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) {
      return;
    }
    function handlePointerDown(e: PointerEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  async function handleSelect(campus: string) {
    setOpen(false);
    await setCampusFilter(campus === "All Campuses" ? null : campus);
    router.refresh();
  }

  const options = ["All Campuses", ...availableCampuses];

  return (
    <div
      data-tour="campus-switcher"
      ref={containerRef}
      style={{ marginBottom: "16px", position: "relative" }}
    >
      <button
        className="flex w-full items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition"
        onClick={() => {
          if (canSwitch) {
            setOpen((p) => !p);
          }
        }}
        style={{
          background: "rgba(255,255,255,0.48)",
          borderColor: STUDIO.rule2,
          cursor: canSwitch ? "pointer" : "default",
        }}
        type="button"
      >
        <span
          className="grid h-6 w-6 shrink-0 place-items-center rounded-md font-semibold text-[11px]"
          style={{
            background: campusAvatarBg(currentCampus),
            color: STUDIO.paper,
          }}
        >
          {campusInitial(currentCampus)}
        </span>
        <span className="min-w-0 flex-1 leading-tight">
          <span
            className="block truncate text-xs"
            style={{ color: STUDIO.ink }}
          >
            {currentCampus}
          </span>
          <span
            className="block truncate text-[10px]"
            style={{ color: STUDIO.ink3 }}
          >
            {roleLabel}
          </span>
        </span>
        {canSwitch && (
          <ChevronDown
            size={14}
            style={{
              color: STUDIO.ink3,
              flexShrink: 0,
              transform: open ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 150ms",
            }}
          />
        )}
      </button>

      {open && (
        <div
          style={{
            background: "white",
            border: `0.5px solid ${STUDIO.rule2}`,
            borderRadius: "12px",
            boxShadow:
              "0 8px 24px rgba(0,0,0,0.10), 0 2px 6px rgba(0,0,0,0.06)",
            left: 0,
            overflow: "hidden",
            position: "absolute",
            right: 0,
            top: "calc(100% + 4px)",
            zIndex: 50,
          }}
        >
          <p
            style={{
              color: STUDIO.ink4,
              fontSize: "10px",
              fontWeight: 500,
              letterSpacing: "0.08em",
              padding: "10px 12px 6px",
              textTransform: "uppercase",
            }}
          >
            Switch campus
          </p>
          {options.map((campus) => {
            const isActive = campus === currentCampus;
            return (
              <button
                key={campus}
                onClick={() => handleSelect(campus)}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = STUDIO.paper2;
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = isActive
                    ? "rgba(26,24,20,0.05)"
                    : "transparent";
                }}
                style={{
                  alignItems: "center",
                  background: isActive ? "rgba(26,24,20,0.05)" : "transparent",
                  border: 0,
                  cursor: "pointer",
                  display: "flex",
                  fontSize: "13px",
                  gap: "10px",
                  padding: "9px 12px",
                  textAlign: "left",
                  width: "100%",
                }}
                type="button"
              >
                <span
                  style={{
                    background: campusAvatarBg(campus),
                    borderRadius: "6px",
                    color: STUDIO.paper,
                    display: "grid",
                    flexShrink: 0,
                    fontSize: "11px",
                    fontWeight: 600,
                    height: "22px",
                    placeItems: "center",
                    width: "22px",
                  }}
                >
                  {campusInitial(campus)}
                </span>
                <span style={{ color: STUDIO.ink, flex: 1 }}>{campus}</span>
                {isActive && (
                  <span style={{ color: STUDIO.ink4, fontSize: "11px" }}>
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
