import { describe, expect, test } from "bun:test";
import { buildAssistantCapabilities } from "./authz";
import { buildAssistantSystemPrompt } from "./prompt";

function promptWithForm(): string {
  return buildAssistantSystemPrompt({
    activeCampus: null,
    activeFormSchemaId: "job-studio",
    capabilities: buildAssistantCapabilities({
      hasDepartmentMembership: false,
      isCampusAdmin: false,
      roles: ["globaladmin"],
    }),
    currentPath: "/jobs/new",
    locale: "en",
    roleSummary: "Global admin",
    scopeSummary: "All campuses visible",
    user: { email: "admin@example.com", name: "Admin" },
  });
}

describe("assistant system prompt", () => {
  test("writes go straight to their tool, whose card is the confirmation", () => {
    const prompt = promptWithForm();

    expect(prompt).toContain("Call the write tool directly");
    expect(prompt).toContain("Don't call `confirmAction` before a write tool.");
    // That sentence is the only place the prompt names confirmAction.
    expect(prompt.split("confirmAction").length - 1).toBe(1);
  });
});
