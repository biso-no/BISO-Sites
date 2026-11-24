import { describe, expect, it } from "vitest";
import { buildConnectEmail } from "./connect-email";

const HELP_URL = "https://biso.no/connect/help";

const one = {
  eventNameEn: "Winter Games 2027 EN",
  eventNameNo: "Winter Games 2027",
  helpUrl: HELP_URL,
  people: [
    {
      firstName: "Ola",
      lastName: "Nordmann",
      url: "https://biso.no/connect/t1",
    },
  ],
  reminder: false,
};

const shared = {
  ...one,
  people: [
    {
      firstName: "Ola",
      lastName: "Nordmann",
      url: "https://biso.no/connect/t1",
    },
    { firstName: "Kari", lastName: null, url: "https://biso.no/connect/t2" },
  ],
};

describe("buildConnectEmail", () => {
  it("norwegian comes before english", () => {
    const { html, text } = buildConnectEmail(one);
    const no = "Koble billetten til BISO-kontoen din";
    const en = "Connect your ticket to your BISO account";
    expect(html.indexOf(no)).toBeGreaterThan(-1);
    expect(html.indexOf(no)).toBeLessThan(html.indexOf(en));
    expect(text.indexOf(no)).toBeGreaterThan(-1);
    expect(text.indexOf(no)).toBeLessThan(text.indexOf(en));
  });

  it("uses the fixed copy with the event names", () => {
    const { text } = buildConnectEmail(one);
    expect(text).toContain(
      "Du er med på Winter Games 2027! Koble billetten til BISO-kontoen din, så får du bussen, rommet ditt og alle oppdateringer på ett sted. Logg inn med BI-kontoen din."
    );
    expect(text).toContain(
      "You're going to Winter Games 2027 EN! Connect your ticket to your BISO account to get your bus, your room and every update in one place. Sign in with your BI account."
    );
    expect(text).toContain(
      `Fikk du ikke e-posten, eller gjelder den ikke deg? ${HELP_URL}`
    );
    expect(text).toContain(`Wrong person, or lost the email? ${HELP_URL}`);
  });

  it("falls back to the norwegian name in english", () => {
    const { text } = buildConnectEmail({ ...one, eventNameEn: null });
    expect(text).toContain("You're going to Winter Games 2027!");
  });

  it("gives one person a button in each language", () => {
    const { html, text } = buildConnectEmail(one);
    expect(text).toContain("Koble billetten min: https://biso.no/connect/t1");
    expect(text).toContain("Connect my ticket: https://biso.no/connect/t1");
    expect(html).toContain('href="https://biso.no/connect/t1"');
    expect(text).not.toContain("Send hver lenke");
  });

  it("lists every person sharing an address", () => {
    const { html, text } = buildConnectEmail(shared);
    expect(text).toContain("Ola Nordmann: https://biso.no/connect/t1");
    expect(text).toContain("Kari: https://biso.no/connect/t2");
    expect(html).toContain('href="https://biso.no/connect/t2"');
    expect(html).toContain("Koble til");
    expect(text).toContain("Send hver lenke til personen den gjelder.");
    expect(text).toContain("Send each link to the person it belongs to.");
    expect(text).not.toContain("Koble billetten min");
  });

  it("escapes names", () => {
    const { html } = buildConnectEmail({
      ...shared,
      people: [
        { firstName: "<b>Ola</b>", lastName: null, url: "https://biso.no/c/1" },
        { firstName: "Kari", lastName: null, url: "https://biso.no/c/2" },
      ],
    });
    expect(html).toContain("&lt;b&gt;Ola&lt;/b&gt;");
    expect(html).not.toContain("<b>Ola</b>");
  });

  it("reminder subject starts with Påminnelse", () => {
    expect(buildConnectEmail({ ...one, reminder: true }).subject).toBe(
      "Påminnelse: Koble billetten din til BISO · Connect your ticket – Winter Games 2027"
    );
    expect(buildConnectEmail(one).subject).toBe(
      "Koble billetten din til BISO · Connect your ticket – Winter Games 2027"
    );
  });
});
