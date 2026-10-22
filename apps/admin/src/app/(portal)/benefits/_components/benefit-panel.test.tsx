import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  mock,
  test,
} from "bun:test";
import { loadMessages } from "@repo/i18n/messages";
import {
  act,
  createContext,
  createElement,
  type ReactNode,
  useContext,
} from "react";
import type { Root } from "react-dom/client";
import {
  findButton,
  findByAriaLabel,
  findElements,
  installReactDom,
  type TestElement,
  type TestNode,
} from "@/test/react-dom-harness";
import type { BoardPartner } from "../../_actions/benefits";
import { emptyPanelValues, type PanelValues } from "../_lib/panel-state";

// `mock.module` is process-wide, so every shared module keeps the exports it
// already has and only what this panel needs is replaced. Translations read
// the real Norwegian bundle, so the assertions read what a committee member
// sees. The lookup is local: an earlier suite may have swapped `next-intl`
// for a stub without a formatter.
const messages = await loadMessages("no");
const PLACEHOLDER = /\{(\w+)\}/g;

function translator(namespace?: string) {
  return (key: string, values: Record<string, string | number> = {}) => {
    const path = [...(namespace?.split(".") ?? []), ...key.split(".")];
    let node: unknown = messages;
    for (const part of path) {
      node = (node as Record<string, unknown> | undefined)?.[part];
    }
    if (typeof node !== "string") {
      throw new Error(`Missing message: ${path.join(".")}`);
    }
    return node.replace(PLACEHOLDER, (_, name: string) =>
      String(values[name] ?? `{${name}}`)
    );
  };
}

const actualIntl = await import("next-intl");
mock.module("next-intl", () => ({
  ...actualIntl,
  useLocale: () => "no",
  useTranslations: translator,
}));

const pushes: string[] = [];
let refreshes = 0;
const actualNavigation = await import("next/navigation");
mock.module("next/navigation", () => ({
  ...actualNavigation,
  usePathname: () => "/benefits/new",
  useRouter: () => ({
    back: () => undefined,
    prefetch: () => undefined,
    push: (href: string) => {
      pushes.push(href);
    },
    refresh: () => {
      refreshes += 1;
    },
    replace: () => undefined,
  }),
  useSearchParams: () => new URLSearchParams("campus=2"),
}));

interface ToastCall {
  description?: string;
  kind: string;
  message: string;
}
const toasts: ToastCall[] = [];
const record =
  (kind: string) =>
  (message: string, options?: { description?: string }): void => {
    toasts.push({ description: options?.description, kind, message });
  };
const toast = Object.assign(record("default"), {
  dismiss: () => undefined,
  error: record("error"),
  info: record("info"),
  loading: record("loading"),
  message: record("message"),
  success: record("success"),
  warning: record("warning"),
});
const actualSonner = await import("sonner");
mock.module("sonner", () => ({ ...actualSonner, toast }));

// Radix dialogs portal into `document.body` and lean on browser APIs this
// harness lacks. Only the panel and its delete confirmation use these two
// modules in the suite, so they render inline here; the real Sheet is
// checked in the browser.
type Slot = { children?: ReactNode } & Record<string, unknown>;
const actualSheet = await import("@repo/ui/components/ui/sheet");
mock.module("@repo/ui/components/ui/sheet", () => ({
  ...actualSheet,
  Sheet: ({ children, open }: Slot) => (open === false ? null : children),
  SheetContent: ({ children }: Slot) =>
    createElement("div", { role: "dialog" }, children),
  SheetDescription: ({ children }: Slot) => createElement("p", {}, children),
  SheetTitle: ({ children }: Slot) => createElement("h2", {}, children),
}));

const actualAlertDialog = await import("@repo/ui/components/ui/alert-dialog");
const passThrough =
  (tag: string) =>
  ({ children }: Slot) =>
    createElement(tag, {}, children);
