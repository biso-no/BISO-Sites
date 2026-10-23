import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { ContactBlock } from "@/editor/types";
import { ContactRender } from "./render";

const block: ContactBlock = {
  address: "Nydalsveien 37, Oslo",
  email: "kontakt@example.org",
  heading: "Finn oss",
  hours: "Man-fre 10-15",
  id: "c1",
  instagram: "@bisowintergames",
  phone: "+47 000 00 002",
  type: "contact",
};

const EMPTY: Partial<ContactBlock> = {
  address: "",
  email: "",
  hours: "",
  instagram: "",
  phone: "",
};

function html(props: Partial<ContactBlock> = {}, edit = false) {
  return renderToStaticMarkup(
    <section data-surface="deep">
      <ContactRender
        block={{ ...block, ...props }}
        edit={edit}
        onPatch={() => undefined}
      />
    </section>
  );
}

describe("ContactRender", () => {
  test("instagram links to the profile, @ stripped", () => {
    expect(html()).toContain(
      'href="https://www.instagram.com/bisowintergames/"'
    );
  });

  test("email and phone are mailto and tel links", () => {
    const out = html();
    expect(out).toContain('href="mailto:kontakt@example.org"');
    expect(out).toContain('href="tel:+4700000002"');
  });

  test("facts render as a definition list", () => {
    const out = html();
    expect(out).toContain("<dl");
    expect(out).toContain("Nydalsveien 37, Oslo");
    expect(out).toContain("Man-fre 10-15");
    expect(out).toContain("Finn oss");
  });

  test("with every field empty the site shows nothing", () => {
    expect(
      renderToStaticMarkup(
        <ContactRender
          block={{ ...block, ...EMPTY }}
          edit={false}
          onPatch={() => undefined}
        />
      )
    ).toBe("");
  });

  test("empty fields are left out, the rest stays", () => {
    const out = html({ address: "", hours: "", instagram: "", phone: "" });
    expect(out).toContain("mailto:");
    expect(out).not.toContain("instagram.com");
    expect(out).not.toContain("tel:");
  });

  test("an instagram.com URL links to its handle, other values are plain text", () => {
    expect(
      html({ instagram: "https://www.instagram.com/bisowintergames/?hl=no" })
    ).toContain('href="https://www.instagram.com/bisowintergames/"');
    const other = html({ instagram: "https://evil.example/x" });
    expect(other).not.toContain('href="https://evil.example');
    expect(other).toContain("https://evil.example/x");
    expect(html({ instagram: "two words" })).not.toContain("instagram.com");
  });

  test("a javascript: instagram value is not linked", () => {
    const out = html({ instagram: "javascript:alert(1)" });
    expect(out).not.toContain('href="javascript:');
  });

  test("the editor shows every field even when empty", () => {
    const out = html(EMPTY, true);
    expect(out).toContain("<dl");
    expect(out).toContain("Finn oss");
  });
});
