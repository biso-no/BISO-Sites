"use server";

import { createGraphClient } from "@repo/connectors/azure";
import {
  cancelCalendarEvent,
  createCalendarEvent,
  createTeamsMeeting,
  type FreeBusyResult,
  findCommonSlots,
  getFreeBusy,
} from "@repo/connectors/azure/calendar";

/**
 * Thin server-only wrapper around the @repo/connectors/azure/calendar
 * primitives. Reads creds from environment variables and degrades gracefully
 * (returns null / empty arrays) when the Azure app credentials are absent so
 * developers can run the recruitment UI without Graph access.
 */

function readGraphCreds(): {
  tenantId: string;
  clientId: string;
  clientSecret: string;
} | null {
  const tenantId = process.env.AZURE_TENANT_ID;
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;
  if (!(tenantId && clientId && clientSecret)) {
    return null;
  }
  return { clientId, clientSecret, tenantId };
}

function lazyGraphClient() {
  const creds = readGraphCreds();
  if (!creds) {
    return null;
  }
  return createGraphClient(creds.tenantId, creds.clientId, creds.clientSecret);
}

export interface ProposedSlot {
  ends_at: string;
  starts_at: string;
}

export async function proposeSlotsForPanel(input: {
  upns: string[];
  from: Date;
  to: Date;
  durationMinutes: number;
  workingHoursOnly?: boolean;
}): Promise<{
  available: boolean;
  freeBusy: FreeBusyResult[];
  slots: ProposedSlot[];
}> {
  const graph = lazyGraphClient();
  if (!graph) {
    return { available: false, freeBusy: [], slots: [] };
  }
  const freeBusy = await getFreeBusy(graph, input.upns, {
    from: input.from,
    to: input.to,
  });
  const slots = findCommonSlots(
    freeBusy,
    { from: input.from, to: input.to },
    {
      durationMinutes: input.durationMinutes,
      stepMinutes: 15,
      workingHoursOnly: input.workingHoursOnly ?? true,
    }
  );
  return {
    available: freeBusy.every((entry) => !entry.error),
    freeBusy,
    slots: slots.slice(0, 10).map((slot) => ({
      ends_at: slot.end.toISOString(),
      starts_at: slot.start.toISOString(),
    })),
  };
}

export interface ScheduleInterviewInput {
  body: string;
  candidateEmail: string;
  createTeamsMeeting?: boolean;
  ends_at: Date;
  organizerUpn: string;
  panelEmails: string[];
  starts_at: Date;
  subject: string;
}

export interface ScheduledInterview {
  meetingUrl: string | null;
  outlookEventId: string | null;
  teamsMeetingId: string | null;
  webLink: string | null;
}

export async function scheduleInterviewOnGraph(
  input: ScheduleInterviewInput
): Promise<ScheduledInterview> {
  const graph = lazyGraphClient();
  if (!graph) {
    return {
      meetingUrl: null,
      outlookEventId: null,
      teamsMeetingId: null,
      webLink: null,
    };
  }

  let meeting: { id: string; joinUrl: string } | null = null;
  if (input.createTeamsMeeting !== false) {
    meeting = await createTeamsMeeting(graph, input.organizerUpn, {
      attendeeEmails: [input.candidateEmail, ...input.panelEmails],
      ends_at: input.ends_at,
      starts_at: input.starts_at,
      subject: input.subject,
    });
  }

  const event = await createCalendarEvent(graph, input.organizerUpn, {
    attendeeEmails: [input.candidateEmail, ...input.panelEmails],
    body: input.body,
    ends_at: input.ends_at,
    onlineMeetingUrl: meeting?.joinUrl ?? null,
    starts_at: input.starts_at,
    subject: input.subject,
  });

  return {
    meetingUrl: meeting?.joinUrl ?? null,
    outlookEventId: event?.id ?? null,
    teamsMeetingId: meeting?.id ?? null,
    webLink: event?.webLink ?? null,
  };
}

export function cancelInterviewOnGraph(
  organizerUpn: string,
  outlookEventId: string,
  reason?: string
): Promise<{ ok: boolean }> {
  const graph = lazyGraphClient();
  if (!graph) {
    return { ok: false };
  }
  return cancelCalendarEvent(graph, organizerUpn, outlookEventId, reason);
}
