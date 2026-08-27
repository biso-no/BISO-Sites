import { beforeEach, describe, expect, mock, test } from "bun:test";

let deferredCallback: (() => Promise<void> | void) | undefined;
const afterSpy = mock((callback: () => Promise<void> | void) => {
  deferredCallback = callback;
});
const generateObjectSpy = mock(async (_input: unknown) => ({
  object: {
    translations: [
      { key: "title", translated: "English title" },
      { key: "body", translated: "<p>English body</p>" },
    ],
  },
}));

mock.module("next/server", () => ({ after: afterSpy }));
mock.module("ai", () => ({ generateObject: generateObjectSpy }));

const {
  getAutoTranslationDescription,
  getTargetLocale,
  getTranslationActionLabel,
  isCurrentTranslationSource,
} = await import("./content-translation");
const {
  parseAutoTranslationOptions,
  scheduleContentTranslation,
  translateContentFields,
} = await import("./content-translation.server");

beforeEach(() => {
  deferredCallback = undefined;
  afterSpy.mockClear();
  generateObjectSpy.mockClear();
});

describe("content translation locale helpers", () => {
  test("maps each supported source locale to the other locale", () => {
    expect(getTargetLocale("no")).toBe("en");
    expect(getTargetLocale("en")).toBe("no");
  });

  test("names the destination language in manual and automatic copy", () => {
    expect(getTranslationActionLabel("no")).toBe("Generate English");
    expect(getTranslationActionLabel("en")).toBe("Generate Norwegian");
    expect(getAutoTranslationDescription("no", "save or publish")).toBe(
      "Translate Norwegian to English after save or publish"
    );
    expect(getAutoTranslationDescription("en", "publish")).toBe(
      "Translate English to Norwegian after publish"
    );
  });

  test("detects a stale source snapshot", () => {
    expect(
      isCurrentTranslationSource(
        { body: "Same", title: "A" },
        { body: "Same", title: "B" }
      )
    ).toBeFalse();
    expect(
      isCurrentTranslationSource(
        { body: "Same", title: "A" },
        { body: "Same", title: "A" }
      )
    ).toBeTrue();
  });
});

describe("content translation service", () => {
  test("rejects forged automatic translation options", () => {
    expect(() =>
      parseAutoTranslationOptions({ enabled: true, sourceLocale: "de" })
    ).toThrow("Invalid auto-translation options");
    expect(
      parseAutoTranslationOptions({ enabled: true, sourceLocale: "en" })
    ).toEqual({ enabled: true, sourceLocale: "en" });
  });

  test("uses one structured request and restores omitted empty fields", async () => {
    const result = await translateContentFields({
      contentType: "news article",
      fields: [
        { format: "plain", key: "title", value: "Norsk tittel" },
        { format: "html", key: "body", value: "<p>Norsk brødtekst</p>" },
        { format: "plain", key: "lead", value: "" },
      ],
      sourceLocale: "no",
      targetLocale: "en",
    });

    expect(result).toEqual({
      body: "<p>English body</p>",
      lead: "",
      title: "English title",
    });
    expect(generateObjectSpy).toHaveBeenCalledTimes(1);
    const request = generateObjectSpy.mock.calls[0]?.[0] as {
      model: { modelId: string };
      prompt: string;
    };
    expect(request.model.modelId).toBe("gpt-5.6-luna");
    expect(request.prompt).toContain("Norwegian Bokmål to English");
    expect(request.prompt).toContain("title");
    expect(request.prompt).toContain("body");
    expect(request.prompt).not.toContain('"key":"lead"');
  });

  test("rejects duplicate or unsafe field keys before calling the model", async () => {
    await expect(
      translateContentFields({
        contentType: "event",
        fields: [
          { format: "plain", key: "title", value: "A" },
          { format: "plain", key: "title", value: "B" },
        ],
        sourceLocale: "en",
        targetLocale: "no",
      })
    ).rejects.toThrow("Translation field keys must be unique");

    await expect(
      translateContentFields({
        contentType: "event",
        fields: [{ format: "plain", key: "bad key", value: "A" }],
        sourceLocale: "en",
        targetLocale: "no",
      })
    ).rejects.toThrow("Invalid translation field key");
    expect(generateObjectSpy).not.toHaveBeenCalled();
  });

  test("rejects an identical source and target locale", async () => {
    await expect(
      translateContentFields({
        contentType: "benefit",
        fields: [{ format: "plain", key: "title", value: "Fordel" }],
        sourceLocale: "no",
        targetLocale: "no",
      })
    ).rejects.toThrow("Source and target locales must differ");
  });
});

describe("content translation scheduling", () => {
  test("does not defer disabled translation", () => {
    const task = mock(async () => undefined);

    expect(scheduleContentTranslation({ enabled: false, task })).toBeFalse();
    expect(afterSpy).not.toHaveBeenCalled();
  });

  test("runs an enabled task after the response", async () => {
    const task = mock(async () => undefined);

    expect(scheduleContentTranslation({ enabled: true, task })).toBeTrue();
    expect(afterSpy).toHaveBeenCalledTimes(1);
    await deferredCallback?.();
    expect(task).toHaveBeenCalledTimes(1);
  });

  test("isolates deferred translation failures from the source operation", async () => {
    const errorSpy = mock(() => undefined);
    const originalConsoleError = console.error;
    console.error = errorSpy;
    const task = mock(() => Promise.reject(new Error("model unavailable")));

    try {
      expect(scheduleContentTranslation({ enabled: true, task })).toBeTrue();
      await deferredCallback?.();
      expect(errorSpy).toHaveBeenCalledWith(
        "[content-translation] background task failed",
        expect.any(Error)
      );
    } finally {
      console.error = originalConsoleError;
    }
  });
});
