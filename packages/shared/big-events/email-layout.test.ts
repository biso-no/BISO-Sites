import { describe, expect, it } from "vitest";
import { renderEmail } from "./email-layout";

const PADDED_BUTTON_CELL =
  /<td bgcolor="#3DA9E0" style="[^"]*padding:12px 24px/;
const BUTTON_LINK = /<a href="https:\/\/biso\.no\/c\/1"[^>]*>/;

const input = {
  footer: "Questions? https://biso.no/connect/help",
  preheader: "Hidden preview",
  sections: [
    {
      button: { label: "Koble billetten min", url: "https://biso.no/c/1" },
      heading: "Winter Games",
      lang: "no" as const,
      paragraphs: ["Hei <b>du</b> & velkommen."],
    },
    {
      button: { label: "Connect my ticket", url: "https://biso.no/c/1" },
      heading: "Winter Games",
      lang: "en" as const,
      paragraphs: ["Hi there."],
    },
  ],
};

describe("renderEmail", () => {
  it("escapes text and keeps the sections in order", () => {
    const { html } = renderEmail(input);
    expect(html).toContain("Hei &lt;b&gt;du&lt;/b&gt; &amp; velkommen.");
    expect(html).not.toContain("<b>du</b>");
    expect(html.indexOf('lang="no"')).toBeLessThan(html.indexOf('lang="en"'));
  });

  it("puts a hairline between language sections only", () => {
    const { html } = renderEmail(input);
    expect(html.split("border-top:1px solid")).toHaveLength(2);
  });

  it("uses the brand navy and a 560px card", () => {
    const { html } = renderEmail(input);
    expect(html).toContain("#001731");
    expect(html).toContain("max-width:560px");
  });

  it("links the button and urls in the footer", () => {
    const { html } = renderEmail(input);
    expect(html).toContain('href="https://biso.no/c/1"');
    expect(html).toContain('href="https://biso.no/connect/help"');
  });

  it("pads the button cell, not the link, so Outlook keeps its size", () => {
    const { html } = renderEmail(input);
    expect(html).toMatch(PADDED_BUTTON_CELL);
    const buttonLink = html.match(BUTTON_LINK);
    expect(buttonLink?.[0]).not.toContain("padding");
  });

  it("refuses a link that is not http(s)", () => {
    expect(() =>
      renderEmail({
        ...input,
        sections: [
          {
            ...input.sections[0],
            button: { label: "x", url: "javascript:alert(1)" },
          },
        ],
      })
    ).toThrow();
  });

  it("text version mirrors the html", () => {
    const { text } = renderEmail(input);
    expect(text).toContain("Winter Games");
    expect(text).toContain("Hei <b>du</b> & velkommen.");
    expect(text).toContain("Koble billetten min: https://biso.no/c/1");
    expect(text.indexOf("Hei")).toBeLessThan(text.indexOf("Hi there."));
    expect(text).toContain("Questions? https://biso.no/connect/help");
    expect(text).not.toContain("<td");
  });

  it("lists person links with their own url", () => {
    const { html, text } = renderEmail({
      ...input,
      sections: [
        {
          heading: "Winter Games",
          lang: "no",
          links: [
            { label: "Koble til", text: "Ola", url: "https://biso.no/c/1" },
            { label: "Koble til", text: "Kari", url: "https://biso.no/c/2" },
          ],
          paragraphs: [],
        },
      ],
    });
    expect(html).toContain('href="https://biso.no/c/2"');
    expect(text).toContain("Ola: https://biso.no/c/1");
    expect(text).toContain("Kari: https://biso.no/c/2");
  });
});
