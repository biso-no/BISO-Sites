import { CAMPUS_ID_TO_NAME } from "../campus-constants";
import { escapeCsvValue } from "../orders-csv";
import { type ParticipantListItem, participantEmail } from "./participant-list";

/** Column titles in the admin's language; the client sends them. */
export interface ParticipantCsvHeaders {
  campus: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  room: string;
}

/** First name, last name, email, phone, campus, room: one row per participant. */
export function participantsToCsv(
  rows: ParticipantListItem[],
  headers: ParticipantCsvHeaders
): string {
  const header = [
    headers.firstName,
    headers.lastName,
    headers.email,
    headers.phone,
    headers.campus,
    headers.room,
  ];
  const lines = rows.map((row) => [
    row.first_name,
    row.last_name,
    participantEmail(row),
    row.phone,
    row.campus_id ? (CAMPUS_ID_TO_NAME[row.campus_id] ?? null) : null,
    row.roomName,
  ]);
  return [header, ...lines]
    .map((cells) => cells.map(escapeCsvValue).join(","))
    .join("\n");
}
