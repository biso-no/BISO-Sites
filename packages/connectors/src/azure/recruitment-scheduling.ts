import type { Client as GraphClient } from "@microsoft/microsoft-graph-client";
import {
  createCalendarEvent,
  createTeamsMeeting,
  type FreeBusyResult,
  getFreeBusy,
} from "./calendar";
import { createGraphClient } from "./graph-client";

/**
 * Recruitment scheduling on Microsoft Graph: panel free/busy, Teams
 * meetings and the Outlook invite the candidate and panel receive.
 *
 * Plain module, no "use server": both apps call it from their own server
 * code, and exposing these as server actions would hand app-level Graph
 * permissions to any browser.
 */

export interface GraphCredentials {
  clientId: string;
  clientSecret: string;
  tenantId: string;
}

type Env = Record<string, string | undefined>;

/**
 * The same names the IT module reads, so one app registration serves both.
 * The Graph-specific names win when both are set.
 */
export function readGraphCredentials(
  env: Env = process.env
): GraphCredentials | null {
  const tenantId = env.AZURE_GRAPH_TENANT_ID || env.AZURE_TENANT_ID;
  const clientId =
    env.AZURE_GRAPH_CLIENT_ID || env.AZURE_APP_ID || env.AZURE_CLIENT_ID;
  const clientSecret = env.AZURE_GRAPH_CLIENT_SECRET || env.AZURE_CLIENT_SECRET;
  if (!(tenantId && clientId && clientSecret)) {
    return null;
  }
  return { clientId, clientSecret, tenantId };
}

export function isGraphSchedulingConfigured(env: Env = process.env): boolean {
  return readGraphCredentials(env) !== null;
}

export function createSchedulingGraphClient(
  env: Env = process.env
): GraphClient | null {
  const creds = readGraphCredentials(env);
  if (!creds) {
    return null;
  }
  return createGraphClient(creds.tenantId, creds.clientId, creds.clientSecret);
}

/** Busy intervals of every panel member in the window, merged. */
export async function panelBusyIntervals(
  graph: GraphClient,
  upns: string[],
  window: { from: Date; to: Date }
): Promise<{ busy: FreeBusyResult["busy"]; complete: boolean }> {
  const freeBusy = await getFreeBusy(graph, upns, window);
  return {
    busy: freeBusy.flatMap((entry) => entry.busy),
    complete: freeBusy.every((entry) => !entry.error),
  };
}

export interface ScheduleInterviewInput {
  body: string;
  candidateEmail: string;
  createTeamsMeeting: boolean;
  ends_at: Date;
  location: string | null;
  organizerUpn: string;
  panelEmails: string[];
  starts_at: Date;
  subject: string;
  timezone: string;
}

export interface ScheduledInterview {
  meetingUrl: string | null;
  outlookEventId: string | null;
  teamsMeetingId: string | null;
  webLink: string | null;
}

function inviteBody(text: string, joinUrl: string | null): string {
  const paragraphs = [`<p>${text}</p>`];
  if (joinUrl) {
    paragraphs.push(
      `<p>Join the Teams meeting: <a href="${joinUrl}">${joinUrl}</a></p>`
    );
  }
  return paragraphs.join("");
}

/**
 * Create the Teams meeting (when asked) and always the Outlook invite, with
 * the join link in its body so it reaches everyone invited.
 */
export async function scheduleInterviewOnGraph(
  graph: GraphClient,
  input: ScheduleInterviewInput
): Promise<ScheduledInterview> {
  const attendeeEmails = [input.candidateEmail, ...input.panelEmails];
  const meeting = input.createTeamsMeeting
    ? await createTeamsMeeting(graph, input.organizerUpn, {
        attendeeEmails,
        ends_at: input.ends_at,
        starts_at: input.starts_at,
        subject: input.subject,
      })
    : null;

  const event = await createCalendarEvent(graph, input.organizerUpn, {
    attendeeEmails,
    body: inviteBody(input.body, meeting?.joinUrl ?? null),
    ends_at: input.ends_at,
    location: input.location,
    onlineMeetingUrl: meeting?.joinUrl ?? null,
    starts_at: input.starts_at,
    subject: input.subject,
    timezone: input.timezone,
  });

  return {
    meetingUrl: meeting?.joinUrl ?? null,
    outlookEventId: event?.id ?? null,
    teamsMeetingId: meeting?.id ?? null,
    webLink: event?.webLink ?? null,
  };
}
