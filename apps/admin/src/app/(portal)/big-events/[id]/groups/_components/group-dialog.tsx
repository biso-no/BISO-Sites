"use client";

import { GROUP_KINDS, type GroupKind } from "@repo/shared/big-events/tables";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { type FormEvent, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  type GroupFormField,
  type GroupFormValues,
  groupFormSchema,
} from "@/lib/big-events/buses/group-form";
import { joinOsloDateTime, splitOsloDateTime } from "@/lib/big-events/dates";
import { toBigEventCampusId } from "@/lib/big-events/form-schema";
import { NATIONAL_CAMPUS_ID } from "@/lib/event-scope";
import {
  createGroup,
  type GroupView,
  updateGroup,
} from "../../../../_actions/big-event-groups";
import { PortalButton } from "../../../../_components/portal-button";
import {
  PortalField,
  PortalInput,
  PortalSelect,
  PortalTextarea,
} from "../../../../_components/portal-fields";
import { SERIF_STACK, STUDIO } from "../../../../_components/studio";

type FieldErrors = Partial<Record<GroupFormField, string>>;
type LegKey = "home" | "out";
interface DateTimeParts {
  date: string;
  time: string;
}

/** Where a group may be put: the caller's campuses (R6), maybe "No campus". */
export interface CampusChoices {
  allowsNoCampus: boolean;
  campusIds: string[];
}

interface GroupDialogProps {
  bigEventId: string;
  campusChoices: CampusChoices;
  /** The group being edited; absent when adding one. */
  group?: GroupView;
  initial: GroupFormValues;
  /** Type and campus stay put while people are in the group. */
  locked: boolean;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  /** Buses can be chosen only while Travel is on. */
  travel: boolean;
}

/** The campuses a group of this kind can have: a bus never National (R7). */
export function campusIdsFor(kind: GroupKind, campusIds: string[]): string[] {
  return kind === "bus"
    ? campusIds.filter((id) => id !== NATIONAL_CAMPUS_ID)
    : campusIds;
}

/** The campus a new group starts on: the big event's own, else the first allowed. */
export function defaultGroupCampus(
  kind: GroupKind,
  campusIds: string[],
  eventCampusId: string
): GroupFormValues["campus_id"] {
  const allowed = campusIdsFor(kind, campusIds);
  const pick = allowed.includes(eventCampusId) ? eventCampusId : allowed[0];
  return pick ? toBigEventCampusId(pick) : null;
}

const LEG_FIELDS = [
  "home_arrival_note",
  "home_maps_url",
  "home_meeting_point",
  "out_maps_url",
  "out_meeting_point",
] as const;

function firstErrorPerField(
  issues: { path: PropertyKey[] }[],
  message: (field: GroupFormField) => string
): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of issues) {
    const field = issue.path[0] as GroupFormField | undefined;
    if (field && !errors[field]) {
      errors[field] = message(field);
    }
  }
  return errors;
}

/** Empty means "no limit"; anything else must parse as a number. */
function parseCapacity(text: string): number | null {
  const trimmed = text.trim();
  return trimmed === "" ? null : Number(trimmed);
}

const isHalfSet = ({ date, time }: DateTimeParts): boolean =>
  Boolean(date) !== Boolean(time);

