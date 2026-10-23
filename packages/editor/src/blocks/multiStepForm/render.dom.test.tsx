import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test";
import { Window } from "happy-dom";
import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { PageFeedProvider } from "@/editor/page-feed-context";
import type { MultiStepFormBlock, SignupBlock } from "@/editor/types";
import { SignupRender } from "../signup/render";
import { MultiStepFormRender } from "./render";

const previous = {
  Event: globalThis.Event,
  HTMLInputElement: globalThis.HTMLInputElement,
  HTMLSelectElement: globalThis.HTMLSelectElement,
  HTMLTextAreaElement: globalThis.HTMLTextAreaElement,
  Node: globalThis.Node,
  document: globalThis.document,
  fetch: globalThis.fetch,
  window: globalThis.window,
};
const flags = globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean };

beforeAll(() => {
  const win = new Window();
  Object.assign(globalThis, {
    Event: win.Event,
    HTMLInputElement: win.HTMLInputElement,
    HTMLSelectElement: win.HTMLSelectElement,
    HTMLTextAreaElement: win.HTMLTextAreaElement,
    IS_REACT_ACT_ENVIRONMENT: true,
    Node: win.Node,
    document: win.document,
    window: win,
  });
});

afterAll(() => {
  Object.assign(globalThis, previous);
  flags.IS_REACT_ACT_ENVIRONMENT = undefined;
});

interface Posted {
  body: Record<string, unknown>;
  url: string;
}
let posts: Posted[] = [];
let reply = { ok: true, success: true };

beforeEach(() => {
  posts = [];
  reply = { ok: true, success: true };
  globalThis.fetch = ((url: string, init: { body: string }) => {
    posts.push({ body: JSON.parse(init.body), url });
    return Promise.resolve({
      json: () => Promise.resolve({ success: reply.success }),
      ok: reply.ok,
    });
  }) as unknown as typeof fetch;
});

const form: MultiStepFormBlock = {
  heading: "Kontakt oss",
  id: "f1",
  steps: [
    {
      fields: [
        { fieldType: "text", label: "Navn", name: "name", required: true },
        { fieldType: "email", label: "E-post", name: "email" },
      ],
      title: "Om deg",
    },
    {
      fields: [
        {
          fieldType: "radio",
          label: "Hvilken campus?",
          name: "campus",
          options: [
            { label: "Oslo", value: "oslo" },
            { label: "Bergen", value: "bergen" },
          ],
        },
        {
          fieldType: "checkbox",
          label: "Interesser",
          name: "interests",
          options: [
            { label: "Sport", value: "sport" },
            { label: "Kultur", value: "kultur" },
          ],
        },
        { fieldType: "checkbox", label: "Jeg godtar", name: "consent" },
        { fieldType: "textarea", label: "Melding", name: "message" },
      ],
      title: "Mer",
    },
  ],
  submitMode: "email",
  recipientEmail: "post@biso.no",
  topic: "contact",
  type: "multiStepForm",
};

const mounted: { host: HTMLElement; root: Root }[] = [];

afterEach(() => {
  for (const { host, root } of mounted.splice(0)) {
    act(() => root.unmount());
    host.remove();
  }
});

function mountNode(node: ReactNode) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  mounted.push({ host, root });
  act(() => {
    root.render(
      <PageFeedProvider department="" locale="no" slug="kontakt">
        {node}
      </PageFeedProvider>
    );
  });
  return host;
}

const mountForm = (block: MultiStepFormBlock = form, edit = false) =>
  mountNode(
    createElement(MultiStepFormRender, {
      block,
      edit,
      onPatch: () => undefined,
    })
  );

/**
 * Types into a text field by calling the handler React attached to it.
 * React decides at import time whether the browser fires `input` events
 * (`canUseDOM`), and in a bun process the module is usually evaluated before
 * any DOM exists, so a dispatched event never reaches `onChange` here.
 */
function type(el: Element, value: string) {
  const propsKey = Object.keys(el).find((k) => k.startsWith("__reactProps$"));
  const props = (el as unknown as Record<string, unknown>)[propsKey ?? ""] as {
    onChange?: (event: unknown) => void;
  };
  act(() => {
    (el as HTMLInputElement).value = value;
    props.onChange?.({ currentTarget: el, target: el });
  });
}

function click(el: Element) {
  act(() => {
    (el as HTMLElement).click();
  });
}

