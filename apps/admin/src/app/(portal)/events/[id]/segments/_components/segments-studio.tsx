"use client";

import type { EventAttendees } from "@repo/api/types/appwrite";
import {
  ArrowLeft,
  MapPin,
  MessageSquare,
  Pencil,
  Plus,
  Send,
  Trash2,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { parseSegmentMetadata } from "@/lib/segments/types";
import {
  createSegment,
  deleteSegment,
  updateSegment,
} from "../../../../_actions/event-segments";
import type { SegmentFormValues } from "../../../../_actions/schemas";
import { PortalButton } from "../../../../_components/portal-button";
import {
  STUDIO,
  StudioCard,
  StudioPageHeader,
  StudioPanel,
} from "../../../../_components/studio";
import { AttendeePanel } from "./attendee-panel";
import { MessageComposer } from "./message-composer";
import { SegmentForm } from "./segment-form";
import type { SegmentFormState, SegmentWithCount } from "./types";

interface SegmentsStudioProps {
  attendees: EventAttendees[];
  campusId: string | null;
  eventId: string;
  eventTitle: string;
  segments: SegmentWithCount[];
}

function toFormState(segment: SegmentWithCount): SegmentFormState {
  const meta = parseSegmentMetadata(segment.metadata);
  return {
    name: segment.name,
    kind: segment.kind ?? "transport",
    capacity: segment.capacity ?? 0,
    departure_time: meta.departure_time ?? "",
    pickup_location: meta.pickup_location ?? "",
    hotel: meta.hotel ?? "",
    room_number: meta.room_number ?? "",
    notes: meta.notes ?? "",
  };
}

function toFormValues(
  state: SegmentFormState,
  eventId: string,
  campusId: string | null
): SegmentFormValues {
  return {
    event_id: eventId,
    kind: state.kind,
    name: state.name,
    campus_id: campusId,
    capacity: state.capacity,
    metadata: {
      departure_time: state.departure_time || null,
      pickup_location: state.pickup_location || null,
      hotel: state.hotel || null,
      room_number: state.room_number || null,
      notes: state.notes || null,
    },
    topic_id: null,
  };
}

export function SegmentsStudio({
  attendees,
  campusId,
  eventId,
  eventTitle,
  segments,
}: SegmentsStudioProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [messagingId, setMessagingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const refresh = () => startTransition(() => router.refresh());

  const handleCreate = async (state: SegmentFormState) => {
    const result = await createSegment(toFormValues(state, eventId, campusId));
    if (typeof result.error === "string") {
      throw new Error(result.error);
    }
    if (result.error) {
      throw new Error("Please check the segment fields.");
    }
    setCreating(false);
    refresh();
  };

  const handleUpdate = async (id: string, state: SegmentFormState) => {
    const result = await updateSegment(
      id,
      toFormValues(state, eventId, campusId)
    );
    if (typeof result.error === "string") {
      throw new Error(result.error);
    }
    if (result.error) {
      throw new Error("Please check the segment fields.");
    }
    setEditingId(null);
    refresh();
  };

  const handleDelete = async (id: string) => {
    await deleteSegment(id);
    setConfirmDeleteId(null);
    refresh();
  };

  const messagingSegment = segments.find(
    (segment) => segment.$id === messagingId
  );

  return (
    <div>
      <Link
        className="mb-4 inline-flex items-center gap-1.5 text-sm"
        href={`/events/${eventId}`}
        style={{ color: STUDIO.ink3 }}
      >
        <ArrowLeft size={14} /> Back to event
      </Link>

      <StudioPageHeader
        description="Group attendees into buses, rooms, or any segment, import the attendee list, and message each group."
        eyebrow={<>Logistics</>}
        title={eventTitle}
      >
        <PortalButton
          onClick={() => {
            setCreating((prev) => !prev);
            setEditingId(null);
          }}
          variant="primary"
        >
          <Plus size={15} /> New segment
        </PortalButton>
      </StudioPageHeader>

      {creating && (
        <StudioCard className="mb-6 p-5">
          <h2
            className="mb-4 font-medium text-sm"
            style={{ color: STUDIO.ink }}
          >
            New segment
          </h2>
          <SegmentForm
            onCancel={() => setCreating(false)}
            onSubmit={handleCreate}
            submitLabel="Create segment"
          />
        </StudioCard>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {segments.map((segment) => (
          <SegmentCard
            confirmingDelete={confirmDeleteId === segment.$id}
            editing={editingId === segment.$id}
            key={segment.$id}
            onCancelEdit={() => setEditingId(null)}
            onDelete={() => handleDelete(segment.$id)}
            onEdit={() => {
              setEditingId(segment.$id);
              setCreating(false);
            }}
            onMessage={() => setMessagingId(segment.$id)}
            onRequestDelete={() => setConfirmDeleteId(segment.$id)}
            onUpdate={(state) => handleUpdate(segment.$id, state)}
            segment={segment}
          />
        ))}
      </div>

      {segments.length === 0 && !creating && (
        <StudioCard className="p-8 text-center">
          <p className="text-sm" style={{ color: STUDIO.ink3 }}>
            No segments yet. Create one to start grouping attendees.
          </p>
        </StudioCard>
      )}

      <StudioPanel className="mt-8 p-5">
        <div className="mb-4 flex items-center gap-2">
          <Users color={STUDIO.claret} size={16} />
          <h2 className="font-medium text-sm" style={{ color: STUDIO.ink }}>
            Attendees
          </h2>
        </div>
        <AttendeePanel
          attendees={attendees}
          eventId={eventId}
          onChanged={refresh}
          segments={segments}
        />
      </StudioPanel>

      {messagingSegment && (
        <Modal
          onClose={() => setMessagingId(null)}
          title={`Message ${messagingSegment.name}`}
        >
          <MessageComposer
            onClose={() => setMessagingId(null)}
            onSent={() => {
              setMessagingId(null);
              refresh();
            }}
            segmentId={messagingSegment.$id}
            segmentName={messagingSegment.name}
          />
        </Modal>
      )}
    </div>
  );
}

interface SegmentCardProps {
  confirmingDelete: boolean;
  editing: boolean;
  onCancelEdit: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onMessage: () => void;
  onRequestDelete: () => void;
  onUpdate: (state: SegmentFormState) => Promise<void>;
  segment: SegmentWithCount;
}

function SegmentCard({
  confirmingDelete,
  editing,
  onCancelEdit,
  onDelete,
  onEdit,
  onMessage,
  onRequestDelete,
  onUpdate,
  segment,
}: SegmentCardProps) {
  const meta = parseSegmentMetadata(segment.metadata);
  const capacityLabel = segment.capacity
    ? `${segment.member_count}/${segment.capacity}`
    : `${segment.member_count}`;

  if (editing) {
    return (
      <StudioCard className="p-5 lg:col-span-2">
        <h2 className="mb-4 font-medium text-sm" style={{ color: STUDIO.ink }}>
          Edit {segment.name}
        </h2>
        <SegmentForm
          initial={toFormState(segment)}
          onCancel={onCancelEdit}
          onSubmit={onUpdate}
          submitLabel="Save changes"
        />
      </StudioCard>
    );
  }

  return (
    <StudioCard className="flex flex-col gap-3 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-base" style={{ color: STUDIO.ink }}>
            {segment.name}
          </p>
          {segment.kind && (
            <p
              className="text-[11px] uppercase tracking-[0.06em]"
              style={{ color: STUDIO.ink4 }}
            >
              {segment.kind}
            </p>
          )}
        </div>
        <span
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs"
          style={{
            background: STUDIO.paper2,
            border: `0.5px solid ${STUDIO.rule2}`,
            color: STUDIO.ink2,
          }}
        >
          <Users size={12} /> {capacityLabel}
        </span>
      </div>

      <SegmentMeta meta={meta} />

      <div className="flex items-center gap-2 pt-1">
        <PortalButton onClick={onMessage} size="sm" variant="secondary">
          <MessageSquare size={13} /> Message
        </PortalButton>
        <PortalButton
          aria-label="Edit segment"
          onClick={onEdit}
          size="sm"
          variant="ghost"
        >
          <Pencil size={13} /> Edit
        </PortalButton>
        <PortalButton
          aria-label={confirmingDelete ? "Confirm delete" : "Delete segment"}
          onClick={confirmingDelete ? onDelete : onRequestDelete}
          size="sm"
          variant="danger"
        >
          <Trash2 size={13} /> {confirmingDelete ? "Confirm" : "Delete"}
        </PortalButton>
      </div>
    </StudioCard>
  );
}

function SegmentMeta({
  meta,
}: {
  meta: ReturnType<typeof parseSegmentMetadata>;
}) {
  const items: { icon: typeof MapPin; value: string }[] = [];
  if (meta.departure_time) {
    items.push({ icon: Send, value: meta.departure_time });
  }
  if (meta.pickup_location) {
    items.push({ icon: MapPin, value: meta.pickup_location });
  }
  if (meta.hotel) {
    items.push({ icon: MapPin, value: meta.hotel });
  }
  if (meta.room_number) {
    items.push({ icon: MapPin, value: `Room ${meta.room_number}` });
  }

  if (items.length === 0 && !meta.notes) {
    return null;
  }

  return (
    <div className="flex flex-col gap-1.5">
      {items.map((item) => (
        <span
          className="flex items-center gap-1.5 text-xs"
          key={item.value}
          style={{ color: STUDIO.ink3 }}
        >
          <item.icon size={12} /> {item.value}
        </span>
      ))}
      {meta.notes && (
        <p className="text-xs" style={{ color: STUDIO.ink4 }}>
          {meta.notes}
        </p>
      )}
    </div>
  );
}

function Modal({
  children,
  onClose,
  title,
}: {
  children: React.ReactNode;
  onClose: () => void;
  title: string;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(26,24,20,0.32)" }}
    >
      <StudioCard
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto p-6"
        style={{ background: STUDIO.paper }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-medium text-base" style={{ color: STUDIO.ink }}>
            {title}
          </h2>
          <PortalButton aria-label="Close" onClick={onClose} variant="ghost">
            Close
          </PortalButton>
        </div>
        {children}
      </StudioCard>
    </div>
  );
}
