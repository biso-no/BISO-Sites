import { describe, expect, mock, test } from "bun:test";
import type { PageDoc } from "@repo/api/page-builder";
import {
  getPageTranslationSource,
  translatePageDocument,
} from "./page-document-translation";

const sourceDocument: PageDoc = {
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
    {
      id: "text-1",
      props: {
        content: "Les mer om fordelene.",
      },
      type: "text",
    },
  ],
  meta: {
    accentColor: "#001731",
    department: "department-1",
    description: "Den norske studentorganisasjonen",
    slug: "membership",
    status: "draft",
    title: "Medlemskap",
  },
};

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
    expect(translated.blocks).toEqual([
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
      {
        id: "text-1",
        props: { content: "Learn more about the benefits." },
        type: "text",
      },
    ]);
    expect(translate).toHaveBeenCalledTimes(1);
  });
});
