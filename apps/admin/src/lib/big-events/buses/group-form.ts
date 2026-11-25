import { normalizePhone } from "@repo/shared/big-events/phone";
import { GROUP_KINDS, type GroupKind } from "@repo/shared/big-events/tables";
import type { BigEventGroupRow } from "@repo/shared/big-events/types";
import { z } from "zod";
import { BIG_EVENT_CAMPUS_IDS, type BigEventCampusId } from "../form-schema";

const WEB_PROTOCOL = /^https?$/;
const MAX_CAPACITY = 200;

/**
 * A departure time: the dialog turns the Oslo date and time it shows into an
 * ISO instant (`joinOsloDateTime`); empty means "not set".
 */
const departsAt = z.iso.datetime({ offset: true }).or(z.literal(""));
const mapsUrl = z.url({ protocol: WEB_PROTOCOL }).max(1000).or(z.literal(""));
const text = (max: number) => z.string().trim().max(max);

/**
 * Values the group dialog sends. Empty text means "not set". The room number
 * is kept only for rooms and the out/home leg fields only for buses.
 */
export const groupFormSchema = z.object({
  campus_id: z.enum(BIG_EVENT_CAMPUS_IDS).nullable(),
  capacity: z.number().int().min(1).max(MAX_CAPACITY).nullable(),
  contact_name: text(120),
  contact_phone: text(32).refine(
    (value) => value === "" || normalizePhone(value) !== null
  ),
  home_arrival_note: text(200),
  home_departs_at: departsAt,
  home_maps_url: mapsUrl,
  home_meeting_point: text(300),
  kind: z.enum(GROUP_KINDS),
  name: z.string().trim().min(1).max(200),
  note: text(2000),
  out_departs_at: departsAt,
  out_maps_url: mapsUrl,
  out_meeting_point: text(300),
  room_number: text(40),
});

export type GroupFormValues = z.infer<typeof groupFormSchema>;
export type GroupFormField = keyof GroupFormValues;

/** Narrows a stored campus id to one the dialog offers. */
function toCampusId(value: string | null): BigEventCampusId | null {
  return BIG_EVENT_CAMPUS_IDS.find((id) => id === value) ?? null;
}

/** A blank dialog for a new group of this kind. */
export function emptyGroupForm(
  kind: GroupKind,
  campusId: BigEventCampusId | null
): GroupFormValues {
  return {
    campus_id: campusId,
    capacity: null,
    contact_name: "",
    contact_phone: "",
    home_arrival_note: "",
    home_departs_at: "",
    home_maps_url: "",
    home_meeting_point: "",
    kind,
    name: "",
    note: "",
    out_departs_at: "",
    out_maps_url: "",
    out_meeting_point: "",
    room_number: "",
  };
}

/** The dialog filled from a stored group; null columns become empty text. */
export function groupFormInitial(group: BigEventGroupRow): GroupFormValues {
  return {
    campus_id: toCampusId(group.campus_id),
    capacity: group.capacity,
    contact_name: group.contact_name ?? "",
    contact_phone: group.contact_phone ?? "",
    home_arrival_note: group.home_arrival_note ?? "",
    home_departs_at: group.home_departs_at ?? "",
    home_maps_url: group.home_maps_url ?? "",
    home_meeting_point: group.home_meeting_point ?? "",
    kind: group.kind,
    name: group.name,
    note: group.note ?? "",
    out_departs_at: group.out_departs_at ?? "",
    out_maps_url: group.out_maps_url ?? "",
    out_meeting_point: group.out_meeting_point ?? "",
    room_number: group.room_number ?? "",
  };
}

/** A departure as a UTC ISO instant, or null when not set. */
function toUtc(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}

/** The leg columns of a bus; every other kind stores none. */
function busColumns(values: GroupFormValues, isBus: boolean) {
  const keep = (value: string): string | null => (isBus && value) || null;
  return {
    home_arrival_note: keep(values.home_arrival_note),
    home_departs_at: isBus ? toUtc(values.home_departs_at) : null,
    home_maps_url: keep(values.home_maps_url),
    home_meeting_point: keep(values.home_meeting_point),
    out_departs_at: isBus ? toUtc(values.out_departs_at) : null,
    out_maps_url: keep(values.out_maps_url),
    out_meeting_point: keep(values.out_meeting_point),
  };
}

/** The row columns a validated form sets; empty text becomes null. */
export function groupColumns(values: GroupFormValues) {
  return {
    campus_id: values.campus_id,
    capacity: values.capacity,
    contact_name: values.contact_name || null,
    contact_phone: normalizePhone(values.contact_phone),
    kind: values.kind,
    name: values.name,
    note: values.note || null,
    room_number: (values.kind === "room" && values.room_number) || null,
    ...busColumns(values, values.kind === "bus"),
  };
}
