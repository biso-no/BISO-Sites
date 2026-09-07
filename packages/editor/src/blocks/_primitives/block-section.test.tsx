import { describe, expect, test } from "bun:test";
import { Tabs, TabsList, TabsTrigger } from "@repo/ui/components/ui/tabs";
import { renderToStaticMarkup } from "react-dom/server";
import { BlockSection, SPACING, SURFACE, WIDTH } from "./block-section";

const REBOUND_SURFACE_TOKENS = [
  "--background",
  "--foreground",
  "--card",
  "--card-foreground",
  "--popover",
  "--popover-foreground",
  "--primary",
  "--primary-foreground",
  "--secondary",
  "--secondary-foreground",
  "--muted",
  "--muted-foreground",
  "--accent",
  "--accent-foreground",
  "--border",
  "--input",
  "--ring",
] as const;

describe("BlockSection class contracts", () => {
  test("high-contrast surfaces rebind the complete shared UI token set", () => {
    for (const key of ["brand", "inverted"] as const) {
      for (const token of REBOUND_SURFACE_TOKENS) {
        expect(SURFACE[key]).toContain(`[${token}:`);
      }
    }
  });

  test("representative shared UI controls stay on the rebound semantic surface", () => {
    const html = renderToStaticMarkup(
      <BlockSection background="brand">
        <Tabs defaultValue="first">
          <TabsList>
            <TabsTrigger value="first">First</TabsTrigger>
          </TabsList>
        </Tabs>
      </BlockSection>
    );

    expect(html).toContain("bg-muted");
    expect(html).toContain("text-muted-foreground");
    expect(html).toContain("[--muted:");
    expect(html).toContain("[--muted-foreground:");
  });

  test("arbitrary value classes never contain spaces", () => {
    for (const value of Object.values(SURFACE)) {
      const arbitraryValues = value.match(/\[[^\]]*\]/g) ?? [];
      for (const token of arbitraryValues) {
        expect(token).not.toContain(" ");
      }
    }
  });

  test("every layout enum member maps to static classes", () => {
    expect(Object.keys(SURFACE).sort()).toEqual([
      "accent",
      "brand",
      "default",
      "inverted",
      "muted",
    ]);
    expect(Object.keys(SPACING).sort()).toEqual([
      "compact",
      "none",
      "normal",
      "spacious",
    ]);
    expect(Object.keys(WIDTH).sort()).toEqual([
      "content",
      "full",
      "prose",
      "wide",
    ]);
  });

  test("full width cancels container padding at every breakpoint", () => {
    expect(WIDTH.full).toContain("px-0");
    expect(WIDTH.full).toContain("sm:px-0");
    expect(WIDTH.full).toContain("lg:px-0");
  });
});
