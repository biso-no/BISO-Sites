import { isBisoRecipient } from "@repo/editor/submit-rules";
import type { PageDoc } from "@repo/editor/types";
import { describe, expect, it } from "vitest";
import { MAX_DATA_JSON_LENGTH, resolveSubmission } from "./form-submit";

function pageWith(...blocks: unknown[]): PageDoc {
  return {
    version: 2,
    meta: {},
    sections: [
      {
        id: "s1",
        layout: {},
        columns: [{ id: "c1", blocks }],
      },
    ],
  } as unknown as PageDoc;
}

const form = {
  id: "f1",
  type: "multiStepForm",
  heading: "Kontakt",
  submitMode: "email",
  recipientEmail: "post@biso.no",
  topic: "contact",
  accessTeamId: "team-a",
  steps: [
    {
      title: "En",
      fields: [{ name: "name", label: "Navn", fieldType: "text" }],
    },
    {
      title: "To",
      fields: [
        {
          name: "pick",
          label: "Valg",
          fieldType: "radio",
          options: [{ label: "A", value: "a" }],
        },
      ],
    },
  ],
};

describe("resolveSubmission", () => {
  it("rejects an unknown block", () => {
    expect(resolveSubmission(pageWith(form), "nope", {})).toEqual({
      ok: false,
      reason: "unknown-block",
    });
  });

  it("rejects a block that is not a form", () => {
    const doc = pageWith({
      id: "t1",
      type: "text",
      recipientEmail: "x@biso.no",
    });
    expect(resolveSubmission(doc, "t1", {})).toEqual({
      ok: false,
      reason: "not-a-form",
    });
  });

  it("drops keys that are not fields and keeps both steps", () => {
    const result = resolveSubmission(pageWith(form), "f1", {
      name: "Ada",
      pick: "a",
      recipientEmail: "evil@example.com",
      other: "x",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.submission.data).toEqual({ name: "Ada", pick: "A" });
    }
  });

  it("never takes the recipient, mode, topic or team from the data", () => {
    const result = resolveSubmission(pageWith(form), "f1", {
      name: "Ada",
      recipientEmail: "evil@example.com",
      submitMode: "database",
      topic: "x",
      accessTeamId: "mine",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.submission).toMatchObject({
        accessTeamId: "team-a",
        mode: "email",
        recipientEmail: "post@biso.no",
        topic: "contact",
      });
    }
  });

  it("takes labels from the block's field definitions", () => {
    const result = resolveSubmission(pageWith(form), "f1", { name: "Ada" });
    expect(result.ok && result.submission.fields).toEqual([
      { label: "Navn", name: "name" },
      { label: "Valg", name: "pick" },
    ]);
  });

  it("clamps values to 2000 characters and rejects oversized JSON", () => {
    const long = resolveSubmission(pageWith(form), "f1", {
      name: "x".repeat(5000),
    });
    expect(long.ok && String(long.submission.data.name).length).toBeLessThan(
      2100
    );

    const many = pageWith({
      ...form,
      steps: [
        {
          title: "x",
          fields: Array.from({ length: 12 }, (_, i) => ({
            name: `f${i}`,
            label: `F${i}`,
            fieldType: "text",
          })),
        },
      ],
    });
    const data = Object.fromEntries(
      Array.from({ length: 12 }, (_, i) => [`f${i}`, "y".repeat(2000)])
    );
    expect(JSON.stringify(data).length).toBeGreaterThan(MAX_DATA_JSON_LENGTH);
    expect(resolveSubmission(many, "f1", data)).toEqual({
      ok: false,
      reason: "too-large",
    });
  });

  it("clamps the topic to 100 and ignores non-scalar values", () => {
    const doc = pageWith({ ...form, topic: "t".repeat(300) });
    const result = resolveSubmission(doc, "f1", {
      name: { nested: true },
      pick: ["a", 3],
      name2: "x",
    });
    expect(result.ok).toBe(false);
    expect(resolveSubmission(doc, "f1", { name: "Ada" })).toMatchObject({
      ok: true,
      submission: { topic: expect.any(String) },
    });
    const ok = resolveSubmission(doc, "f1", { name: "Ada" });
    expect(ok.ok && ok.submission.topic).toHaveLength(100);
  });

  it("treats a signup as one email field whose empty topic falls back to its heading", () => {
    const doc = pageWith({
      id: "s",
      type: "signup",
      heading: "Meld deg på",
      placeholder: "",
      submitMode: "database",
      topic: "",
    });
    const result = resolveSubmission(doc, "s", { email: "a@b.no", x: "y" });
    expect(result.ok && result.submission).toMatchObject({
      data: { email: "a@b.no" },
      mode: "database",
      source: "signup",
      topic: "Meld deg på",
    });
  });
});

