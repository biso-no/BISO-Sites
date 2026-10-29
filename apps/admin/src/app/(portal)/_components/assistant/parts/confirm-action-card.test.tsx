import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  collectKnownTitles,
  describeToolCall,
  isAnswerableMessage,
  ToolApprovalCard,
} from "./confirm-action-card";

function renderCard(
  toolName: string,
  input: Record<string, unknown>,
  options: { answerable?: boolean; knownTitles?: Map<string, string> } = {}
): string {
  return renderToStaticMarkup(
    createElement(ToolApprovalCard, {
      answerable: options.answerable ?? true,
      input,
      knownTitles: options.knownTitles ?? new Map(),
      onRespond: () => undefined,
      toolName,
    })
  );
}

describe("tool approval card summary", () => {
  test("an update lists every changed field", () => {
    const payload = Object.fromEntries(
      Array.from({ length: 9 }, (_, index) => [
        `field_${index}`,
        `value ${index}`,
      ])
    );
    const summary = describeToolCall("updateContent", {
      domain: "jobs",
      id: "job-1",
      payload,
    });

    expect(summary.description).toContain("Changes 9 fields");
    expect(summary.details).toHaveLength(9);
    for (const field of Object.keys(payload)) {
      expect(summary.details.some((line) => line.startsWith(`${field}:`))).toBe(
        true
      );
    }
    expect(summary.details.join(" ")).not.toContain("more");
  });

  test("an update cuts long values but keeps the field", () => {
    const summary = describeToolCall("updateContent", {
      domain: "news",
      id: "n-1",
      payload: { description_no: "x".repeat(500) },
    });

    expect(summary.details[0]?.startsWith("description_no: ")).toBe(true);
    expect(summary.details[0]?.endsWith("…")).toBe(true);
  });

  test("a create shows campus, department and whether it publishes", () => {
    const html = renderCard("createContent", {
      campusId: "1",
      departmentId: "dept-it",
      domain: "jobs",
      payload: { title_no: "Frivillig" },
      publish: true,
    });

    expect(html).toContain("Create and publish jobs");
    expect(html).toContain("Campus: Oslo (1)");
    expect(html).toContain("Department: dept-it");
    expect(html).toContain("Publishes now: yes");
    expect(html).toContain("Frivillig");
  });

  test("a create with no campus or department says so", () => {
    const summary = describeToolCall("createContent", {
      domain: "news",
      payload: {},
      publish: false,
    });

    expect(summary.details).toEqual([
      "Campus: none",
      "Department: none",
      "Publishes now: no",
    ]);
  });

  test("a new M365 user shows job title and manager", () => {
    const html = renderCard("createM365User", {
      campus: "Oslo",
      department: "IT",
      firstName: "Ada",
      jobTitle: "Developer",
      lastName: "Lovelace",
      manager: "boss@biso.no",
      upnPrefix: "ada.lovelace",
    });

    expect(html).toContain("ada.lovelace@biso.no");
    expect(html).toContain("Job title: Developer");
    expect(html).toContain("Manager: boss@biso.no");
  });

  test("publish, delete and approve show a known title next to the id", () => {
    const knownTitles = collectKnownTitles([
      {
        parts: [
          {
            output: {
              data: [{ $id: "job-1", title_no: "Kasserer" }],
              success: true,
            },
            state: "output-available",
            type: "tool-searchContent",
          },
          {
            output: {
              data: [
                {
                  $id: "req-1",
                  action: "jobs.publish",
                  requester_email: "writer@biso.no",
                  resource_type: "job",
                },
              ],
              success: true,
            },
            state: "output-available",
            type: "tool-listPendingApprovals",
          },
        ],
      },
    ]);

    expect(
      describeToolCall(
        "publishContent",
        { domain: "jobs", id: "job-1" },
        knownTitles
      ).description
    ).toBe('"Kasserer" (jobs job-1). It goes live on the site.');
    expect(
      describeToolCall(
        "deleteContent",
        { domain: "jobs", id: "job-1" },
        knownTitles
      ).description
    ).toBe('"Kasserer" (jobs job-1). This can\'t be undone.');
    expect(
      describeToolCall("approveRequest", { requestId: "req-1" }, knownTitles)
        .description
    ).toBe('"jobs.publish (job), asked by writer@biso.no" (request req-1).');
  });

  test("without a known title the id is shown", () => {
    expect(
      describeToolCall("publishContent", { domain: "jobs", id: "job-9" })
        .description
    ).toBe("jobs job-9. It goes live on the site.");
    expect(
      describeToolCall("approveRequest", { requestId: "req-9" }).description
    ).toBe("Request req-9.");
  });

  test("titles come only from finished tool results; later ones win", () => {
    const titles = collectKnownTitles([
      {
        parts: [
          {
            input: { $id: "job-1", title_no: "From input" },
            state: "input-available",
            type: "tool-getContent",
          },
          {
            output: { data: { $id: "job-1", title_no: "Old" } },
            state: "output-available",
            type: "tool-getContent",
          },
        ],
      },
      {
        parts: [
          { text: '{"$id":"job-1","title_no":"Text"}', type: "text" },
          {
            output: { data: { $id: "job-1", title_no: "New" } },
            state: "output-available",
            type: "tool-getContent",
          },
        ],
      },
    ]);

    expect(titles.get("job-1")).toBe("New");
  });

  test("an unknown write tool lists all of its inputs", () => {
    const summary = describeToolCall("archiveEverything", {
      reason: "cleanup",
      scope: "all",
    });

    expect(summary.actionLabel).toBe("Run archiveEverything");
    expect(summary.details).toEqual(["reason: cleanup", "scope: all"]);
  });
});

describe("cards that can no longer be answered", () => {
  test("only the newest assistant message is answerable", () => {
    const messages = [
      { role: "user" },
      { role: "assistant" },
      { role: "user" },
      { role: "assistant" },
    ];

    expect(isAnswerableMessage(messages, 3)).toBe(true);
    expect(isAnswerableMessage(messages, 1)).toBe(false);
    expect(isAnswerableMessage([...messages, { role: "user" }], 3)).toBe(false);
  });

  test("an older card renders disabled buttons and says so", () => {
    const input = { domain: "jobs", id: "job-1" };
    const stale = renderCard("publishContent", input, { answerable: false });
    const live = renderCard("publishContent", input, { answerable: true });

    expect(stale.match(/<button[^>]*disabled=""/g)).toHaveLength(2);
    expect(stale).toContain("This card is no longer active");
    expect(live).not.toContain('disabled=""');
    expect(live).not.toContain("This card is no longer active");
  });
});
