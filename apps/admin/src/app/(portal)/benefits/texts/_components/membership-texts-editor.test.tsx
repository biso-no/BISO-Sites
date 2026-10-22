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
import { MEMBERSHIP_TEXT_SPOTS } from "@repo/shared/utils/membership-texts";
import { IntlMessageFormat } from "intl-messageformat";
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
import type { MembershipSpotData } from "../../../_actions/membership-texts";

// `mock.module` is process-wide, so shared modules keep every export they
// already have. Translations read the real Norwegian bundle, so assertions
// read what a committee member sees.
const messages = await loadMessages("no");

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
    return String(new IntlMessageFormat(node, "nb").format(values));
  };
}

const actualIntl = await import("next-intl");
mock.module("next-intl", () => ({
  ...actualIntl,
  useLocale: () => "no",
  useTranslations: translator,
}));

let refreshes = 0;
const actualNavigation = await import("next/navigation");
mock.module("next/navigation", () => ({
  ...actualNavigation,
  useRouter: () => ({
    back: () => undefined,
    prefetch: () => undefined,
    push: () => undefined,
    refresh: () => {
      refreshes += 1;
    },
    replace: () => undefined,
  }),
}));

interface ToastCall {
  kind: string;
  message: string;
}
const toasts: ToastCall[] = [];
const record =
  (kind: string) =>
  (message: string): void => {
    toasts.push({ kind, message });
  };
const toast = Object.assign(record("default"), {
  dismiss: () => undefined,
  error: record("error"),
  success: record("success"),
});
const actualSonner = await import("sonner");
mock.module("sonner", () => ({ ...actualSonner, toast }));

// Radix dialogs portal into `document.body`; render them inline here.
type Slot = { children?: ReactNode } & Record<string, unknown>;
interface DialogState {
  onOpenChange: (open: boolean) => void;
  open: boolean;
}
const DialogOpen = createContext<DialogState>({
  onOpenChange: () => undefined,
  open: false,
});
const passThrough =
  (tag: string) =>
  ({ children }: Slot) =>
    createElement(tag, {}, children);
const actualAlertDialog = await import("@repo/ui/components/ui/alert-dialog");
mock.module("@repo/ui/components/ui/alert-dialog", () => ({
  ...actualAlertDialog,
  AlertDialog: ({ children, onOpenChange, open }: Slot) =>
    createElement(
      DialogOpen.Provider,
      {
        value: {
          onOpenChange:
            (onOpenChange as DialogState["onOpenChange"]) ?? (() => undefined),
          open: Boolean(open),
        },
      },
      children
    ),
  AlertDialogAction: ({ children, disabled, onClick }: Slot) =>
    createElement("button", { disabled, onClick, type: "button" }, children),
  AlertDialogCancel({ children, disabled }: Slot) {
    const { onOpenChange } = useContext(DialogOpen);
    return createElement(
      "button",
      { disabled, onClick: () => onOpenChange(false), type: "button" },
      children
    );
  },
  AlertDialogContent({ children }: Slot) {
    return useContext(DialogOpen).open
      ? createElement("div", { role: "alertdialog" }, children)
      : null;
  },
  AlertDialogDescription: passThrough("p"),
  AlertDialogFooter: passThrough("div"),
  AlertDialogHeader: passThrough("div"),
  AlertDialogTitle: passThrough("h2"),
  AlertDialogTrigger({ children }: Slot) {
    const { onOpenChange } = useContext(DialogOpen);
    return createElement(
      "span",
      { onClick: () => onOpenChange(true) },
      children
    );
  },
}));

const calls = {
  reset: [] as unknown[][],
  save: [] as unknown[][],
};
/** Set to make the next server call fail with this reason. */
let serverError: string | null = null;
const answer = () =>
  Promise.resolve(
    serverError === null ? { data: true } : { error: serverError }
  );
mock.module("./membership-text-actions", () => ({
  resetSpot: (...args: unknown[]) => {
    calls.reset.push(args);
    return serverError === null
      ? Promise.resolve({
          data: {
            hasRows: false,
            items: [item("Standard A"), item("Standard B")],
            spot: args[0],
          },
        })
      : answer();
  },
  saveSpot: (...args: unknown[]) => {
    calls.save.push(args);
    return answer();
  },
}));