function typed(...fields: unknown[]) {
  return pageWith({
    ...form,
    accessTeamId: undefined,
    steps: [{ title: "x", fields }],
  });
}

describe("answers are validated by field type", () => {
  const options = [
    { label: "Ål", value: "al" },
    { label: "Øl", value: "ol" },
  ];

  it("keeps only a radio or select value that is an option, stored as its label", () => {
    const doc = typed(
      { name: "r", label: "R", fieldType: "radio", options },
      { name: "s", label: "S", fieldType: "select", options }
    );
    const good = resolveSubmission(doc, "f1", { r: "ol", s: "al" });
    expect(good.ok && good.submission.data).toEqual({ r: "Øl", s: "Ål" });
    expect(resolveSubmission(doc, "f1", { r: "nope", s: ["al"] }).ok).toBe(
      false
    );
  });

  it("accepts a multi-option checkbox only as an array of option values", () => {
    const doc = typed(
      { name: "c", label: "C", fieldType: "checkbox", options },
      { name: "t", label: "T", fieldType: "text" }
    );
    const good = resolveSubmission(doc, "f1", { c: ["al", "ol"], t: "x" });
    expect(good.ok && good.submission.data.c).toEqual(["Ål", "Øl"]);
    const bad = resolveSubmission(doc, "f1", { c: ["al", "evil"], t: "x" });
    expect(bad.ok && bad.submission.data).toEqual({ t: "x" });
    const wrong = resolveSubmission(doc, "f1", { c: true, t: "x" });
    expect(wrong.ok && wrong.submission.data).toEqual({ t: "x" });
  });

  it("accepts a single checkbox only as a boolean", () => {
    const doc = typed(
      { name: "c", label: "C", fieldType: "checkbox" },
      { name: "t", label: "T", fieldType: "text" }
    );
    const yes = resolveSubmission(doc, "f1", { c: true, t: "x" });
    expect(yes.ok && yes.submission.data.c).toBe(true);
    const str = resolveSubmission(doc, "f1", { c: "true", t: "x" });
    expect(str.ok && str.submission.data).toEqual({ t: "x" });
  });

  it("takes text fields as strings only and checks the shape of emails", () => {
    const doc = typed(
      { name: "t", label: "T", fieldType: "text" },
      { name: "e", label: "E", fieldType: "email" }
    );
    const result = resolveSubmission(doc, "f1", { t: ["x"], e: "nope" });
    expect(result.ok).toBe(false);
    const ok = resolveSubmission(doc, "f1", { t: "x", e: "a@b.no" });
    expect(ok.ok && ok.submission.data).toEqual({ e: "a@b.no", t: "x" });
  });

  it("never fills a hidden field", () => {
    const doc = typed(
      { name: "h", label: "H", fieldType: "hidden" },
      { name: "t", label: "T", fieldType: "text" }
    );
    const result = resolveSubmission(doc, "f1", { h: "x", t: "y" });
    expect(result.ok && result.submission.data).toEqual({ t: "y" });
  });
});

describe("block settings", () => {
  it("drops an access team that is not a valid Appwrite id", () => {
    const result = resolveSubmission(
      pageWith({ ...form, accessTeamId: "bad id; drop" }),
      "f1",
      { name: "Ada" }
    );
    expect(result.ok && result.submission.accessTeamId).toBeUndefined();
    expect(result.ok && result.submission.teamDropped).toBe(true);
  });

  it("falls back from an empty topic to the heading, then to a default", () => {
    const heading = resolveSubmission(pageWith({ ...form, topic: "" }), "f1", {
      name: "Ada",
    });
    expect(heading.ok && heading.submission.topic).toBe("Kontakt");
    const none = resolveSubmission(
      pageWith({ ...form, topic: "", heading: "" }),
      "f1",
      { name: "Ada" }
    );
    expect(none.ok && none.submission.topic).toBe("form");
  });
});

describe("isBisoRecipient", () => {
  it.each(["post@biso.no", "Post@BISO.NO"])("accepts %s", (address) => {
    expect(isBisoRecipient(address)).toBe(true);
  });

  it.each([
    "x@evilbiso.no",
    "x@biso.no.evil.com",
    "a@biso.no,b@evil.com",
    "a@biso.no\nbcc: b@evil.com",
    "a@biso.no\n",
    "a@biso.no b@evil.com",
    "a@sub.biso.no",
    "@biso.no",
    "",
    undefined,
    42,
  ])("rejects %j", (address) => {
    expect(isBisoRecipient(address)).toBe(false);
  });
});
