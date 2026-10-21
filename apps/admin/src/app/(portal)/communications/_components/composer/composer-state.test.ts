import { describe, expect, test } from "bun:test";
import {
  applyLinkedAudience,
  applyPrefill,
  COMPOSER_STEPS,
  type ComposerValues,
  canContinue,
  clearDepartmentOnCampusChange,
  initialComposerStep,
  type PrefillSnapshot,
  TYPE_CARDS,
  topicForType,
} from "./composer-state";

const base: ComposerValues = {
  audience_type: "broadcast",
  audience_value: "",
  body_en: null,
  body_no: null,
  campus_id: "1",
  category: "general",
  content_id: null,
  content_type: null,
  department_id: null,
  event_id: null,
  push: true,
  scheduled_at: null,
  title_en: "",
  title_no: null,
};

const prefill: PrefillSnapshot = {
  body_en: "<p>Body</p>",
  body_no: "<p>Kropp</p>",
  title_en: "Event title",
  title_no: "Arrangement",
};

describe("COMPOSER_STEPS and TYPE_CARDS", () => {
  test("steps and cards are exact", () => {
    expect([...COMPOSER_STEPS]).toEqual([
      "What",
      "Message",
      "Who",
      "Check & send",
    ]);
    expect(TYPE_CARDS.map((card) => card.id)).toEqual([
      "general",
      "event",
      "news",
      "job",
      "trip",
      "urgent",
    ]);
    const trip = TYPE_CARDS.find((card) => card.id === "trip");
    expect(trip).toMatchObject({ linkRequired: false, linkType: "event" });
    expect(topicForType("event")).toBe("events");
    expect(topicForType("news")).toBe("news");
    expect(topicForType("job")).toBe("jobs");
    expect(topicForType(null)).toBeNull();
  });
});

describe("applyPrefill", () => {
  test("fills empty fields", () => {
    const next = applyPrefill(base, prefill, null);
    expect(next).toMatchObject(prefill);
  });

  test("keeps a typed title", () => {
    const next = applyPrefill({ ...base, title_en: "My own" }, prefill, null);
    expect(next.title_en).toBe("My own");
    expect(next.body_en).toBe("<p>Body</p>");
  });

  test("replaces a field that still holds the previous prefill", () => {
    const previous: PrefillSnapshot = { ...prefill, title_en: "Old" };
    const next = applyPrefill({ ...base, title_en: "Old" }, prefill, previous);
    expect(next.title_en).toBe("Event title");
  });

  test("never touches a field changed after the previous prefill", () => {
    const previous: PrefillSnapshot = { ...prefill, title_en: "Old" };
    const next = applyPrefill(
      { ...base, title_en: "Old (edited)" },
      prefill,
      previous
    );
    expect(next.title_en).toBe("Old (edited)");
  });
});

describe("applyLinkedAudience", () => {
  const link = { campusId: "2", topic: "events" as const };

  test("sets topic and campus when untouched and allowed", () => {
    const next = applyLinkedAudience(base, link, {
      allowed: true,
      audienceTouched: false,
    });
    expect(next).toMatchObject({
      audience_type: "topic",
      audience_value: "events",
      campus_id: "2",
    });
  });

  test("leaves the audience alone when touched or not allowed", () => {
    expect(
      applyLinkedAudience(base, link, { allowed: true, audienceTouched: true })
    ).toEqual(base);
    expect(
      applyLinkedAudience(base, link, {
        allowed: false,
        audienceTouched: false,
      })
    ).toEqual(base);
  });
});

describe("canContinue", () => {
  test("a News card without a link is blocked", () => {
    const result = canContinue(0, {
      ...base,
      category: "news",
      title_en: "Hi",
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBeString();
  });

  test("a News card with a link and title passes; a missing title blocks", () => {
    const linked = { ...base, category: "news" as const, content_id: "n1" };
    expect(canContinue(0, { ...linked, title_en: "Hi" }).ok).toBe(true);
    expect(canContinue(0, linked).ok).toBe(false);
  });

  test("a Trip needs no link", () => {
    expect(
      canContinue(0, { ...base, category: "trip", title_en: "Hi" }).ok
    ).toBe(true);
  });

  test("Who with people needs at least one person", () => {
    const users = { ...base, audience_type: "users" as const };
    expect(canContinue(2, { ...users, audience_value: "[]" })).toEqual({
      ok: false,
      reason: "Add at least one person.",
    });
    expect(canContinue(2, { ...users, audience_value: '["u1"]' }).ok).toBe(
      true
    );
    expect(canContinue(2, base).ok).toBe(true);
  });
});

describe("initialComposerStep", () => {
  test("?step=check opens Check & send", () => {
    expect(initialComposerStep("check")).toBe(3);
  });

  test("anything else opens What", () => {
    expect(initialComposerStep(undefined)).toBe(0);
    expect(initialComposerStep("")).toBe(0);
    expect(initialComposerStep("who")).toBe(0);
    expect(initialComposerStep("3")).toBe(0);
    expect(initialComposerStep(["check", "who"])).toBe(0);
  });
});

describe("clearDepartmentOnCampusChange", () => {
  const withDepartment = { ...base, department_id: "dept-1" };

  test("a new campus drops the department", () => {
    expect(
      clearDepartmentOnCampusChange(withDepartment, {
        ...withDepartment,
        campus_id: "2",
      }).department_id
    ).toBeNull();
    expect(
      clearDepartmentOnCampusChange(withDepartment, {
        ...withDepartment,
        campus_id: null,
      }).department_id
    ).toBeNull();
  });

  test("a pinned department survives a campus change", () => {
    expect(
      clearDepartmentOnCampusChange(
        withDepartment,
        { ...withDepartment, campus_id: "2" },
        { keepDepartment: true }
      ).department_id
    ).toBe("dept-1");
  });

  test("the same campus keeps it", () => {
    const next = { ...withDepartment, title_en: "Hi" };
    expect(clearDepartmentOnCampusChange(withDepartment, next)).toBe(next);
  });

  test("a department picked with the campus change is kept", () => {
    expect(
      clearDepartmentOnCampusChange(withDepartment, {
        ...withDepartment,
        campus_id: "2",
        department_id: "dept-2",
      }).department_id
    ).toBe("dept-2");
  });
});
