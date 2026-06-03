"use client";

import { useState } from "react";
import { PortalButton } from "../../../../_components/portal-button";
import {
  PortalField,
  PortalInput,
  PortalTextarea,
} from "../../../../_components/portal-fields";
import { STUDIO } from "../../../../_components/studio";
import type { SegmentFormState } from "./types";

interface SegmentFormProps {
  initial?: SegmentFormState;
  onCancel: () => void;
  onSubmit: (values: SegmentFormState) => Promise<void>;
  submitLabel: string;
}

const EMPTY: SegmentFormState = {
  name: "",
  kind: "transport",
  capacity: 0,
  departure_time: "",
  pickup_location: "",
  hotel: "",
  room_number: "",
  notes: "",
};

export function SegmentForm({
  initial,
  onCancel,
  onSubmit,
  submitLabel,
}: SegmentFormProps) {
  const [values, setValues] = useState<SegmentFormState>(initial ?? EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (patch: Partial<SegmentFormState>) =>
    setValues((prev) => ({ ...prev, ...patch }));

  const handleSubmit = async () => {
    if (!values.name.trim()) {
      setError("Name is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit(values);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <PortalField label="Name" required>
          <PortalInput
            onChange={(e) => update({ name: e.target.value })}
            placeholder="Bus 1 / Room 204"
            value={values.name}
          />
        </PortalField>
        <PortalField hint="e.g. transport, lodging, group" label="Kind">
          <PortalInput
            onChange={(e) => update({ kind: e.target.value })}
            placeholder="transport"
            value={values.kind}
          />
        </PortalField>
        <PortalField hint="0 means unlimited" label="Capacity">
          <PortalInput
            min={0}
            onChange={(e) => update({ capacity: Number(e.target.value) || 0 })}
            type="number"
            value={String(values.capacity)}
          />
        </PortalField>
        <PortalField label="Departure time">
          <PortalInput
            onChange={(e) => update({ departure_time: e.target.value })}
            placeholder="08:30, Mon 12 May"
            value={values.departure_time}
          />
        </PortalField>
        <PortalField label="Pickup location">
          <PortalInput
            onChange={(e) => update({ pickup_location: e.target.value })}
            placeholder="Main entrance"
            value={values.pickup_location}
          />
        </PortalField>
        <PortalField label="Hotel">
          <PortalInput
            onChange={(e) => update({ hotel: e.target.value })}
            value={values.hotel}
          />
        </PortalField>
        <PortalField label="Room number">
          <PortalInput
            onChange={(e) => update({ room_number: e.target.value })}
            value={values.room_number}
          />
        </PortalField>
      </div>
      <PortalField label="Notes">
        <PortalTextarea
          onChange={(e) => update({ notes: e.target.value })}
          rows={3}
          value={values.notes}
        />
      </PortalField>

      {error && (
        <p className="text-xs" style={{ color: STUDIO.claret }}>
          {error}
        </p>
      )}

      <div className="flex items-center justify-end gap-2">
        <PortalButton onClick={onCancel} variant="ghost">
          Cancel
        </PortalButton>
        <PortalButton loading={saving} onClick={handleSubmit} variant="primary">
          {submitLabel}
        </PortalButton>
      </div>
    </div>
  );
}
