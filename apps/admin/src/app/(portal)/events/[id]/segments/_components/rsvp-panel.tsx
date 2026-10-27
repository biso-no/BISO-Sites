import type { EventRsvpStatus } from "@repo/shared/utils/event-rsvp";
import { CalendarCheck } from "lucide-react";
import type { EventRsvpEntry } from "../../../../_actions/event-segments";
import { STUDIO, StudioPanel } from "../../../../_components/studio";

const STATUS_ORDER: Record<EventRsvpStatus, number> = {
  going: 0,
  maybe: 1,
  not_going: 2,
};

const STATUS_LABEL: Record<EventRsvpStatus, string> = {
  going: "Going",
  maybe: "Maybe",
  not_going: "Not going",
};

const ANSWERED_FORMAT = new Intl.DateTimeFormat("nb-NO", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function sortRsvpEntries(entries: EventRsvpEntry[]): EventRsvpEntry[] {
  return [...entries].sort((a, b) => {
    const byStatus = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    if (byStatus !== 0) {
      return byStatus;
    }
    if (a.name === null && b.name === null) {
      return 0;
    }
    if (a.name === null) {
      return 1;
    }
    if (b.name === null) {
      return -1;
    }
    return a.name.localeCompare(b.name, "nb");
  });
}

function formatAnswered(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : ANSWERED_FORMAT.format(date);
}

export function RsvpPanel({ entries }: { entries: EventRsvpEntry[] }) {
  const count = (status: EventRsvpStatus) =>
    entries.filter((entry) => entry.status === status).length;
  const summary = `${count("going")} going · ${count("maybe")} maybe · ${count("not_going")} not going`;

  return (
    <StudioPanel className="mt-8 p-5">
      <div className="mb-4 flex items-center gap-2">
        <CalendarCheck color={STUDIO.claret} size={16} />
        <h2 className="font-medium text-sm" style={{ color: STUDIO.ink }}>
          RSVPs
        </h2>
      </div>
      {entries.length === 0 ? (
        <p className="text-sm" style={{ color: STUDIO.ink4 }}>
          No one has answered yet.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm" style={{ color: STUDIO.ink3 }}>
            {summary}
          </p>
          <div
            className="overflow-hidden rounded-xl"
            style={{ border: `0.5px solid ${STUDIO.rule2}` }}
          >
            <table className="w-full text-left text-sm">
              <thead>
                <tr style={{ background: STUDIO.paper2, color: STUDIO.ink3 }}>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Email</th>
                  <th className="px-3 py-2 font-medium">Answer</th>
                  <th className="px-3 py-2 font-medium">Answered</th>
                </tr>
              </thead>
              <tbody>
                {sortRsvpEntries(entries).map((entry) => (
                  <tr
                    key={entry.userId}
                    style={{ borderTop: `0.5px solid ${STUDIO.rule}` }}
                  >
                    <td className="px-3 py-2" style={{ color: STUDIO.ink }}>
                      {entry.name ?? "Unknown student"}
                    </td>
                    <td className="px-3 py-2" style={{ color: STUDIO.ink3 }}>
                      {entry.email ?? "—"}
                    </td>
                    <td className="px-3 py-2" style={{ color: STUDIO.ink3 }}>
                      {STATUS_LABEL[entry.status]}
                    </td>
                    <td className="px-3 py-2" style={{ color: STUDIO.ink3 }}>
                      {formatAnswered(entry.updatedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </StudioPanel>
  );
}