// Just enough of Radix: the trigger always renders, the content only when
// open. The panel opens the dialog through the trigger's own click handler.
const DialogOpen = createContext(false);
mock.module("@repo/ui/components/ui/alert-dialog", () => ({
  ...actualAlertDialog,
  AlertDialog: ({ children, open }: Slot) =>
    createElement(DialogOpen.Provider, { value: Boolean(open) }, children),
  AlertDialogAction: ({ children, disabled, onClick }: Slot) =>
    createElement("button", { disabled, onClick, type: "button" }, children),
  AlertDialogCancel: ({ children, disabled }: Slot) =>
    createElement("button", { disabled, type: "button" }, children),
  AlertDialogContent: ({ children }: Slot) =>
    useContext(DialogOpen)
      ? createElement("div", { role: "alertdialog" }, children)
      : null,
  AlertDialogDescription: passThrough("p"),
  AlertDialogFooter: passThrough("div"),
  AlertDialogHeader: passThrough("div"),
  AlertDialogTitle: passThrough("h2"),
  AlertDialogTrigger: ({ children }: Slot) => children,
}));

// The panel's server actions sit behind a thin module this suite owns, so
// the shared `_actions` modules are never replaced process-wide.
const calls = {
  createBenefit: [] as unknown[][],
  createBenefitPartner: [] as unknown[][],
  deleteBenefit: [] as unknown[][],
  updateBenefit: [] as unknown[][],
};
mock.module("./panel-actions", () => ({
  createBenefit: (...args: unknown[]) => {
    calls.createBenefit.push(args);
    return Promise.resolve({ data: "new-benefit" });
  },
  createBenefitPartner: (...args: unknown[]) => {
    calls.createBenefitPartner.push(args);
    const [input] = args as [{ campus_id: string; name: string }];
    return Promise.resolve({
      data: {
        campus_id: input.campus_id,
        id: "partner-new",
        is_active: true,
        logo_url: null,
        name: input.name,
      },
    });
  },
  deleteBenefit: (...args: unknown[]) => {
    calls.deleteBenefit.push(args);
    return Promise.resolve({ data: args[0] });
  },
  updateBenefit: (...args: unknown[]) => {
    calls.updateBenefit.push(args);
    return Promise.resolve({ data: args[0] });
  },
}));

const { BenefitPanel } = await import("./benefit-panel");

const installedDom = installReactDom();
let createRoot: typeof import("react-dom/client")["createRoot"];
let root: Root | null = null;
let container: TestElement;

beforeAll(async () => {
  ({ createRoot } = await import("react-dom/client"));
});

afterEach(async () => {
  if (root) {
    await act(async () => root?.unmount());
  }
  root = null;
  pushes.length = 0;
  refreshes = 0;
  toasts.length = 0;
  for (const list of Object.values(calls)) {
    list.length = 0;
  }
  installedDom.document.body.textContent = "";
});

afterAll(() => installedDom.restore());

const BOARD_HREF = "/benefits?campus=2";

const partners: BoardPartner[] = [
  {
    campus_id: "2",
    id: "partner-loft",
    is_active: true,
    logo_url: null,
    name: "Løft studios",
  },
  {
    campus_id: "5",
    id: "partner-gone",
    is_active: false,
    logo_url: null,
    name: "Gamle Bakeriet",
  },
];

const OFFER = "20 % hos Løft studios";

function values(overrides: Partial<PanelValues> = {}): PanelValues {
  return { ...emptyPanelValues("member", "2"), ...overrides };
}

const published = values({
  partnerId: "partner-loft",
  redemptionType: "code",
  redemptionValue: "LOFT20",
  status: "published",
  titleNb: OFFER,
});

async function mount({
  benefitId = null,
  editable = true,
  initial = values(),
}: {
  benefitId?: string | null;
  editable?: boolean;
  initial?: PanelValues;
} = {}) {
  container = installedDom.document.createElement("div");
  installedDom.document.body.appendChild(container);
  root = createRoot(container as unknown as Element);
  await act(() => {
    root?.render(
      <BenefitPanel
        benefitId={benefitId}
        boardHref={BOARD_HREF}
        campusLabel="Bergen"
        editable={editable}
        initial={initial}
        locale="no"
        partners={partners}
      />
    );
  });
}

