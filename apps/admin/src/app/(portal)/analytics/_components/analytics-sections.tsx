import type { ReactNode } from "react";
import type { UmamiMetricItem } from "@/lib/umami/client";
import type { MemberPanelRow } from "@/lib/umami/members";
import { MONO_STACK, STUDIO, studioSurface } from "../../_components/studio";

export function SectionCard({
  title,
  subtitle,
  children,
}: {
  children: ReactNode;
  subtitle?: string;
  title: ReactNode;
}) {
  return (
    <div className="rounded-2xl p-6" style={studioSurface}>
      <div className="mb-4">
        <h3 className="font-medium text-sm" style={{ color: STUDIO.ink }}>
          {title}
        </h3>
        {subtitle && (
          <p className="mt-0.5 text-xs" style={{ color: STUDIO.ink4 }}>
            {subtitle}
          </p>
        )}
      </div>
      {children}
    </div>
  );
}

function EmptyRow({ label }: { label: string }) {
  return (
    <p className="py-6 text-center text-sm" style={{ color: STUDIO.ink4 }}>
      {label}
    </p>
  );
}

/** Top pages / referrers / events list. */
export function MetricList({
  items,
  emptyLabel,
}: {
  emptyLabel: string;
  items: UmamiMetricItem[];
}) {
  if (items.length === 0) {
    return <EmptyRow label={emptyLabel} />;
  }
  const max = Math.max(...items.map((i) => i.y), 1);
  return (
    <div>
      {items.map((item) => (
        <div
          className="flex items-center gap-3 py-2.5"
          key={item.x}
          style={{ borderTop: `0.5px solid ${STUDIO.rule}` }}
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm" style={{ color: STUDIO.ink2 }}>
              {item.x || "/"}
            </p>
            <div
              className="mt-1.5 h-1 rounded-full"
              style={{ background: STUDIO.rule, width: "100%" }}
            >
              <div
                className="h-1 rounded-full"
                style={{
                  background: STUDIO.claret,
                  width: `${Math.max(4, Math.round((item.y / max) * 100))}%`,
                }}
              />
            </div>
          </div>
          <span
            className="shrink-0 text-sm tabular-nums"
            style={{ color: STUDIO.ink, fontFamily: MONO_STACK }}
          >
            {item.y}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Identified-members panel (resolved name + visit/view counts). */
export function MembersList({
  members,
  emptyLabel,
  visitsLabel,
  viewsLabel,
}: {
  emptyLabel: string;
  members: MemberPanelRow[];
  visitsLabel: string;
  viewsLabel: string;
}) {
  if (members.length === 0) {
    return <EmptyRow label={emptyLabel} />;
  }
  return (
    <div>
      {members.map((member) => {
        const initials = member.name
          .split(" ")
          .map((part) => part[0])
          .join("")
          .toUpperCase()
          .slice(0, 2);
        return (
          <div
            className="flex items-center gap-3 py-2.5"
            key={member.id}
            style={{ borderTop: `0.5px solid ${STUDIO.rule}` }}
          >
            <span
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full font-semibold text-[11px]"
              style={{ background: STUDIO.claret, color: STUDIO.paper }}
            >
              {initials || "?"}
            </span>
            <p
              className="min-w-0 flex-1 truncate text-sm"
              style={{ color: STUDIO.ink }}
            >
              {member.name}
            </p>
            <span
              className="shrink-0 text-xs tabular-nums"
              style={{ color: STUDIO.ink3, fontFamily: MONO_STACK }}
            >
              {member.visits} {visitsLabel} · {member.views} {viewsLabel}
            </span>
          </div>
        );
      })}
    </div>
  );
}
