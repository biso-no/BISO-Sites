import { afterAll, afterEach, beforeAll, expect, test } from "bun:test";
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { slugifyAnchor } from "@/editor/operations";
import { DEFAULT_SECTION_LAYOUT } from "@/editor/sections";
import type { Section } from "@/editor/types";
import { SectionPanel } from "./section-panel";
import { fire, installDom } from "./test-events";

let restore: () => void = () => undefined;
beforeAll(() => {
  restore = installDom();
});
afterAll(() => restore());

const mounted: { host: HTMLElement; root: Root }[] = [];
afterEach(() => {
  for (const { host, root } of mounted.splice(0)) {
    act(() => root.unmount());
    host.remove();
  }
});

const SECTION: Section = {
  columns: [{ blocks: [], id: "s-c0" }],
  id: "s",
  layout: { ...DEFAULT_SECTION_LAYOUT, columns: "1" },
};

/** The panel over a section whose stored anchor follows each commit, like the store. */
function Harness({ commits }: { commits: string[] }) {
  const [anchor, setAnchor] = useState<string | undefined>(undefined);
  return (
    <SectionPanel
      onAnchor={(typed) => {
        commits.push(typed);
        setAnchor(slugifyAnchor(typed) || undefined);
      }}
      onDelete={() => undefined}
      onDuplicate={() => undefined}
      onLayout={() => undefined}
      section={{ ...SECTION, anchor }}
    />
  );
}

function mount() {
  const commits: string[] = [];
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  mounted.push({ host, root });
  act(() => root.render(<Harness commits={commits} />));
  return { commits, host };
}

const linkName = (host: Element) =>
  host.querySelector('input[aria-label="Link name"]') as HTMLInputElement;

test("Enter commits the link name and keeps focus in the field", () => {
  const { commits, host } = mount();
  const field = linkName(host);
  field.focus();
  expect(document.activeElement === field).toBe(true);

  field.value = "Se aftermovien";
  fire(field, "onKeyDown", { key: "Enter" });

  expect(commits).toEqual(["Se aftermovien"]);
  // The same field, still in the page, still focused, showing the stored form.
  expect(linkName(host) === field).toBe(true);
  expect(field.isConnected).toBe(true);
  expect(document.activeElement === field).toBe(true);
  expect(field.value).toBe("se-aftermovien");
});

test("a name stored from elsewhere (an undo) shows in the field", () => {
  const commits: string[] = [];
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  mounted.push({ host, root });
  const render = (anchor?: string) =>
    act(() =>
      root.render(
        <SectionPanel
          onAnchor={(typed) => commits.push(typed)}
          onDelete={() => undefined}
          onDuplicate={() => undefined}
          onLayout={() => undefined}
          section={{ ...SECTION, anchor }}
        />
      )
    );
  render("intro");
  expect(linkName(host).value).toBe("intro");
  render("om-oss");
  expect(linkName(host).value).toBe("om-oss");
  render(undefined);
  expect(linkName(host).value).toBe("");
  expect(commits).toEqual([]);
});

test("the link name commits on blur, not on every keystroke", () => {
  // Storing the slug per keystroke trimmed the trailing dash, so a space
  // could never be typed ("Se aftermovien" became "seaftermovien"), and each
  // keystroke was its own undo step.
  const { commits, host } = mount();
  const field = linkName(host);
  field.value = "Se a";
  fire(field, "onChange");
  fire(field, "onKeyDown", { key: "a" });
  expect(commits).toEqual([]);
  expect(field.value).toBe("Se a");

  field.value = "Se aftermovien";
  fire(field, "onBlur");
  expect(commits).toEqual(["Se aftermovien"]);
  // The field shows the stored form.
  expect(field.value).toBe("se-aftermovien");
});

test("an unchanged link name commits nothing", () => {
  const { commits, host } = mount();
  const field = linkName(host);
  field.value = "Intro";
  fire(field, "onBlur");
  expect(commits).toEqual(["Intro"]);

  field.value = "INTRO";
  fire(field, "onBlur");
  fire(field, "onKeyDown", { key: "Enter" });
  expect(commits).toEqual(["Intro"]);
  expect(field.value).toBe("intro");
});
