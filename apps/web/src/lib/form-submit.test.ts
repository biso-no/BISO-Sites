import type { PageDoc } from "@repo/editor/types";
import { describe, expect, it } from "vitest";
import {
  isBisoRecipient,
  MAX_DATA_JSON_LENGTH,
  resolveSubmission,
} from "./form-submit";

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
      expect(result.submission.data).toEqual({ name: "Ada", pick: "a" });
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
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.submission.topic).toHaveLength(100);
      expect(result.submission.data).toEqual({ pick: ["a"] });
    }
  });

  it("treats a signup as one email field with a default topic", () => {
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
      topic: "signup",
    });
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
