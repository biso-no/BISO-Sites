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
      "Hei {fornavn} / {First Name}, {buss} {departure} {  meeting   point } {oppmøtested} {BUSSKONTAKT} {rom} {Hjemreise} {trip  home}"
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
      "trip_home",
      "trip_home",
    ]);
    expect(placeholderToken("no", "first_name")).toBe("{fornavn}");
    expect(placeholderToken("en", "meeting_point")).toBe("{meeting point}");
    expect(placeholderToken("no", "trip_home")).toBe("{hjemreise}");
    expect(placeholderToken("en", "trip_home")).toBe("{trip home}");
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

  it("drops a separator a removed placeholder leaves before a closing mark", () => {
    const push = { forPush: true };
    expect(renderText("Hei, {fornavn}!", {}, push)).toBe("Hei!");
    expect(renderText("Hei, {fornavn}?", {}, push)).toBe("Hei?");
    expect(renderText("Hei, {fornavn}.", {}, push)).toBe("Hei.");
    expect(renderText("Hei, {fornavn}, bussen går kl. 14", {}, push)).toBe(
      "Hei, bussen går kl. 14"
    );
    expect(renderText("Hei; {fornavn}: bussen", {}, push)).toBe("Hei: bussen");
    expect(renderText("Hei, {fornavn}", {}, push)).toBe("Hei");
    expect(renderText("Hei, {fornavn}\nBussen går", {}, push)).toBe(
      "Hei\nBussen går"
    );
    // A separator before text that goes on stays.
    expect(renderText("Hei, {fornavn} og velkommen", {}, push)).toBe(
      "Hei, og velkommen"
    );
    // The name, when it is there, keeps the comma.
    expect(renderText("Hei, {fornavn}!", { first_name: "Ola" })).toBe(
      "Hei, Ola!"
    );
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

  it("the bus defaults end with the trip home, left out when empty", () => {
    const { en, no } = defaultAutoTexts("bus_moved");
    const out = { bus: "Buss 1", departure: "fre. 24. jan. kl. 14:00" };
    expect(renderText(no.body, { ...out, meeting_point: "Nydalen T" })).toBe(
      "Hei! Bussplassen din er endret. Du er på Buss 1. Den går fre. 24. jan. kl. 14:00 fra Nydalen T."
    );
    expect(
      renderText(
        en.body,
        {
          ...out,
          first_name: "Ola",
          meeting_point: "Nydalen T",
          trip_home: "Home: Buss 2, Sun 26 Jan, 12:15.",
        },
        { forPush: true }
      )
    ).toBe(
      "Hi! Your bus seat has changed. You're on Buss 1. It leaves fre. 24. jan. kl. 14:00 from Nydalen T. Home: Buss 2, Sun 26 Jan, 12:15."
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
        body: "Hei {fornavn}! Du skal med {buss}. Den går {avgang} fra {oppmøtested}. {hjemreise}",
      },
      en: {
        title: "Your bus",
        body: "Hi {first name}! You're on {bus}. It leaves {departure} from {meeting point}. {trip home}",
      },
    });
    expect(defaultAutoTexts("bus_moved")).toEqual({
      no: {
        title: "Ny buss",
        body: "Hei {fornavn}! Bussplassen din er endret. Du er på {buss}. Den går {avgang} fra {oppmøtested}. {hjemreise}",
      },
      en: {
        title: "New bus",
        body: "Hi {first name}! Your bus seat has changed. You're on {bus}. It leaves {departure} from {meeting point}. {trip home}",
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
