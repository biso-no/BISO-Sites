import { describe, expect, mock, test } from "bun:test";
import type { PageDoc } from "@repo/api/page-builder";
import {
  getPageTranslationSource,
  translatePageDocument,
} from "./page-document-translation";

const sourceDocument = {
  meta: {
    accentColor: "#001731",
    department: "department-1",
    description: "Den norske studentorganisasjonen",
    slug: "membership",
    status: "draft",
    title: "Medlemskap",
  },
  sections: [
    {
      columns: [
        {
          blocks: [
            {
              id: "hero-1",
              props: {
                body: "Kort introduksjon",
                ctaLabel: "Bli med nå",
                ctaUrl: "/membership",
                eyebrow: "Studentlivet starter her",
                href: "/membership",
                image: "https://example.com/hero.jpg",
                imageAlt: "Studenter på campus",
                subtitle: "For alle studenter",
                title: "Bli medlem",
              },
              type: "hero",
            },
          ],
          id: "c-1",
        },
        {
          blocks: [
            {
              id: "text-1",
              props: {
                content: "Les mer om fordelene.",
              },
              type: "text",
            },
          ],
          id: "c-2",
        },
      ],
      id: "s-1",
      layout: {},
    },
  ],
  version: 2,
} as unknown as PageDoc;

describe("page document translation", () => {
  test("extracts only translatable fields for stale-source comparison", () => {
    const source = getPageTranslationSource(sourceDocument);

    expect(new Set(Object.values(source))).toEqual(
      new Set([
        "Medlemskap",
        "Den norske studentorganisasjonen",
        "Kort introduksjon",
        "Bli med nå",
        "Studentlivet starter her",
        "Studenter på campus",
        "Bli medlem",
        "For alle studenter",
        "Les mer om fordelene.",
      ])
    );
    expect(JSON.stringify(source)).not.toContain("membership");
    expect(JSON.stringify(source)).not.toContain("hero.jpg");
    expect(JSON.stringify(source)).not.toContain("hero-1");
  });

  test("applies translated values without changing layout or identifiers", async () => {
    const translations = new Map([
      ["Medlemskap", "Membership"],
      [
        "Den norske studentorganisasjonen",
        "The Norwegian student organisation",
      ],
      ["Bli medlem", "Become a member"],
      ["Kort introduksjon", "Short introduction"],
      ["Bli med nå", "Join now"],
      ["Studentlivet starter her", "Student life starts here"],
      ["Studenter på campus", "Students on campus"],
      ["For alle studenter", "For every student"],
      ["Les mer om fordelene.", "Learn more about the benefits."],
    ]);
    const translate = mock(
      async ({ fields }: { fields: { key: string; value: string }[] }) =>
        Object.fromEntries(
          fields.map((field) => [
            field.key,
            translations.get(field.value) ?? field.value,
          ])
        )
    );

    const translated = await translatePageDocument(
      {
        document: sourceDocument,
        sourceLocale: "no",
        targetLocale: "en",
      },
      translate
    );

    expect(translated.meta.title).toBe("Membership");
    expect(translated.meta.description).toBe(
      "The Norwegian student organisation"
    );
    expect(translated.meta.slug).toBe("membership");
    expect(translated.meta.department).toBe("department-1");
    const [first, second] = (
      translated.sections as unknown as {
        columns: { blocks: unknown[] }[];
      }[]
    )[0].columns;
    expect(first.blocks).toEqual([
      {
        id: "hero-1",
        props: {
          body: "Short introduction",
          ctaLabel: "Join now",
          ctaUrl: "/membership",
          eyebrow: "Student life starts here",
          href: "/membership",
          image: "https://example.com/hero.jpg",
          imageAlt: "Students on campus",
          subtitle: "For every student",
          title: "Become a member",
        },
        type: "hero",
      },
    ]);
    expect(second.blocks).toEqual([
      {
        id: "text-1",
        props: { content: "Learn more about the benefits." },
        type: "text",
      },
    ]);
    expect(translate).toHaveBeenCalledTimes(1);
  });

  test("translates text inside a column", async () => {
    const document = {
      meta: {
        accentColor: "#3DA9E0",
        department: "",
        slug: "x",
        status: "draft",
        title: "Om oss",
      },
      sections: [
        {
          columns: [
            { blocks: [], id: "c-1" },
            {
              blocks: [
                {
                  author: "",
                  id: "b-1",
                  role: "",
                  text: "Hei alle sammen",
                  type: "quote",
                },
              ],
              id: "c-2",
            },
          ],
          id: "s-1",
          layout: {},
        },
      ],
      version: 2,
    } as unknown as PageDoc;
    const translated = await translatePageDocument(
      { document, sourceLocale: "no", targetLocale: "en" },
      async ({ fields }) =>
        Object.fromEntries(fields.map((f) => [f.key, `<translated>${f.value}`]))
    );
    const sections = translated.sections as unknown as {
      columns: { blocks: { text: string }[] }[];
    }[];
    expect(sections[0].columns[1].blocks[0].text).toBe(
      "<translated>Hei alle sammen"
    );
  });
});
