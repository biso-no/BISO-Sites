import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  mock,
  test,
} from "bun:test";
import type { DndContextProps, DragEndEvent } from "@dnd-kit/core";
import { loadMessages } from "@repo/i18n/messages";
import { IntlMessageFormat } from "intl-messageformat";
import {
  act,
  createContext,
  createElement,
  type ReactNode,
  useContext,
} from "react";
import type { Root } from "react-dom/client";
import { BENEFIT_ERRORS } from "@/lib/benefits/benefit-errors";
import {
  findButton,
  findByAriaLabel,
  findElements,
  installReactDom,
  type TestElement,
  type TestNode,
} from "@/test/react-dom-harness";
import type { SiteLogo, SiteLogoGroup } from "../../../_actions/site-logos";
import type { LogoWallProps } from "./logo-wall";

// `mock.module` is process-wide, so every shared module keeps the exports it
// already has and only what this tab needs is replaced. Translations read
// the real Norwegian bundle through the ICU formatter next-intl uses, so the
// assertions read what a committee member sees. The lookup is local: an
// earlier suite may have swapped `next-intl` for a stub.
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
  usePathname: () => "/benefits/partners",
  useRouter: () => ({
    back: () => undefined,
    prefetch: () => undefined,
    push: () => undefined,
    refresh: () => {
      refreshes += 1;
    },
    replace: () => undefined,
  }),
  useSearchParams: () => new URLSearchParams("tab=logos"),
}));

const actualLink = await import("next/link");
mock.module("next/link", () => ({
  ...actualLink,
  default: ({
    children,
    href,
    ...props
  }: { children: ReactNode; href: string } & Record<string, unknown>) =>
    createElement(
      "a",
      {
        "aria-current": props["aria-current"],
        "aria-label": props["aria-label"],
        className: props.className,
        href,
        style: props.style,
      },
      children
    ),
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
// harness lacks, so they render inline here; the real Sheet is checked in
// the browser. Like Radix during its exit animation, a closing sheet stays
// on screen (`data-state="closed"`) and its buttons can still be pressed.
type Slot = { children?: ReactNode } & Record<string, unknown>;
type OpenChange = (open: boolean) => void;
interface SheetState {
  onOpenChange: OpenChange;
  open: boolean;
}
const SheetContext = createContext<SheetState>({
  onOpenChange: () => undefined,
  open: true,
});
const actualSheet = await import("@repo/ui/components/ui/sheet");
mock.module("@repo/ui/components/ui/sheet", () => ({
  ...actualSheet,
  Sheet: ({ children, onOpenChange, open }: Slot) =>
    createElement(
      SheetContext.Provider,
      {
        value: {
          onOpenChange: onOpenChange as OpenChange,
          open: open !== false,
        },
      },
      children
    ),
  SheetContent({ children, onEscapeKeyDown }: Slot) {
    const { onOpenChange, open } = useContext(SheetContext);
    return createElement(
      "div",
      {
        "data-state": open ? "open" : "closed",
        onKeyDown: (event: { defaultPrevented: boolean; key: string }) => {
          if (event.key !== "Escape") {
            return;
          }
          (onEscapeKeyDown as ((event: unknown) => void) | undefined)?.(event);
          if (!event.defaultPrevented) {
            onOpenChange(false);
          }
        },
        role: "dialog",
      },
      children
    );
  },
  SheetDescription: ({ children }: Slot) => createElement("p", {}, children),
  SheetTitle: ({ children }: Slot) => createElement("h2", {}, children),
}));

const actualAlertDialog = await import("@repo/ui/components/ui/alert-dialog");
const passThrough =
  (tag: string) =>
  ({ children }: Slot) =>
    createElement(tag, {}, children);
interface DialogState {
  onOpenChange: (open: boolean) => void;
  open: boolean;
}
const DialogOpen = createContext<DialogState>({
  onOpenChange: () => undefined,
  open: false,
});
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
  AlertDialogTrigger: ({ children }: Slot) => children,
}));