const { MembershipTextsEditor } = await import("./membership-texts-editor");

const installedDom = installReactDom();
let createRoot: typeof import("react-dom/client")["createRoot"];
let root: Root | null = null;
let container: TestElement;

// The harness window has no event API; record `beforeunload` guards.
const unloadGuards = new Set<unknown>();
const windowApi = window as unknown as Record<string, unknown>;
const hadListeners = "addEventListener" in windowApi;

beforeAll(async () => {
  ({ createRoot } = await import("react-dom/client"));
  windowApi.addEventListener = (type: string, fn: unknown) => {
    if (type === "beforeunload") {
      unloadGuards.add(fn);
    }
  };
  windowApi.removeEventListener = (type: string, fn: unknown) => {
    if (type === "beforeunload") {
      unloadGuards.delete(fn);
    }
  };
});

afterEach(async () => {
  if (root) {
    await act(async () => root?.unmount());
  }
  root = null;
  refreshes = 0;
  toasts.length = 0;
  serverError = null;
  for (const list of Object.values(calls)) {
    list.length = 0;
  }
  installedDom.document.body.textContent = "";
});

afterAll(() => {
  if (!hadListeners) {
    Reflect.deleteProperty(windowApi, "addEventListener");
    Reflect.deleteProperty(windowApi, "removeEventListener");
  }
  installedDom.restore();
});

const item = (title: string, body = "") => ({
  body_en: body ? `${body} (en)` : "",
  body_nb: body,
  title_en: `${title} (en)`,
  title_nb: title,
});

function spots(saved: string[] = []): MembershipSpotData[] {
  return MEMBERSHIP_TEXT_SPOTS.map((spot) => ({
    hasRows: saved.includes(spot),
    items: [item(`${spot} en`), item(`${spot} to`), item(`${spot} tre`)],
    spot,
  }));
}

const editorFor = (data: MembershipSpotData[]) => (
  <MembershipTextsEditor
    locale="no"
    spots={data}
    webBaseUrl="https://app.biso.no"
  />
);

async function mount(data: MembershipSpotData[] = spots()) {
  container = installedDom.document.createElement("div");
  installedDom.document.body.appendChild(container);
  root = createRoot(container as unknown as Element);
  await act(() => {
    root?.render(editorFor(data));
  });
}

/** What a router refresh does: the same editor gets new server data. */
async function refreshWith(data: MembershipSpotData[]) {
  await act(() => {
    root?.render(editorFor(data));
  });
}

const page = () => container as unknown as TestNode;

function cards(): TestElement[] {
  return findElements(page(), (element) => element.tagName === "ARTICLE");
}

function card(label: string): TestElement {
  const found = cards().find((candidate) =>
    candidate.textContent.includes(label)
  );
  if (!found) {
    throw new Error(`No card for ${label}`);
  }
  return found;
}

