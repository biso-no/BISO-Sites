import { describe, expect, test } from "bun:test";
import {
  buildCandidateEmailPrompt,
  RECRUITMENT_EMAIL_SYSTEM_PROMPT,
} from "./recruitment-email-prompt";

describe("buildCandidateEmailPrompt", () => {
  test("carries the placeholder and no way to receive a name", () => {
    const prompt = buildCandidateEmailPrompt({
      context: "Strong interview",
      stage: "interview_invite",
      vacancy: {
        metadata: {} as never,
        translations: [{ locale: "en", title: "Barista" }] as never,
      },
    });
    expect(prompt).toContain("Candidate name: [Candidate]");
    expect(prompt).toContain("Barista");
    expect(RECRUITMENT_EMAIL_SYSTEM_PROMPT).toContain('"[Candidate]"');
  });
});
