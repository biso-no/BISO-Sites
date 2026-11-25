import { describe, expect, it } from "vitest";
import {
  defaultAutoTexts,
  findPlaceholders,
  PLACEHOLDER_LABELS,
  PLACEHOLDERS,
  placeholderToken,
  renderText,
} from "./text";

describe("message text", () => {
  it("reads placeholders in either language", () => {
    const found = findPlaceholders(
      "Hei {fornavn} / {First Name}, {buss} {departure} {  meeting   point } {oppmøtested} {BUSSKONTAKT} {rom}"
    );
    expect(found.unknown).toEqual([]);
    expect(found.known).toEqual([
      "first_name",
      "first_name",
      "bus",
      "departure",
      "meeting_point",
      "meeting_point",
      "bus_contact",
      "room",
    ]);
    expect(placeholderToken("no", "first_name")).toBe("{fornavn}");
    expect(placeholderToken("en", "meeting_point")).toBe("{meeting point}");
    expect(PLACEHOLDER_LABELS.no.first_name).toBe("fornavn");
    expect(Object.keys(PLACEHOLDER_LABELS.en)).toEqual([...PLACEHOLDERS]);
  });

  it("flags unknown braces", () => {
    const found = findPlaceholders('Hi {name} {bus} { {"a": 1} } and {');
    expect(found.known).toEqual(["bus"]);
    expect(found.unknown).toEqual(["name"]);
  });

  it("empty values leave no braces", () => {
    const out = renderText("Hei {fornavn}! Buss {buss} fra {oppmøtested} .", {
      first_name: "Ola",
      bus: "Buss 3",
      meeting_point: "",
    });
    expect(out).toBe("Hei Ola! Buss Buss 3 fra.");
    expect(out).not.toContain("{");
    expect(out).not.toContain("  ");
    expect(out).not.toContain(" .");
    expect(renderText("Hei {fornavn}!", {})).toBe("Hei!");
  });

  it("leaves unknown braces and untouched text alone", () => {
    expect(renderText('A  {x} {"a": 1}  b', { bus: "1" })).toBe(
      'A  {x} {"a": 1}  b'
    );
  });

  it("push text drops the first name", () => {
    const text = "Hei {first name}! You're on {bus}.";
    const vars = { first_name: "Ola", bus: "Bus 3" };
    expect(renderText(text, vars)).toBe("Hei Ola! You're on Bus 3.");
    expect(renderText(text, vars, { forPush: true })).toBe(
      "Hei! You're on Bus 3."
    );
  });

  it("drops orphan punctuation after a removed placeholder at a line start", () => {
    const push = { forPush: true };
    expect(renderText("{fornavn}, bussen din går kl. 14", {}, push)).toBe(
      "bussen din går kl. 14"
    );
    expect(renderText("Hello\n{fornavn}, hi", {}, push)).toBe("Hello\nhi");
    expect(renderText("Hello\n  {fornavn}: hi", {}, push)).toBe("Hello\n  hi");
  });

  it("keeps newlines and strips blanks left before them", () => {
    expect(renderText("Hei {fornavn}\nBuss {buss}", { bus: "3" }, {})).toBe(
      "Hei\nBuss 3"
    );
    expect(renderText("Buss {buss} \nNeste", {})).toBe("Buss\nNeste");
    expect(renderText("\nHei {fornavn}\n", {})).toBe("\nHei\n");
  });

  it("handles adjacent placeholders and missing keys", () => {
    expect(renderText("{fornavn}{buss}", {})).toBe("");
    expect(
      renderText("A {fornavn}{buss} B", { bus: "3" }, { forPush: true })
    ).toBe("A 3 B");
    expect(renderText("Fra {oppmøtested}.", { meeting_point: undefined })).toBe(
      "Fra."
    );
    expect(renderText("Fra {oppmøtested}.", { meeting_point: "" })).toBe(
      "Fra."
    );
  });

  it("leaves intentional spacing elsewhere alone", () => {
    expect(renderText("A  b\n    c {buss} d  e ", {})).toBe(
      "A  b\n    c d  e "
    );
  });

  it("defaults exist for every automatic kind in both languages", () => {
    for (const kind of [
      "bus_assigned",
      "bus_moved",
      "bus_none",
      "departure_reminder",
    ] as const) {
      const texts = defaultAutoTexts(kind);
      for (const locale of ["no", "en"] as const) {
        expect(texts[locale].title.length).toBeGreaterThan(0);
        expect(texts[locale].body.length).toBeGreaterThan(0);
        expect(findPlaceholders(texts[locale].body).unknown).toEqual([]);
      }
    }
    expect(defaultAutoTexts("bus_assigned")).toEqual({
      no: {
        title: "Bussen din",
        body: "Hei {fornavn}! Du skal med {buss}. Den går {avgang} fra {oppmøtested}.",
      },
      en: {
        title: "Your bus",
        body: "Hi {first name}! You're on {bus}. It leaves {departure} from {meeting point}.",
      },
    });
    expect(defaultAutoTexts("bus_moved")).toEqual({
      no: {
        title: "Ny buss",
        body: "Hei {fornavn}! Du er flyttet til {buss}. Den går {avgang} fra {oppmøtested}.",
      },
      en: {
        title: "New bus",
        body: "Hi {first name}! You've been moved to {bus}. It leaves {departure} from {meeting point}.",
      },
    });
    expect(defaultAutoTexts("bus_none")).toEqual({
      no: {
        title: "Bussplassen din",
        body: "Hei {fornavn}! Du har ikke plass på noen buss akkurat nå. Arrangørene gir deg beskjed.",
      },
      en: {
        title: "Your bus seat",
        body: "Hi {first name}! You don't have a seat on a bus right now. The organizers will let you know.",
      },
    });
    expect(defaultAutoTexts("departure_reminder")).toEqual({
      no: {
        title: "Bussen går snart",
        body: "{buss} går {avgang} fra {oppmøtested}. Ha medlemsbeviset klart.",
      },
      en: {
        title: "Your bus leaves soon",
        body: "{bus} leaves {departure} from {meeting point}. Have your member pass ready.",
      },
    });
  });
});