// dnd-kit measures the page while something is dragged, which this harness
// cannot. Each sortable group still renders the real context; its drop
// handler is kept, by group, so a test can finish a drag the way dnd-kit
// would when a logo is let go over another.
const dndCore = await import("@dnd-kit/core");
const RealDndContext = dndCore.DndContext;
const dropHandlers = new Map<string, (event: DragEndEvent) => void>();
mock.module("@dnd-kit/core", () => ({
  ...dndCore,
  DndContext: (props: DndContextProps) => {
    if (props.id && props.onDragEnd) {
      dropHandlers.set(props.id, props.onDragEnd);
    }
    return createElement(RealDndContext, props);
  },
}));

// The tab's server actions sit behind a thin module this suite owns, so the
// shared `_actions/site-logos` module is never replaced process-wide.
const calls = {
  delete: [] as unknown[][],
  reorder: [] as unknown[][],
  save: [] as unknown[][],
};
/** Set to make the next server call fail with this reason. */
let serverError: string | null = null;
const answer = <T,>(data: T) =>
  Promise.resolve(serverError === null ? { data } : { error: serverError });
mock.module("./logo-actions", () => ({
  deleteLogo: (...args: unknown[]) => {
    calls.delete.push(args);
    return answer(true);
  },
  saveLogo: (...args: unknown[]) => {
    calls.save.push(args);
    return answer({ id: "l-new" });
  },
  saveLogoOrder: (...args: unknown[]) => {
    calls.reorder.push(args);
    return answer(true);
  },
}));

// Failures are logged for developers in English; keep the run quiet.
const actualWarn = console.warn;

const { PartnersPage } = await import("./partners-page");

const installedDom = installReactDom();
let createRoot: typeof import("react-dom/client")["createRoot"];
let root: Root | null = null;
let container: TestElement;

beforeAll(async () => {
  ({ createRoot } = await import("react-dom/client"));
  console.warn = () => undefined;
});

afterEach(async () => {
  if (root) {
    await act(async () => root?.unmount());
  }
  root = null;
  refreshes = 0;
  toasts.length = 0;
  serverError = null;
  dropHandlers.clear();
  for (const list of Object.values(calls)) {
    list.length = 0;
  }
  installedDom.document.body.textContent = "";
});

afterAll(() => {
  console.warn = actualWarn;
  installedDom.restore();
});

function logo(
  id: string,
  name: string,
  campusId: string,
  overrides: Partial<SiteLogo> = {}
): SiteLogo {
  return {
    campus_id: campusId,
    id,
    image_url: `https://appwrite.biso.no/logos/${id}.png`,
    name,
    sort_order: 0,
    url: null,
    ...overrides,
  };
}

const national: SiteLogoGroup = {
  campusId: "5",
  editable: false,
  logos: [
    logo("l-dnb", "DNB", "5", { url: "https://www.dnb.no" }),
    logo("l-ey", "EY", "5"),
    logo("l-eq", "Equinor", "5"),
  ],
};
const bergen: SiteLogoGroup = {
  campusId: "2",
  editable: true,
  logos: [
    logo("l-spv", "Sparebanken Vest", "2"),
    logo("l-bkk", "BKK", "2", { url: "https://www.bkk.no" }),
  ],
};

function props(overrides: Partial<LogoWallProps> = {}): LogoWallProps {
  return {
    campusLabels: {
      "1": "Oslo",
      "2": "Bergen",
      "3": "Trondheim",
      "4": "Stavanger",
      "5": "Hele BISO",
    },
    // A campus admin in Bergen: Hele BISO first, and only to look at.
    groups: [national, bergen],
    ...overrides,
  };
}

async function mount(overrides: Partial<LogoWallProps> = {}) {
  // next/image resolves its address against the page's.
  Object.assign(window, {
    location: { href: "http://localhost:3001/benefits/partners?tab=logos" },
  });
  container = installedDom.document.createElement("div");
  installedDom.document.body.appendChild(container);
  root = createRoot(container as unknown as Element);
  await act(() => {
    root?.render(<PartnersPage logos={props(overrides)} tab="logos" />);
  });
}

const page = () => container as unknown as TestNode;

