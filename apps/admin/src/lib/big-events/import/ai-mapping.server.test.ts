import { beforeEach, describe, expect, mock, test } from "bun:test";

mock.module("server-only", () => ({}));
mock.module("@repo/ai/models", () => ({ fastModel: "fast-model" }));
mock.module("@repo/observability/ai", () => ({
  traceAiCall: (_meta: unknown, fn: () => unknown) => fn(),
}));

interface GenerateArgs {
  prompt: string;
}
const generateObject = mock(
  async (_args: GenerateArgs): Promise<{ object: unknown }> => ({
    object: { columns: [] },
  })
);
mock.module("ai", () => ({ generateObject }));

const { suggestColumnsWithAi } = await import("./ai-mapping.server");

describe("suggestColumnsWithAi", () => {
  beforeEach(() => {
    generateObject.mockReset();
  });

  test("sends header names and shapes only", async () => {
    generateObject.mockResolvedValue({ object: { columns: [] } });
    await suggestColumnsWithAi([
      { index: 3, header: "Kolonne D", shape: "text@domain" },
    ]);
    const prompt = generateObject.mock.calls[0]?.[0].prompt ?? "";
    expect(prompt).toContain("Kolonne D");
    expect(prompt).toContain("text@domain");
  });

  test("maps the model's answer to fields", async () => {
    generateObject.mockResolvedValue({
      object: { columns: [{ index: 3, field: "email" }] },
    });
    const result = await suggestColumnsWithAi([
      { index: 3, header: "Kolonne D", shape: "text@domain" },
    ]);
    expect(result).toEqual({ 3: "email" });
  });

  test("returns nothing when the model fails", async () => {
    generateObject.mockRejectedValue(new Error("boom"));
    const result = await suggestColumnsWithAi([
      { index: 3, header: "Kolonne D", shape: "text@domain" },
    ]);
    expect(result).toEqual({});
  });
});