const submit = (host: Element) =>
  act(async () => {
    host
      .querySelector("form")
      ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

const byName = (host: Element, name: string) =>
  host.querySelector(`[name="${name}"]`) as HTMLInputElement;
const button = (host: Element, label: string) =>
  [...host.querySelectorAll("button")].find(
    (b) => b.textContent === label
  ) as HTMLButtonElement;

describe("multi-step form", () => {
  test("Back keeps the first step's answers, and submit sends both steps", async () => {
    const host = mountForm();
    type(byName(host, "name"), "Ada");
    type(byName(host, "email"), "ada@example.com");
    await submit(host);
    expect(host.querySelector('[name="name"]')).toBeNull();

    click(host.querySelector('input[value="bergen"]') as Element);
    click(host.querySelector('input[value="sport"]') as Element);
    click(host.querySelector('input[value="kultur"]') as Element);
    click(byName(host, "consent"));
    type(byName(host, "message"), "Hei");

    click(button(host, "Tilbake"));
    expect(byName(host, "name").value).toBe("Ada");
    expect(byName(host, "email").value).toBe("ada@example.com");
    await submit(host);
    expect(
      (host.querySelector('input[value="bergen"]') as HTMLInputElement).checked
    ).toBe(true);

    await submit(host);
    expect(posts).toHaveLength(1);
    expect(posts[0].url).toBe("/api/form/submit");
    expect(posts[0].body).toEqual({
      blockId: "f1",
      data: {
        campus: "bergen",
        consent: true,
        email: "ada@example.com",
        interests: ["sport", "kultur"],
        message: "Hei",
        name: "Ada",
      },
      locale: "no",
      slug: "kontakt",
    });
  });

  test("a radio group submits the chosen option", async () => {
    const host = mountForm({
      ...form,
      steps: [form.steps[1]],
    });
    click(host.querySelector('input[value="oslo"]') as Element);
    click(host.querySelector('input[value="bergen"]') as Element);
    await submit(host);
    expect((posts[0].body.data as Record<string, unknown>).campus).toBe(
      "bergen"
    );
  });

  test("the body never carries a recipient, mode, topic or team", async () => {
    const host = mountForm({ ...form, steps: [form.steps[1]] });
    await submit(host);
    expect(Object.keys(posts[0].body).sort()).toEqual([
      "blockId",
      "data",
      "locale",
      "slug",
    ]);
  });

  test("a required field blocks Next and says so", async () => {
    const host = mountForm();
    await submit(host);
    expect(posts).toHaveLength(0);
    expect(host.querySelector('[role="alert"]')?.textContent).toContain(
      "må fylles ut"
    );
    expect(byName(host, "name").getAttribute("aria-invalid")).toBe("true");
    expect(byName(host, "name")).not.toBeNull();
  });

  test("success replaces the form; failure shows an error and keeps it", async () => {
    reply = { ok: false, success: false };
    const failed = mountForm({ ...form, steps: [form.steps[1]] });
    await submit(failed);
    expect(failed.querySelector('[role="alert"]')?.textContent).toContain(
      "Noe gikk galt"
    );
    expect(failed.querySelector("form")).not.toBeNull();

    reply = { ok: true, success: true };
    await submit(failed);
    expect(failed.querySelector("form")).toBeNull();
    expect(failed.querySelector('[role="status"]')?.textContent).toContain(
      "sendt"
    );
  });

  test("the editor never posts", async () => {
    const host = mountForm(form, true);
    await submit(host);
    await submit(host);
    expect(posts).toHaveLength(0);
  });

  test("malformed steps and fields render without throwing", () => {
    const host = mountForm({
      ...form,
      steps: [{ fields: "nope", title: 3 }, null, "x"] as never,
    });
    expect(host.textContent).toContain("Kontakt oss");
  });
});

describe("signup", () => {
  const signup: SignupBlock = {
    heading: "Meld deg på",
    id: "s1",
    placeholder: "",
    submitMode: "database",
    topic: "signup",
    type: "signup",
  };

  const mountSignup = (block: SignupBlock = signup, edit = false) =>
    mountNode(
      createElement(SignupRender, { block, edit, onPatch: () => undefined })
    );

  test("posts the email with the block id, slug and locale only", async () => {
    const host = mountSignup();
    type(host.querySelector("input") as Element, "a@b.no");
    await submit(host);
    expect(posts[0].body).toEqual({
      blockId: "s1",
      data: { email: "a@b.no" },
      locale: "no",
      slug: "kontakt",
    });
    expect(host.querySelector('[role="status"]')?.textContent).toContain(
      "Takk"
    );
  });

  test("an invalid email is refused before any request", async () => {
    const host = mountSignup();
    type(host.querySelector("input") as Element, "nope");
    await submit(host);
    expect(posts).toHaveLength(0);
    expect(host.querySelector('[role="alert"]')).not.toBeNull();
  });
});

describe("form hardening", () => {
  test("text fields carry a maxLength", () => {
    const host = mountForm();
    expect(byName(host, "name").getAttribute("maxlength")).toBe("2000");
  });

  test("a required group that is empty flags its inputs and points at the error", async () => {
    const host = mountForm({
      ...form,
      steps: [
        {
          title: "x",
          fields: [
            {
              fieldType: "radio",
              label: "Valg",
              name: "pick",
              options: [{ label: "A", value: "a" }],
              required: true,
            },
          ],
        },
      ],
    });
    await submit(host);
    const radio = host.querySelector('input[value="a"]') as HTMLElement;
    expect(radio.getAttribute("aria-invalid")).toBe("true");
    const id = radio.getAttribute("aria-describedby") ?? "";
    expect(host.querySelector(`[id="${id}"]`)?.textContent).toContain(
      "må fylles ut"
    );
    expect(
      host.querySelector("fieldset")?.getAttribute("aria-describedby")
    ).toBe(id);
  });
});
