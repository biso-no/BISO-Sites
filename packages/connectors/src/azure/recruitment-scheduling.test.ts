import { describe, expect, test } from "bun:test";
import {
  readGraphCredentials,
  scheduleInterviewOnGraph,
} from "./recruitment-scheduling";

describe("readGraphCredentials", () => {
  test("accepts the names the IT module already uses", () => {
    // The admin's env has AZURE_APP_ID and AZURE_GRAPH_CLIENT_SECRET, not the
    // AZURE_CLIENT_ID/AZURE_CLIENT_SECRET the scheduler used to insist on, so
    // every interview was silently saved without an invite.
    expect(
      readGraphCredentials({
        AZURE_APP_ID: "app",
        AZURE_GRAPH_CLIENT_SECRET: "secret",
        AZURE_TENANT_ID: "tenant",
      })
    ).toEqual({ clientId: "app", clientSecret: "secret", tenantId: "tenant" });
  });

  test("prefers the Graph-specific names when both are set", () => {
    expect(
      readGraphCredentials({
        AZURE_APP_ID: "app",
        AZURE_GRAPH_CLIENT_ID: "graph-app",
        AZURE_GRAPH_CLIENT_SECRET: "secret",
        AZURE_TENANT_ID: "tenant",
      })?.clientId
    ).toBe("graph-app");
  });

  test("is null when anything is missing", () => {
    expect(readGraphCredentials({ AZURE_TENANT_ID: "tenant" })).toBeNull();
  });
});

function fakeGraph() {
  const calls: { path: string; body: Record<string, unknown> }[] = [];
  const graph = {
    api: (path: string) => ({
      post: (body: Record<string, unknown>) => {
        calls.push({ body, path });
        if (path.endsWith("/onlineMeetings")) {
          return Promise.resolve({
            id: "meeting-1",
            joinUrl: "https://teams.microsoft.com/l/meetup-join/abc",
          });
        }
        return Promise.resolve({ id: "event-1", webLink: "https://outlook" });
      },
    }),
  };
  return { calls, graph };
}

const INPUT = {
  body: "See you soon.",
  candidateEmail: "cand@example.com",
  ends_at: new Date("2026-10-19T08:45:00Z"),
  organizerUpn: "hr@biso.no",
  panelEmails: ["hr@biso.no", "lead@biso.no"],
  starts_at: new Date("2026-10-19T08:00:00Z"),
  subject: "Interview",
  timezone: "Europe/Oslo",
};

describe("scheduleInterviewOnGraph", () => {
  test("puts the Teams join link into the invite everyone receives", async () => {
    // The join URL was only used to flag the event as online; it never
    // reached the candidate or the panel.
    const { calls, graph } = fakeGraph();

    const result = await scheduleInterviewOnGraph(graph as never, {
      ...INPUT,
      createTeamsMeeting: true,
      location: "Teams",
    });

    const event = calls.find((c) => c.path.endsWith("/events"))?.body;
    expect(result.meetingUrl).toBe(
      "https://teams.microsoft.com/l/meetup-join/abc"
    );
    expect(String((event?.body as { content: string }).content)).toContain(
      "https://teams.microsoft.com/l/meetup-join/abc"
    );
    expect(event?.attendees).toHaveLength(3);
  });

  test("sends an Outlook invite for an in-person interview without a Teams meeting", async () => {
    // "Everything goes through the system": a Nydalen interview still needs
    // an invite in the candidate's and panel's calendars.
    const { calls, graph } = fakeGraph();

    const result = await scheduleInterviewOnGraph(graph as never, {
      ...INPUT,
      createTeamsMeeting: false,
      location: "Nydalen",
    });

    expect(calls.some((c) => c.path.endsWith("/onlineMeetings"))).toBeFalse();
    const event = calls.find((c) => c.path.endsWith("/events"))?.body;
    expect(event?.location).toEqual({ displayName: "Nydalen" });
    expect(event?.isOnlineMeeting).toBeFalse();
    expect(result.outlookEventId).toBe("event-1");
    expect(result.meetingUrl).toBeNull();
  });

  test("states the interview time in the organiser's zone", async () => {
    const { calls, graph } = fakeGraph();

    await scheduleInterviewOnGraph(graph as never, {
      ...INPUT,
      createTeamsMeeting: false,
      location: "Nydalen",
    });

    const event = calls.find((c) => c.path.endsWith("/events"))?.body;
    expect((event?.start as { timeZone: string }).timeZone).toBe("Europe/Oslo");
  });
});
