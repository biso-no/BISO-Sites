import { describe, expect, mock, test } from "bun:test";
import type { PageDoc } from "@repo/api/page-builder";
import {
  getPageTranslationSource,
  translatePageDocument,
} from "./page-document-translation";

const sourceDocument = {
  meta: {
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

  test("translates a facts item's text, not its link", async () => {
    const document = {
      meta: {
        department: "",
        slug: "x",
        status: "draft",
        title: "Om oss",
      },
      sections: [
        {
          columns: [
            {
              blocks: [
                {
                  id: "b-1",
                  items: [
                    { href: "/kontakt", label: "Sted", text: "Oslo sentrum" },
                  ],
                  type: "facts",
                },
              ],
              id: "c-1",
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
      columns: { blocks: { items: { href: string; text: string }[] }[] }[];
    }[];
    const item = sections[0].columns[0].blocks[0].items[0];
    expect(item.text).toBe("<translated>Oslo sentrum");
    expect(item.href).toBe("/kontakt");
  });

  test("translates the page header's text, not its links or media", async () => {
    const document = {
      header: {
        buttons: [{ href: "/join", label: "Bli med", style: "primary" }],
        crumbs: [{ href: "/units", label: "Enheter" }],
        eyebrow: "BISO Oslo",
        lede: "Tre dager på Storefjell",
        media: {
          alt: "Studenter i snøen",
          kind: "image",
          src: "https://example.com/a.jpg",
        },
        title: "Vinterlekene",
        variant: "split",
      },
      meta: {
        department: "",
        slug: "x",
        status: "draft",
        title: "Om oss",
      },
      sections: [],
      version: 2,
    } as unknown as PageDoc;

    const source = getPageTranslationSource(document);
    expect(source["header.lede"]).toBe("Tre dager på Storefjell");
    expect(source["header.title"]).toBe("Vinterlekene");
    expect(source["header.eyebrow"]).toBe("BISO Oslo");
    expect(source["header.crumbs[0].label"]).toBe("Enheter");
    expect(source["header.buttons[0].label"]).toBe("Bli med");
    expect(source["header.media.alt"]).toBe("Studenter i snøen");
    expect(JSON.stringify(source)).not.toContain("/join");
    expect(JSON.stringify(source)).not.toContain("split");
    expect(JSON.stringify(source)).not.toContain("primary");

    const translated = await translatePageDocument(
      { document, sourceLocale: "no", targetLocale: "en" },
      async ({ fields }) =>
        Object.fromEntries(fields.map((f) => [f.key, `EN:${f.value}`]))
    );
    const header = (
      translated as unknown as { header: Record<string, unknown> }
    ).header;
    expect(header.lede).toBe("EN:Tre dager på Storefjell");
    expect(header.variant).toBe("split");
    expect(header.buttons).toEqual([
      { href: "/join", label: "EN:Bli med", style: "primary" },
    ]);
  });

  test("translates a photo section's alt text but no other layout value", async () => {
    const document = {
      meta: {
        department: "",
        slug: "x",
        status: "draft",
        title: "Om oss",
      },
      sections: [
        {
          columns: [{ blocks: [], id: "c-1" }],
          id: "s-1",
          layout: {
            align: "top",
            background: "photo",
            backgroundImage: {
              alt: "Studenter på campus",
              fileId: "file-1",
              src: "https://example.com/campus.jpg",
            },
            columns: "1",
            spacing: "normal",
            tablet: "row",
          },
        },
      ],
      version: 2,
    } as unknown as PageDoc;

    const source = getPageTranslationSource(document);
    expect(source).toEqual({
      "meta.title": "Om oss",
      "sections[0].layout.backgroundImage.alt": "Studenter på campus",
    });

    const translated = await translatePageDocument(
      { document, sourceLocale: "no", targetLocale: "en" },
      async ({ fields }) =>
        Object.fromEntries(fields.map((f) => [f.key, `EN:${f.value}`]))
    );
    const [section] = translated.sections as unknown as {
      layout: Record<string, unknown>;
    }[];
    expect(section.layout).toEqual({
      align: "top",
      background: "photo",
      backgroundImage: {
        alt: "EN:Studenter på campus",
        fileId: "file-1",
        src: "https://example.com/campus.jpg",
      },
      columns: "1",
      spacing: "normal",
      tablet: "row",
    });
  });

  test("translates a card image's alt text but not its src, fileId or mime", async () => {
    const document = {
      meta: {
        department: "",
        slug: "x",
        status: "draft",
        title: "Om oss",
      },
      sections: [
        {
          columns: [
            {
              blocks: [
                {
                  columns: 3,
                  id: "b-1",
                  items: [
                    {
                      body: "Tekst",
                      image: {
                        alt: "En bygning ved sjøen",
                        fileId: "file-9",
                        mime: "image/png",
                        src: "https://example.com/bygg.png",
                      },
                      title: "Oslo",
                    },
                  ],
                  layout: "grid",
                  style: "bordered",
                  type: "cards",
                },
              ],
              id: "c-1",
            },
          ],
          id: "s-1",
          layout: {},
        },
      ],
      version: 2,
    } as unknown as PageDoc;

    const source = getPageTranslationSource(document);
    expect(source).toEqual({
      "meta.title": "Om oss",
      "sections[0].columns[0].blocks[0].items[0].body": "Tekst",
      "sections[0].columns[0].blocks[0].items[0].image.alt":
        "En bygning ved sjøen",
      "sections[0].columns[0].blocks[0].items[0].title": "Oslo",
    });

    const translated = await translatePageDocument(
      { document, sourceLocale: "no", targetLocale: "en" },
      async ({ fields }) =>
        Object.fromEntries(fields.map((f) => [f.key, `EN:${f.value}`]))
    );
    const [section] = translated.sections as unknown as {
      columns: { blocks: { items: { image: unknown }[] }[] }[];
    }[];
    expect(section.columns[0]?.blocks[0]?.items[0]?.image).toEqual({
      alt: "EN:En bygning ved sjøen",
      fileId: "file-9",
      mime: "image/png",
      src: "https://example.com/bygg.png",
    });
  });
});