/** Create or edit a bus, room, buddy group, team or other group. */
export function GroupDialog({
  bigEventId,
  campusChoices,
  group,
  initial,
  locked,
  onOpenChange,
  open,
  travel,
}: GroupDialogProps) {
  const t = useTranslations("adminPortal.bigEvents.groups");
  const tb = useTranslations("adminPortal.bigEvents");
  const tc = useTranslations("adminPortal.common");
  const router = useRouter();
  const [values, setValues] = useState<GroupFormValues>(initial);
  const [capacity, setCapacity] = useState(initial.capacity?.toString() ?? "");
  const [legs, setLegs] = useState<Record<LegKey, DateTimeParts>>(() => ({
    home: splitOsloDateTime(initial.home_departs_at),
    out: splitOsloDateTime(initial.out_departs_at),
  }));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isPending, startTransition] = useTransition();
  const isBus = values.kind === "bus";
  const isRoom = values.kind === "room";

  // A stored campus outside the caller's list stays choosable, so the
  // select shows it; the server keeps a campus that doesn't change.
  const offered =
    initial.campus_id && !campusChoices.campusIds.includes(initial.campus_id)
      ? [...campusChoices.campusIds, initial.campus_id]
      : campusChoices.campusIds;
  const noCampusAllowed = !isBus && campusChoices.allowsNoCampus;
  const campusOptions = [
    ...campusIdsFor(values.kind, offered).map((id) => ({
      label: tb(`campuses.${id}`),
      value: id,
    })),
    ...(noCampusAllowed ? [{ label: t("noCampus"), value: "" }] : []),
  ];
  const kindOptions = GROUP_KINDS.filter(
    (kind) => kind !== "bus" || travel || initial.kind === "bus"
  ).map((kind) => ({ label: t(`kinds.${kind}`), value: kind }));

  const update = <K extends keyof GroupFormValues>(
    key: K,
    value: GroupFormValues[K]
  ) => setValues((prev) => ({ ...prev, [key]: value }));

  /** A new kind keeps the campus when it may have it, else takes the first. */
  function changeKind(kind: GroupKind) {
    setValues((prev) => {
      const allowed = campusIdsFor(kind, offered);
      const keeps =
        prev.campus_id === null
          ? kind !== "bus" && campusChoices.allowsNoCampus
          : allowed.includes(prev.campus_id);
      const campusId = keeps
        ? prev.campus_id
        : toBigEventCampusId(allowed[0] ?? "");
      return { ...prev, campus_id: campusId, kind };
    });
  }

  /** The form as the server takes it: hidden fields cleared, times joined. */
  function candidate(): GroupFormValues {
    const leg = (key: LegKey) =>
      isBus ? joinOsloDateTime(legs[key].date, legs[key].time) : "";
    const cleared = Object.fromEntries(
      LEG_FIELDS.map((field) => [field, isBus ? values[field] : ""])
    ) as Pick<GroupFormValues, (typeof LEG_FIELDS)[number]>;
    return {
      ...values,
      ...cleared,
      capacity: parseCapacity(capacity),
      home_departs_at: leg("home"),
      out_departs_at: leg("out"),
      room_number: isRoom ? values.room_number : "",
    };
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = candidate();
    const message = (field: GroupFormField) => t(`dialog.errors.${field}`);
    const parsed = groupFormSchema.safeParse(data);
    const found: FieldErrors = parsed.success
      ? {}
      : firstErrorPerField(parsed.error.issues, message);
    for (const key of ["out", "home"] as const) {
      if (isBus && isHalfSet(legs[key])) {
        found[`${key}_departs_at`] = message(`${key}_departs_at`);
      }
    }
    const noBusCampus =
      data.campus_id === null || data.campus_id === NATIONAL_CAMPUS_ID;
    if (isBus && noBusCampus) {
      found.campus_id = message("campus_id");
    }
    if (!parsed.success || Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }
    setErrors({});
    const saved = parsed.data;
    startTransition(async () => {
      try {
        if (group) {
          await updateGroup(group.$id, saved);
          toast.success(t("dialog.saved"));
        } else {
          await createGroup(bigEventId, saved);
          toast.success(t("dialog.added", { name: saved.name }));
        }
        onOpenChange(false);
        router.refresh();
      } catch {
        toast.error(tb("form.saveFailed"));
      }
    });
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        className="max-h-[90vh] overflow-y-auto border-[#e5dcca] bg-[#fffdf8] sm:max-w-2xl sm:rounded-2xl"
        style={{ color: STUDIO.ink }}
      >
        <form
          className="flex flex-col gap-5"
          noValidate
          onSubmit={handleSubmit}
        >
          <DialogHeader>
            <DialogTitle
              className="break-words font-normal text-[26px] leading-tight"
              style={{ fontFamily: SERIF_STACK }}
            >
              {group
                ? t("dialog.editTitle", { name: initial.name })
                : t(`add.${values.kind}`)}
            </DialogTitle>
            <DialogDescription style={{ color: STUDIO.ink3 }}>
              {t("dialog.description")}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <PortalField
              error={errors.kind}
              hint={locked ? t("dialog.inUse") : undefined}
              label={t("dialog.kind")}
            >
              <PortalSelect
                aria-label={t("dialog.kind")}
                disabled={locked}
                error={Boolean(errors.kind)}
                onChange={(e) => changeKind(e.target.value as GroupKind)}
                options={kindOptions}
                value={values.kind}
              />
            </PortalField>
            <PortalField
              error={errors.campus_id}
              hint={locked ? t("dialog.inUse") : undefined}
              label={t("dialog.campus")}
            >
              <PortalSelect
                aria-label={t("dialog.campus")}
                disabled={locked}
                error={Boolean(errors.campus_id)}
                onChange={(e) =>
                  update("campus_id", toBigEventCampusId(e.target.value))
                }
                options={campusOptions}
                value={values.campus_id ?? ""}
              />
            </PortalField>
          </div>

          <PortalField error={errors.name} label={t("dialog.name")} required>
            <PortalInput
              aria-label={t("dialog.name")}
              autoComplete="off"
              error={Boolean(errors.name)}
              maxLength={200}
              onChange={(e) => update("name", e.target.value)}
              type="text"
              value={values.name}
            />
          </PortalField>

          <div className="grid gap-4 sm:grid-cols-2">
            <PortalField
              error={errors.capacity}
              hint={t("dialog.capacityHelp")}
              label={isBus ? t("dialog.seats") : t("dialog.places")}
            >
              <PortalInput
                aria-label={isBus ? t("dialog.seats") : t("dialog.places")}
                error={Boolean(errors.capacity)}
                inputMode="numeric"
                max={200}
                min={1}
                onChange={(e) => setCapacity(e.target.value)}
                type="number"
                value={capacity}
              />
            </PortalField>
            {isRoom && (
              <PortalField
                error={errors.room_number}
                hint={t("dialog.roomNumberHelp")}
                label={t("dialog.roomNumber")}
              >
                <PortalInput
                  aria-label={t("dialog.roomNumber")}
                  autoComplete="off"
                  error={Boolean(errors.room_number)}
                  maxLength={40}
                  onChange={(e) => update("room_number", e.target.value)}
                  type="text"
                  value={values.room_number}
                />
              </PortalField>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <PortalField
              error={errors.contact_name}
              label={t("dialog.contactName")}
            >
              <PortalInput
                aria-label={t("dialog.contactName")}
                autoComplete="off"
                error={Boolean(errors.contact_name)}
                maxLength={120}
                onChange={(e) => update("contact_name", e.target.value)}
                type="text"
                value={values.contact_name}
              />
            </PortalField>
            <PortalField
              error={errors.contact_phone}
              label={t("dialog.contactPhone")}
            >
              <PortalInput
                aria-label={t("dialog.contactPhone")}
                autoComplete="off"
                error={Boolean(errors.contact_phone)}
                maxLength={32}
                onChange={(e) => update("contact_phone", e.target.value)}
                type="tel"
                value={values.contact_phone}
              />
            </PortalField>
          </div>

          {isBus && (
            <div className="grid gap-4 sm:grid-cols-2">
              {(["out", "home"] as const).map((key) => (
                <BusLegFields
                  errors={errors}
                  key={key}
                  leg={key}
                  onTimeChange={(parts) =>
                    setLegs((prev) => ({ ...prev, [key]: parts }))
                  }
                  time={legs[key]}
                  update={update}
                  values={values}
                />
              ))}
            </div>
          )}

          <PortalField error={errors.note} label={t("dialog.note")}>
            <PortalTextarea
              aria-label={t("dialog.note")}
              error={Boolean(errors.note)}
              maxLength={2000}
              onChange={(e) => update("note", e.target.value)}
              rows={3}
              value={values.note}
            />
          </PortalField>

          <DialogFooter className="gap-2">
            <PortalButton
              disabled={isPending}
              onClick={() => onOpenChange(false)}
              variant="ghost"
            >
              {tc("cancel")}
            </PortalButton>
            <PortalButton loading={isPending} type="submit" variant="primary">
              {group ? t("dialog.save") : t("dialog.add")}
            </PortalButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface BusLegFieldsProps {
  errors: FieldErrors;
  leg: LegKey;
  onTimeChange: (parts: DateTimeParts) => void;
  time: DateTimeParts;
  update: <K extends keyof GroupFormValues>(
    key: K,
    value: GroupFormValues[K]
  ) => void;
  values: GroupFormValues;
}

/** "Out" or "Home": when it leaves, where to meet and, for home, when it's back. */
function BusLegFields({
  errors,
  leg,
  onTimeChange,
  time,
  update,
  values,
}: BusLegFieldsProps) {
  const t = useTranslations("adminPortal.bigEvents.groups.dialog");
  const title = t(leg);
  const leaves = `${title} · ${t("leaves")}`;
  const departs = `${leg}_departs_at` as const;
  const meetingPoint = `${leg}_meeting_point` as const;
  const mapsUrl = `${leg}_maps_url` as const;

  return (
    <fieldset
      className="flex min-w-0 flex-col gap-4 rounded-xl border px-4 pt-2 pb-4"
      style={{ borderColor: STUDIO.rule }}
    >
      <legend
        className="px-1 font-medium text-sm"
        style={{ color: STUDIO.ink }}
      >
        {title}
      </legend>
      <PortalField error={errors[departs]} label={t("leaves")}>
        <div className="grid grid-cols-[1fr_7rem] gap-2">
          <PortalInput
            aria-label={`${leaves}: ${t("date")}`}
            error={Boolean(errors[departs])}
            onChange={(e) => onTimeChange({ ...time, date: e.target.value })}
            type="date"
            value={time.date}
          />
          <PortalInput
            aria-label={`${leaves}: ${t("time")}`}
            error={Boolean(errors[departs])}
            onChange={(e) => onTimeChange({ ...time, time: e.target.value })}
            type="time"
            value={time.time}
          />
        </div>
      </PortalField>
      <PortalField error={errors[meetingPoint]} label={t("meetingPoint")}>
        <PortalInput
          aria-label={`${title} · ${t("meetingPoint")}`}
          autoComplete="off"
          error={Boolean(errors[meetingPoint])}
          maxLength={300}
          onChange={(e) => update(meetingPoint, e.target.value)}
          type="text"
          value={values[meetingPoint]}
        />
      </PortalField>
      <PortalField
        error={errors[mapsUrl]}
        hint={t("mapsUrlHelp")}
        label={t("mapsUrl")}
      >
        <PortalInput
          aria-label={`${title} · ${t("mapsUrl")}`}
          autoComplete="off"
          error={Boolean(errors[mapsUrl])}
          maxLength={1000}
          onChange={(e) => update(mapsUrl, e.target.value)}
          type="url"
          value={values[mapsUrl]}
        />
      </PortalField>
      {leg === "home" && (
        <PortalField
          error={errors.home_arrival_note}
          label={t("arrivesAround")}
        >
          <PortalInput
            aria-label={`${title} · ${t("arrivesAround")}`}
            autoComplete="off"
            error={Boolean(errors.home_arrival_note)}
            maxLength={200}
            onChange={(e) => update("home_arrival_note", e.target.value)}
            type="text"
            value={values.home_arrival_note}
          />
        </PortalField>
      )}
    </fieldset>
  );
}