async function press(button: TestElement): Promise<void> {
  await act(async () => {
    button.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function type(element: TestElement, text: string): Promise<void> {
  await act(() => {
    element.value = text;
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("MembershipTextsEditor", () => {
  test("shows one card per spot, in table order", async () => {
    await mount();
    const headings = cards().map(
      (article) =>
        findElements(article, (element) => element.tagName === "H2")[0]
          ?.textContent
    );
    expect(headings).toEqual([
      "Forsiden – «Bli med»",
      "Medlemskapskortene",
      "Låst innhold i medlemsportalen",
      "Velkomstflyten",
      "Nettbutikken – medlemsboksen",
      "For bedrifter",
      "Business Hotspot",
    ]);
  });

  test("marks only the spots without saved rows", async () => {
    await mount(spots(["plan_card"]));
    const notSaved = "Ikke lagret ennå – viser nettsidens standardtekst";
    expect(
      cards().filter((c) => c.textContent.includes(notSaved))
    ).toHaveLength(6);
    expect(card("Medlemskapskortene").textContent).not.toContain(notSaved);
  });

  test("links to the page on the website and says where it shows", async () => {
    await mount();
    const link = findElements(
      card("Nettbutikken"),
      (element) => element.getAttribute("href") !== null
    )[0];
    expect(link?.getAttribute("href")).toBe("https://app.biso.no/shop");
    expect(link?.getAttribute("rel")).toBe("noopener");
    expect(link?.getAttribute("target")).toBe("_blank");
    expect(card("Nettbutikken").textContent).toContain("Vises på /shop");
  });

  test("keeps Lagre disabled until a line changes", async () => {
    await mount();

    expect(
      findButton(card("Velkomstflyten"), "Lagre").hasAttribute("disabled")
    ).toBe(true);
    await type(
      findByAriaLabel(card("Velkomstflyten"), "Punkt 1: tittel"),
      "Ny tekst"
    );
    expect(
      findButton(card("Velkomstflyten"), "Lagre").hasAttribute("disabled")
    ).toBe(false);
  });

  test("adds and removes lines, then saves them in order", async () => {
    await mount();
    const onboarding = () => card("Velkomstflyten");
    await press(findButton(onboarding(), "+ Legg til linje"));
    await type(findByAriaLabel(onboarding(), "Punkt 4: tittel"), "Fjerde");
    await press(findByAriaLabel(onboarding(), "Fjern punkt 1"));
    await press(findButton(onboarding(), "Lagre"));

    expect(calls.save).toEqual([
      [
        "onboarding",
        [
          { title_en: "onboarding to (en)", title_nb: "onboarding to" },
          { title_en: "onboarding tre (en)", title_nb: "onboarding tre" },
          { title_en: "", title_nb: "Fjerde" },
        ],
      ],
    ]);
    expect(toasts).toEqual([{ kind: "success", message: "Lagret" }]);
    expect(refreshes).toBe(1);
    expect(findButton(onboarding(), "Lagre").hasAttribute("disabled")).toBe(
      true
    );
  });

  test("sends the text of a title-and-text spot", async () => {
    await mount();
    const business = () => card("For bedrifter");
    await type(findByAriaLabel(business(), "Punkt 1: tekst"), "Ny brødtekst");
    await press(findButton(business(), "Lagre"));
    const [spot, items] = calls.save[0] as [string, { body_nb: string }[]];
    expect(spot).toBe("business");
    expect(items[0]?.body_nb).toBe("Ny brødtekst");
  });

  test("only title-and-text spots have a text field", async () => {
    await mount();
    expect(() =>
      findByAriaLabel(card("Velkomstflyten"), "Punkt 1: tekst")
    ).toThrow();
  });

  test("stops at twelve lines", async () => {
    await mount();
    const onboarding = () => card("Velkomstflyten");
    for (let count = 3; count < 12; count += 1) {
      await press(findButton(onboarding(), "+ Legg til linje"));
    }
    expect(
      findButton(onboarding(), "+ Legg til linje").hasAttribute("disabled")
    ).toBe(true);
    expect(onboarding().textContent).toContain("Maks 12 punkter.");
  });

  test("does not send a blank title, and says so next to the line", async () => {
    await mount();
    const onboarding = () => card("Velkomstflyten");
    await type(findByAriaLabel(onboarding(), "Punkt 2: tittel"), "  ");
    await press(findButton(onboarding(), "Lagre"));
    expect(calls.save).toHaveLength(0);
    expect(onboarding().textContent).toContain("Skriv en tittel.");
  });

  test("shows the server's reason as it is", async () => {
    await mount();
    serverError = "Kunne ikke lagre teksten. Prøv igjen om litt.";
    await type(
      findByAriaLabel(card("Velkomstflyten"), "Punkt 1: tittel"),
      "Endret"
    );
    await press(findButton(card("Velkomstflyten"), "Lagre"));
    expect(toasts).toEqual([
      {
        kind: "error",
        message: "Kunne ikke lagre teksten. Prøv igjen om litt.",
      },
    ]);
    // The edits stay, so the editor can try again.
    expect(
      findButton(card("Velkomstflyten"), "Lagre").hasAttribute("disabled")
    ).toBe(false);
  });

  test("offers reset only for saved spots, and asks first", async () => {
    await mount(spots(["plan_card"]));
    expect(() =>
      findButton(card("Velkomstflyten"), "Tilbakestill til standard")
    ).toThrow();

    const plan = () => card("Medlemskapskortene");
    await press(findButton(plan(), "Tilbakestill til standard"));
    expect(calls.reset).toHaveLength(0);
    expect(plan().textContent).toContain("Tilbakestille «Medlemskapskortene»?");

    const dialog = findElements(
      plan(),
      (element) => element.getAttribute("role") === "alertdialog"
    )[0] as TestElement;
    await press(findButton(dialog, "Tilbakestill til standard"));
    expect(calls.reset).toEqual([["plan_card"]]);
    expect(toasts).toEqual([{ kind: "success", message: "Tilbakestilt" }]);
    expect(refreshes).toBe(1);
  });

  test("after a reset the default lines show and Lagre cannot undo it", async () => {
    await mount(spots(["plan_card"]));
    const plan = () => card("Medlemskapskortene");
    await type(findByAriaLabel(plan(), "Punkt 1: tittel"), "Mine egne ord");
    expect(findButton(plan(), "Lagre").hasAttribute("disabled")).toBe(false);

    await press(findButton(plan(), "Tilbakestill til standard"));
    const dialog = findElements(
      plan(),
      (element) => element.getAttribute("role") === "alertdialog"
    )[0] as TestElement;
    await press(findButton(dialog, "Tilbakestill til standard"));

    expect(findByAriaLabel(plan(), "Punkt 1: tittel").value).toBe("Standard A");
    expect(() => findByAriaLabel(plan(), "Punkt 3: tittel")).toThrow();
    expect(findButton(plan(), "Lagre").hasAttribute("disabled")).toBe(true);
    expect(plan().textContent).toContain("Ikke lagret ennå");
    expect(calls.save).toHaveLength(0);
  });

  test("editing a Norwegian line blanks its English; other lines keep theirs", async () => {
    await mount();
    const onboarding = () => card("Velkomstflyten");
    await type(findByAriaLabel(onboarding(), "Punkt 1: tittel"), "Ny norsk");
    expect(onboarding().textContent).toContain(
      "Engelsk – oversettes automatisk"
    );
    await press(findButton(onboarding(), "Lagre"));
    expect(calls.save[0]?.[1]).toEqual([
      { title_en: "", title_nb: "Ny norsk" },
      { title_en: "onboarding to (en)", title_nb: "onboarding to" },
      { title_en: "onboarding tre (en)", title_nb: "onboarding tre" },
    ]);
  });

  test("English typed by hand survives a later Norwegian edit", async () => {
    await mount();
    const onboarding = () => card("Velkomstflyten");
    await type(
      findByAriaLabel(onboarding(), "Punkt 1: tittel på engelsk"),
      "My own"
    );
    await type(
      findByAriaLabel(onboarding(), "Punkt 1: tittel"),
      "Endret norsk"
    );
    expect(onboarding().textContent).toContain("Engelsk – egen tekst");
    await press(findButton(onboarding(), "Lagre"));
    expect(calls.save[0]?.[1]).toMatchObject([
      { title_en: "My own", title_nb: "Endret norsk" },
      {},
      {},
    ]);
  });

  test("a refresh keeps a dirty card and updates a clean one", async () => {
    await mount();
    await type(
      findByAriaLabel(card("Velkomstflyten"), "Punkt 1: tittel"),
      "Halvferdig"
    );
    const changed = spots().map((entry) => ({
      ...entry,
      items: [item(`${entry.spot} NY`)],
    }));
    await refreshWith(changed);
    expect(
      findByAriaLabel(card("Velkomstflyten"), "Punkt 1: tittel").value
    ).toBe("Halvferdig");
    expect(
      findByAriaLabel(card("Medlemskapskortene"), "Punkt 1: tittel").value
    ).toBe("plan_card NY");
  });

  test("warns before leaving only while something is unsaved", async () => {
    await mount();
    expect(unloadGuards.size).toBe(0);
    await type(
      findByAriaLabel(card("Velkomstflyten"), "Punkt 1: tittel"),
      "Endret"
    );
    expect(unloadGuards.size).toBe(1);
    await press(findButton(card("Velkomstflyten"), "Lagre"));
    expect(unloadGuards.size).toBe(0);
  });
});
