"use client";

import type { EventAttendees } from "@repo/api/types/appwrite";
import { Check, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import {
  assignToSegment,
  autoAssign,
  importAttendeesCsv,
} from "../../../../_actions/event-segments";
import { PortalButton } from "../../../../_components/portal-button";
import {
  PortalField,
  PortalSelect,
  PortalTextarea,
} from "../../../../_components/portal-fields";
import { STUDIO, studioInsetSurface } from "../../../../_components/studio";
import type { SegmentWithCount } from "./types";

interface AttendeePanelProps {
  attendees: EventAttendees[];
  eventId: string;
  onChanged: () => void;
  segments: SegmentWithCount[];
}

export function AttendeePanel({
  attendees,
  eventId,
  onChanged,
  segments,
}: AttendeePanelProps) {
  const [csvText, setCsvText] = useState("");
  const [importing, setImporting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [targetSegment, setTargetSegment] = useState("");
  const [assigning, setAssigning] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const transportKind = segments[0]?.kind ?? "transport";

  const handleFile = async (file: File) => {
    const text = await file.text();
    setCsvText(text);
  };

  const handleImport = async () => {
    if (!csvText.trim()) {
      setError("Paste CSV text or choose a file first.");
      return;
    }
    setImporting(true);
    setError(null);
    setStatus(null);
    const result = await importAttendeesCsv(eventId, csvText);
    setImporting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.data) {
      setStatus(
        `Imported ${result.data.imported}, matched ${result.data.matched}, skipped ${result.data.skipped}.`
      );
      setCsvText("");
      onChanged();
    }
  };

  const handleAutoAssign = async () => {
    setAssigning(true);
    setError(null);
    setStatus(null);
    const result = await autoAssign(eventId, { kind: transportKind });
    setAssigning(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.data) {
      const total = result.data.segments.reduce(
        (sum, segment) => sum + segment.assigned,
        0
      );
      setStatus(
        `Auto-assigned ${total} attendee(s); ${result.data.unassigned} left unassigned.`
      );
      onChanged();
    }
  };

  const toggle = (userId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const handleManualAssign = async () => {
    if (!targetSegment) {
      setError("Choose a segment to assign to.");
      return;
    }
    const userIds = Array.from(selected);
    if (userIds.length === 0) {
      setError("Select at least one matched attendee.");
      return;
    }
    setAssigning(true);
    setError(null);
    setStatus(null);
    const result = await assignToSegment(targetSegment, userIds);
    setAssigning(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.data) {
      setStatus(
        `Assigned ${result.data.assigned}, skipped ${result.data.skipped}, full ${result.data.rejected}.`
      );
      setSelected(new Set());
      onChanged();
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div
        className="flex flex-col gap-3 rounded-xl p-4"
        style={studioInsetSurface}
      >
        <PortalField
          hint="Columns: email, name, phone, ticket_type, order_ref (order/case tolerant)"
          label="Import attendees (CSV)"
        >
          <PortalTextarea
            onChange={(e) => setCsvText(e.target.value)}
            placeholder="email,name,ticket_type,order_ref&#10;ola@bi.no,Ola,Standard,A-1001"
            rows={4}
            value={csvText}
          />
        </PortalField>
        <div className="flex flex-wrap items-center gap-2">
          <input
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                handleFile(file);
              }
            }}
            ref={fileRef}
            type="file"
          />
          <PortalButton
            onClick={() => fileRef.current?.click()}
            size="sm"
            variant="secondary"
          >
            <Upload size={13} /> Choose file
          </PortalButton>
          <PortalButton
            loading={importing}
            onClick={handleImport}
            size="sm"
            variant="primary"
          >
            Import
          </PortalButton>
          <PortalButton
            loading={assigning}
            onClick={handleAutoAssign}
            size="sm"
            variant="secondary"
          >
            Auto-assign ({transportKind})
          </PortalButton>
        </div>
        {status && (
          <p className="text-xs" style={{ color: STUDIO.leaf }}>
            {status}
          </p>
        )}
        {error && (
          <p className="text-xs" style={{ color: STUDIO.claret }}>
            {error}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-48 flex-1">
          <PortalField label="Assign selected to">
            <PortalSelect
              onChange={(e) => setTargetSegment(e.target.value)}
              options={segments.map((segment) => ({
                label: `${segment.name} (${segment.member_count}${segment.capacity ? `/${segment.capacity}` : ""})`,
                value: segment.$id,
              }))}
              placeholder="Choose a segment"
              value={targetSegment}
            />
          </PortalField>
        </div>
        <PortalButton
          loading={assigning}
          onClick={handleManualAssign}
          variant="primary"
        >
          Assign {selected.size > 0 ? `(${selected.size})` : ""}
        </PortalButton>
      </div>

      <AttendeeTable
        attendees={attendees}
        onToggle={toggle}
        selected={selected}
      />
    </div>
  );
}

function AttendeeTable({
  attendees,
  onToggle,
  selected,
}: {
  attendees: EventAttendees[];
  onToggle: (userId: string) => void;
  selected: Set<string>;
}) {
  if (attendees.length === 0) {
    return (
      <p className="text-sm" style={{ color: STUDIO.ink4 }}>
        No attendees imported yet.
      </p>
    );
  }

  return (
    <div
      className="overflow-hidden rounded-xl"
      style={{ border: `0.5px solid ${STUDIO.rule2}` }}
    >
      <table className="w-full text-left text-sm">
        <thead>
          <tr style={{ background: STUDIO.paper2, color: STUDIO.ink3 }}>
            <th className="px-3 py-2 font-medium">Pick</th>
            <th className="px-3 py-2 font-medium">Name</th>
            <th className="px-3 py-2 font-medium">Email</th>
            <th className="px-3 py-2 font-medium">Ticket</th>
            <th className="px-3 py-2 font-medium">Matched</th>
          </tr>
        </thead>
        <tbody>
          {attendees.map((attendee) => {
            const matched = Boolean(attendee.matched_user_id);
            const userId = attendee.matched_user_id ?? "";
            return (
              <tr
                key={attendee.$id}
                style={{ borderTop: `0.5px solid ${STUDIO.rule}` }}
              >
                <td className="px-3 py-2">
                  <input
                    aria-label={`Select ${attendee.name ?? attendee.email ?? "attendee"}`}
                    checked={selected.has(userId)}
                    disabled={!matched}
                    onChange={() => onToggle(userId)}
                    type="checkbox"
                  />
                </td>
                <td className="px-3 py-2" style={{ color: STUDIO.ink }}>
                  {attendee.name ?? "—"}
                </td>
                <td className="px-3 py-2" style={{ color: STUDIO.ink3 }}>
                  {attendee.email ?? "—"}
                </td>
                <td className="px-3 py-2" style={{ color: STUDIO.ink3 }}>
                  {attendee.ticket_type ?? "—"}
                </td>
                <td className="px-3 py-2">
                  {matched ? (
                    <Check color={STUDIO.leaf} size={15} />
                  ) : (
                    <X color={STUDIO.ink4} size={15} />
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