/** Clicks, then lets any server call it starts settle inside `act`. */
async function press(button: TestElement): Promise<void> {
  await act(async () => {
    button.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function click(label: string): Promise<void> {
  return press(findButton(container as unknown as TestNode, label));
}

async function type(element: TestElement, text: string): Promise<void> {
  await act(() => {
    element.value = text;
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function elements(tagName: string): TestElement[] {
  return findElements(
    container as unknown as TestNode,
    (element) => element.tagName === tagName
  );
}

function buttonLabels(): string[] {
  return elements("BUTTON").map((button) => button.textContent);
}

/** The control a visible `<label>` names. */
function labelled(text: string): TestElement {
  const label = elements("LABEL").find((element) =>
    element.textContent.startsWith(text)
  );
  const id = label?.getAttribute("for");
  const control = findElements(
    container as unknown as TestNode,
    (element) => Boolean(id) && element.getAttribute("id") === id
  )[0];
  if (!control) {
    throw new Error(`No control labelled ${text}`);
  }
  return control;
}

function options(): TestElement[] {
  return findElements(
    container as unknown as TestNode,
    (element) => element.getAttribute("role") === "option"
  );
}

function selectedOption(): TestElement | undefined {
  return options().find(
    (option) => option.getAttribute("aria-selected") === "true"
  );
}

describe("BenefitPanel", () => {
  test("a new member benefit asks six plain questions, then draft or publish", async () => {
    await mount();

    const text = container.textContent;
    const questions = [
      "Slik ser studentene det",
      "Hva er tilbudet?",
      "Fortell litt mer",
      "Hvilken partner?",
      "Hvordan får studentene rabatten?",
      "Hvor lenge gjelder det?",
      "Flere valg",
    ].map((question) => text.indexOf(question));
    expect(questions.every((position) => position >= 0)).toBe(true);
    expect([...questions].sort((a, b) => a - b)).toEqual(questions);

    expect(text).toContain("Bergen · Medlemsfordeler");
    expect(text).toContain("Ny fordel");
    expect(labelled("Hva er tilbudet?").tagName).toBe("INPUT");
    expect(buttonLabels()).toContain("Lagre utkast");
    expect(buttonLabels()).toContain("Publiser");
    expect(buttonLabels()).not.toContain("Slett");
    expect(text).toContain("Lagres som utkast til du publiserer");
    // The partner list starts with "no partner", which a new item has.
    expect(options()[0]?.textContent).toContain("Ingen partner (BISO)");
    expect(selectedOption()?.textContent).toContain("Ingen partner (BISO)");
    expect(text).toContain("Avsluttet");
  });

  test("choosing a discount code reveals the code field, for members only", async () => {
    await mount();
    expect(container.textContent).not.toContain("vises bare for medlemmer");

    await click("Rabattkode");

    expect(container.textContent).toContain("vises bare for medlemmer");
    expect(labelled("Rabattkode").tagName).toBe("INPUT");
    const pill = findButton(container as unknown as TestNode, "Rabattkode");
    expect(pill.getAttribute("aria-pressed")).toBe("true");
    // The preview shows the same reveal button as the website.
    expect(container.textContent).toContain("Vis kode");
  });

  test("the preview follows what is typed", async () => {
    await mount();

    await type(labelled("Hva er tilbudet?"), OFFER);

    const preview = elements("SECTION").find((section) =>
      section.textContent.includes("Slik ser studentene det")
    );
    expect(preview?.textContent).toContain(OFFER);
  });

  test("a live benefit can be saved, hidden or deleted", async () => {
    await mount({ benefitId: "b1", initial: published });

    const labels = buttonLabels();
    expect(labels).toContain("Lagre endringer");
    expect(labels).toContain("Skjul fra nettsiden");
    expect(labels).toContain("Slett");
    expect(labels).not.toContain("Publiser");
    expect(labels).not.toContain("Lagre utkast");
    expect(container.textContent).toContain("Endre fordel");
    expect(container.textContent).not.toContain(
      "Lagres som utkast til du publiserer"
    );
    expect(selectedOption()?.textContent).toContain("Løft studios");
  });

  test("saving a live benefit keeps it live and returns to the board", async () => {
    await mount({ benefitId: "b1", initial: published });

    await click("Lagre endringer");

    expect(calls.updateBenefit).toHaveLength(1);
    const [id, form] = calls.updateBenefit[0] as [
      string,
      Record<string, unknown>,
    ];
    expect(id).toBe("b1");
    expect(form.status).toBe("published");
    expect(form.title_nb).toBe(OFFER);
    expect(form.redemption_value).toBe("LOFT20");
    expect(toasts).toContainEqual({
      description: undefined,
      kind: "success",
      message: "Lagret",
    });
    expect(pushes).toEqual([BOARD_HREF]);
    expect(refreshes).toBe(1);
  });

  test("publishing without a title says what is missing and saves nothing", async () => {
    await mount();

    await click("Publiser");

    expect(container.textContent).toContain("Skriv hva tilbudet er.");
    expect(labelled("Hva er tilbudet?").getAttribute("aria-invalid")).toBe(
      "true"
    );
    expect(calls.createBenefit).toHaveLength(0);
    expect(calls.updateBenefit).toHaveLength(0);
    expect(pushes).toHaveLength(0);
  });

  test("publishing a new benefit creates it published", async () => {
    await mount();
    await type(labelled("Hva er tilbudet?"), OFFER);

    await click("Publiser");

    expect(calls.createBenefit).toHaveLength(1);
    const [form, translation] = calls.createBenefit[0] as [
      Record<string, unknown>,
      unknown,
    ];
    expect(form.status).toBe("published");
    expect(form.campus_id).toBe("2");
    expect(form.section).toBe("member");
    // Nothing is written in English yet, so it is translated on save.
    expect(translation).toEqual({ enabled: true, sourceLocale: "no" });
    expect(toasts.at(-1)?.message).toBe("Publisert");
    expect(pushes).toEqual([BOARD_HREF]);
  });

  test("one-line sections ask a single question with no partner", async () => {
    await mount({ initial: emptyPanelValues("career", "2") });

    let text = container.textContent;
    expect(text).toContain("Hva får studentene?");
    expect(text).toContain("Bergen · Karrierefordeler");
    expect(text).toContain("Engelsk tekst");
    expect(text).toContain("Hvor lenge gjelder det?");
    expect(text).not.toContain("Hvilken partner?");
    expect(text).not.toContain("Hvordan får studentene rabatten?");
    expect(text).not.toContain("Slik ser studentene det");

    await act(async () => root?.unmount());
    await mount({ initial: emptyPanelValues("business", "2") });

    text = container.textContent;
    expect(text).toContain("Hva får bedriftene?");
    expect(text).not.toContain("Hva får studentene?");
  });

  test("a read-only benefit shows the same panel with nothing to change", async () => {
    await mount({ benefitId: "b1", editable: false, initial: published });

    const labels = buttonLabels();
    for (const action of [
      "Lagre endringer",
      "Skjul fra nettsiden",
      "Slett",
      "Lagre utkast",
      "Publiser",
    ]) {
      expect(labels).not.toContain(action);
    }
    const controls = [
      ...elements("INPUT"),
      ...elements("TEXTAREA"),
      ...elements("SELECT"),
    ];
    expect(controls.length).toBeGreaterThan(0);
    for (const control of controls) {
      expect(control.hasAttribute("disabled")).toBe(true);
    }
    expect(container.textContent).toContain(OFFER);
    // The code is never shown to someone who cannot edit it.
    expect(container.textContent).not.toContain("LOFT20");
    expect(container.textContent).toContain(
      "Bare administratorer kan endre den."
    );
  });

  test("deleting asks first, then returns to the board", async () => {
    await mount({ benefitId: "b1", initial: published });

    await click("Slett");
    expect(container.textContent).toContain(`Slette «${OFFER}»?`);
    expect(calls.deleteBenefit).toHaveLength(0);

    const dialog = findElements(
      container as unknown as TestNode,
      (element) => element.getAttribute("role") === "alertdialog"
    )[0];
    if (!dialog) {
      throw new Error("No confirmation");
    }
    await press(findButton(dialog as unknown as TestNode, "Slett"));

    expect(calls.deleteBenefit).toEqual([["b1"]]);
    expect(toasts.at(-1)?.message).toBe("Slettet");
    expect(pushes).toEqual([BOARD_HREF]);
  });

  test("a new partner is saved on the benefit's campus and picked", async () => {
    await mount();

    await click("+ Ny partner");
    await type(labelled("Navn"), "Nytt Bakeri");
    await click("Lagre partner");

    expect(calls.createBenefitPartner).toHaveLength(1);
    expect(calls.createBenefitPartner[0]?.[0]).toMatchObject({
      campus_id: "2",
      name: "Nytt Bakeri",
    });
    expect(selectedOption()?.textContent).toContain("Nytt Bakeri");
  });

  test("closing goes back to the board", async () => {
    await mount();

    await press(findByAriaLabel(container as unknown as TestNode, "Lukk"));

    expect(pushes).toEqual([BOARD_HREF]);
  });
});