/** Clicks, then lets any server call it starts settle inside `act`. */
async function press(button: TestElement): Promise<void> {
  await act(async () => {
    button.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function click(label: string, within: TestNode = page()): Promise<void> {
  return press(findButton(within, label));
}

async function type(element: TestElement, text: string): Promise<void> {
  await act(() => {
    element.value = text;
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function groups(): TestElement[] {
  return findElements(page(), (element) => element.tagName === "SECTION");
}

function group(heading: string): TestElement {
  const found = groups().find(
    (candidate) =>
      findElements(candidate, (element) => element.tagName === "H2")[0]
        ?.textContent === heading
  );
  if (!found) {
    throw new Error(`No group titled ${heading}`);
  }
  return found;
}

/** The logo tiles' names, in the order they show. */
function tileNames(within: TestElement): string[] {
  return findElements(
    within,
    (element) =>
      element.tagName === "BUTTON" &&
      element.textContent !== "" &&
      element.textContent !== "+ Legg til"
  ).map((button) => button.textContent);
}

function addTiles(within: TestNode = page()): TestElement[] {
  return findElements(
    within,
    (element) =>
      element.tagName === "BUTTON" && element.textContent === "+ Legg til"
  );
}

function dragHandleLabels(within: TestNode = page()): (string | null)[] {
  return findElements(within, (element) =>
    Boolean(element.getAttribute("aria-label")?.startsWith("Flytt"))
  ).map((element) => element.getAttribute("aria-label"));
}

/** The open sheet; a closing one no longer counts. */
function sheet(): TestElement | undefined {
  return findElements(
    page(),
    (element) =>
      element.getAttribute("role") === "dialog" &&
      element.getAttribute("data-state") === "open"
  )[0];
}

function closingSheet(): TestElement | undefined {
  return findElements(
    page(),
    (element) =>
      element.getAttribute("role") === "dialog" &&
      element.getAttribute("data-state") === "closed"
  )[0];
}

function alertDialog(): TestElement {
  const found = findElements(
    page(),
    (element) => element.getAttribute("role") === "alertdialog"
  )[0];
  if (!found) {
    throw new Error("No confirmation is open");
  }
  return found;
}

/** The control a visible `<label>` names. */
function labelled(text: string): TestElement {
  const label = findElements(
    page(),
    (element) =>
      element.tagName === "LABEL" && element.textContent.startsWith(text)
  )[0];
  const id = label?.getAttribute("for");
  const control = findElements(
    page(),
    (element) => Boolean(id) && element.getAttribute("id") === id
  )[0];
  if (!control) {
    throw new Error(`No control labelled ${text}`);
  }
  return control;
}

/** Lets go of `activeId` over `overId` in the only sortable group. */
async function drop(activeId: string, overId: string): Promise<void> {
  const handlers = [...dropHandlers.values()];
  if (handlers.length !== 1) {
    throw new Error(`Expected one sortable group, found ${handlers.length}`);
  }
  await act(async () => {
    handlers[0]?.({
      active: { id: activeId },
      over: { id: overId },
    } as unknown as DragEndEvent);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

const NATIONAL_TITLE = "Hele BISO — slik ser det ut på forsiden";

describe("PartnersPage, website logos", () => {
  test("Hele BISO comes first, then each campus, every tile named", async () => {
    await mount();

    const headings = groups().map(
      (element) =>
        findElements(element, (el) => el.tagName === "H2")[0]?.textContent
    );
    expect(headings).toEqual([NATIONAL_TITLE, "Bergen"]);
    expect(tileNames(group(NATIONAL_TITLE))).toEqual(["DNB", "EY", "Equinor"]);
    expect(tileNames(group("Bergen"))).toEqual(["Sparebanken Vest", "BKK"]);
    // The image sits above the name, which already says whose logo it is.
    const images = findElements(
      group("Bergen"),
      (element) => element.tagName === "IMG"
    );
    expect(images.map((image) => image.getAttribute("src"))).toEqual([
      "https://appwrite.biso.no/logos/l-spv.png",
      "https://appwrite.biso.no/logos/l-bkk.png",
    ]);
    expect(images.map((image) => image.getAttribute("alt"))).toEqual(["", ""]);
    // No ids on screen.
    expect(page().textContent).not.toContain("l-dnb");
  });

  test("the logos tab is current, with its intro, hint and + Ny logo", async () => {
    await mount();

    const tabs = findElements(page(), (element) => element.tagName === "A");
    const logos = tabs.find(
      (link) => link.textContent === "Logoer på nettsiden"
    );
    const deals = tabs.find((link) => link.textContent === "Tilbudspartnere");
    expect(logos?.getAttribute("aria-current")).toBe("page");
    expect(deals?.getAttribute("aria-current")).toBeNull();
    expect(page().textContent).toContain(
      "Vises på forsiden, «Om oss» og på sider der noen har lagt inn en partnerblokk."
    );
    expect(page().textContent).toContain(
      "Klikk en logo for å bytte bilde, navn eller lenke — eller fjerne den."
    );
    expect(findButton(page(), "+ Ny logo")).toBeDefined();
  });

  test("a read-only group has no add tile and no drag handles", async () => {
    await mount();

    expect(addTiles(group(NATIONAL_TITLE))).toHaveLength(0);
    expect(dragHandleLabels(group(NATIONAL_TITLE))).toEqual([]);
    expect(addTiles(group("Bergen"))).toHaveLength(1);
    expect(dragHandleLabels(group("Bergen"))).toEqual([
      "Flytt «Sparebanken Vest»",
      "Flytt «BKK»",
    ]);
  });

  test("for an administrator Hele BISO can be added to and sorted", async () => {
    await mount({ groups: [{ ...national, editable: true }, bergen] });

    expect(addTiles(group(NATIONAL_TITLE))).toHaveLength(1);
    expect(dragHandleLabels(group(NATIONAL_TITLE))).toEqual([
      "Flytt «DNB»",
      "Flytt «EY»",
      "Flytt «Equinor»",
    ]);
  });

  test("a viewer who can change nothing gets no + Ny logo and no hint", async () => {
    await mount({ groups: [national] });

    expect(
      findElements(
        page(),
        (element) =>
          element.tagName === "BUTTON" && element.textContent === "+ Ny logo"
      )
    ).toHaveLength(0);
    expect(page().textContent).not.toContain("Klikk en logo");
  });

  test("a read-only logo opens a locked sheet", async () => {
    await mount();

    await click("DNB");

    const panel = sheet() as TestElement;
    expect(panel.textContent).toContain(
      "Bare administratorer kan endre partnere for hele BISO."
    );
    const title = findElements(panel, (element) => element.tagName === "H2")[0];
    expect(title?.textContent).toBe("DNB");
    expect(labelled("Navn").hasAttribute("disabled")).toBe(true);
    expect(labelled("Lenke").hasAttribute("disabled")).toBe(true);
    expect(labelled("Campus").hasAttribute("disabled")).toBe(true);
    const buttons = findElements(
      panel,
      (element) => element.tagName === "BUTTON"
    ).map((button) => button.textContent);
    expect(buttons).not.toContain("Lagre");
    expect(buttons).not.toContain("Fjern logo");
  });

  test("a logo can't be saved without an image", async () => {
    await mount();
    await click("+ Legg til", group("Bergen"));

    await type(labelled("Navn"), "Kaffebar");
    await click("Lagre");

    expect(calls.save).toHaveLength(0);
    expect(sheet()?.textContent).toContain("Last opp en logo.");
  });

  test("+ Legg til starts a new logo on that group's campus", async () => {
    await mount({ groups: [{ ...national, editable: true }, bergen] });

    await click("+ Legg til", group("Bergen"));

    const panel = sheet() as TestElement;
    expect(panel.textContent).toContain("Ny logo");
    // The campus line above the title names where the logo will go.
    const campusLine = findElements(
      panel,
      (element) => element.tagName === "P"
    )[0];
    expect(campusLine?.textContent).toBe("Bergen");
    const options = findElements(
      labelled("Campus"),
      (element) => element.tagName === "OPTION"
    ).map((option) => option.textContent);
    expect(options).toEqual(["Hele BISO", "Bergen"]);
    const buttons = findElements(
      panel,
      (element) => element.tagName === "BUTTON"
    ).map((button) => button.textContent);
    expect(buttons).not.toContain("Fjern logo");
  });

  test("a logo needs a name, and a link must be https", async () => {
    await mount();
    await click("BKK");

    await type(labelled("Navn"), "  ");
    await type(labelled("Lenke"), "http://bkk.no");
    await click("Lagre");

    expect(calls.save).toHaveLength(0);
    expect(sheet()?.textContent).toContain("Skriv inn navnet på bedriften.");
    expect(sheet()?.textContent).toContain("Lenken må starte med https://");
    expect(labelled("Navn").getAttribute("aria-invalid")).toBe("true");
  });

  test("saving an edited logo sends every field, toasts and refreshes", async () => {
    await mount();
    await click("BKK");
    expect(sheet()?.textContent).toContain("Endre logo");

    await type(labelled("Navn"), "BKK Nett");
    await type(labelled("Lenke"), "bkk.no");
    await click("Lagre");

    expect(calls.save).toEqual([
      [
        {
          campus_id: "2",
          id: "l-bkk",
          image_url: "https://appwrite.biso.no/logos/l-bkk.png",
          name: "BKK Nett",
          url: "https://bkk.no",
        },
      ],
    ]);
    expect(toasts).toEqual([
      { description: undefined, kind: "success", message: "Lagret" },
    ]);
    expect(refreshes).toBe(1);
    expect(sheet()).toBeUndefined();
  });

  test("a refusal is explained in Norwegian and keeps the sheet open", async () => {
    await mount();
    await click("BKK");
    serverError = BENEFIT_ERRORS.noCampusAccess;

    await click("Lagre");

    expect(toasts).toEqual([
      {
        description:
          "Du har ikke tilgang til å endre fordeler for denne campusen.",
        kind: "error",
        message: "Kunne ikke lagre. Prøv igjen.",
      },
    ]);
    expect(refreshes).toBe(0);
    expect(sheet()).toBeDefined();
  });

  test("a save cannot be sent twice while the sheet closes", async () => {
    await mount();
    await click("BKK");
    const save = findButton(sheet() as TestElement, "Lagre");

    await press(save);
    expect(calls.save).toHaveLength(1);
    expect(closingSheet()).toBeDefined();

    await press(save);

    expect(calls.save).toHaveLength(1);
    expect(toasts.map((call) => call.message)).toEqual(["Lagret"]);
  });

  test("closing with unsaved changes asks first", async () => {
    await mount();
    await click("BKK");
    await type(labelled("Navn"), "BKK Nett");

    await press(findByAriaLabel(page(), "Lukk"));

    expect(alertDialog().textContent).toContain("Forkaste endringene?");
    expect(sheet()).toBeDefined();
  });

  test("removing a logo asks first, then removes it", async () => {
    await mount();
    await click("BKK");

    await click("Fjern logo");

    const dialog = alertDialog();
    expect(dialog.textContent).toContain("Fjerne BKK fra nettsiden?");
    expect(calls.delete).toHaveLength(0);

    await click("Fjern logo", dialog);

    expect(calls.delete).toEqual([["l-bkk"]]);
    expect(toasts.map((call) => call.message)).toEqual(["Slettet"]);
    expect(refreshes).toBe(1);
    expect(sheet()).toBeUndefined();
  });

  test("a dropped logo moves at once and its new order is saved", async () => {
    await mount();

    await drop("l-bkk", "l-spv");

    expect(tileNames(group("Bergen"))).toEqual(["BKK", "Sparebanken Vest"]);
    expect(calls.reorder).toEqual([["2", ["l-bkk", "l-spv"]]]);
    expect(toasts).toEqual([]);
  });

  test("a move that can't be saved goes back, with a toast", async () => {
    await mount();
    serverError = BENEFIT_ERRORS.reorderOutOfDate;

    await drop("l-bkk", "l-spv");

    expect(calls.reorder).toHaveLength(1);
    expect(tileNames(group("Bergen"))).toEqual(["Sparebanken Vest", "BKK"]);
    expect(toasts).toEqual([
      {
        description: undefined,
        kind: "error",
        message: "Kunne ikke lagre rekkefølgen. Prøv igjen.",
      },
    ]);
    // The save refuses an out-of-date order; fetch the current one.
    expect(refreshes).toBe(1);
  });
});
