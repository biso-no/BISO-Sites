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
import type {
  PartnerDeal,
  PartnerWithDeals,
} from "../../../_actions/benefit-partners";
import type { DealPartnersProps } from "./partners-page";

// `mock.module` is process-wide, so every shared module keeps the exports it
// already has and only what this page needs is replaced. Translations read
// the real Norwegian bundle through the ICU formatter next-intl uses, so the
// assertions read what a committee member sees, plurals included. The lookup
// is local: an earlier suite may have swapped `next-intl` for a stub.
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
  useSearchParams: () => new URLSearchParams(),
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
        "aria-describedby": props["aria-describedby"],
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
// harness lacks, so they render inline here, exactly as the benefit panel's
// suite stubs them; the real Sheet is checked in the browser.
type Slot = { children?: ReactNode } & Record<string, unknown>;
type OpenChange = (open: boolean) => void;
const SheetOpenChange = createContext<OpenChange>(() => undefined);
const actualSheet = await import("@repo/ui/components/ui/sheet");
mock.module("@repo/ui/components/ui/sheet", () => ({
  ...actualSheet,
  Sheet: ({ children, onOpenChange, open }: Slot) =>
    open === false
      ? null
      : createElement(
          SheetOpenChange.Provider,
          { value: onOpenChange as OpenChange },
          children
        ),
  SheetContent({ children, onEscapeKeyDown }: Slot) {
    const onOpenChange = useContext(SheetOpenChange);
    return createElement(
      "div",
      {
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

// The page's server actions sit behind a thin module this suite owns, so
// the shared `_actions` module is never replaced process-wide.
const calls = {
  create: [] as unknown[][],
  delete: [] as unknown[][],
  end: [] as unknown[][],
  restart: [] as unknown[][],
  update: [] as unknown[][],
};
/** Set to make the next server call fail with this reason. */
let serverError: string | null = null;
const answer = <T,>(data: T) =>
  Promise.resolve(serverError === null ? { data } : { error: serverError });
mock.module("./partner-actions", () => ({
  createPartner: (...args: unknown[]) => {
    calls.create.push(args);
    return answer({ id: "p-new" });
  },
  deletePartner: (...args: unknown[]) => {
    calls.delete.push(args);
    return answer({ deletedDeals: 2 });
  },
  endPartner: (...args: unknown[]) => {
    calls.end.push(args);
    return answer({ hiddenDeals: 1 });
  },
  restartPartner: (...args: unknown[]) => {
    calls.restart.push(args);
    return answer(true);
  },
  updatePartner: (...args: unknown[]) => {
    calls.update.push(args);
    return answer({ id: args[0] });
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
  addresses.length = 0;
  toasts.length = 0;
  serverError = null;
  for (const list of Object.values(calls)) {
    list.length = 0;
  }
  installedDom.document.body.textContent = "";
});

afterAll(() => {
  console.warn = actualWarn;
  installedDom.restore();
});

const NOW = "2026-10-22T12:00:00.000Z";

let dealCount = 0;
function deal(
  partnerId: string,
  title: string,
  overrides: Partial<PartnerDeal> = {}
): PartnerDeal {
  dealCount += 1;
  return {
    $id: `d-${dealCount}`,
    campus_id: "2",
    partner_id: partnerId,
    publish_end: null,
    publish_start: null,
    section: "member",
    status: "published",
    title_en: "",
    title_nb: title,
    ...overrides,
  };
}

function partner(
  id: string,
  name: string,
  overrides: Partial<PartnerWithDeals> = {}
): PartnerWithDeals {
  return {
    campus_id: "2",
    deals: [],
    description_en: null,
    description_nb: null,
    editable: true,
    id,
    is_active: true,
    logo_url: null,
    name,
    website_url: null,
    ...overrides,
  };
}

const loft = partner("p-loft", "Løft studios", {
  deals: [deal("p-loft", "20 % hos Løft studios")],
  website_url: "https://www.loftstudios.no",
});
const dogtails = partner("p-dog", "Dogtails", {
  deals: [
    deal("p-dog", "15 % når du spiser inne"),
    deal("p-dog", "20 % på takeaway", { status: "draft" }),
  ],
});
const bakery = partner("p-old", "Gamle Bakeriet", {
  deals: [deal("p-old", "Gratis kaffe")],
  is_active: false,
});
const equinor = partner("p-eq", "Equinor", {
  campus_id: "5",
  editable: false,
});

function props(overrides: Partial<DealPartnersProps> = {}): DealPartnersProps {
  return {
    campusLabels: {
      "1": "Oslo",
      "2": "Bergen",
      "3": "Trondheim",
      "4": "Stavanger",
      "5": "Hele BISO",
    },
    editableCampusIds: ["2"],
    filter: { campusId: "all", showEnded: false },
    locale: "no",
    now: NOW,
    partners: [loft, dogtails, bakery, equinor],
    visibleCampusIds: ["2", "5"],
    ...overrides,
  };
}

/** Where the chips moved the address bar, without asking the server again. */
const addresses: string[] = [];

async function mount(overrides: Partial<DealPartnersProps> = {}) {
  Object.assign(window, {
    history: {
      replaceState: (_state: unknown, _title: string, url: string) => {
        addresses.push(url);
      },
    },
  });
  container = installedDom.document.createElement("div");
  installedDom.document.body.appendChild(container);
  root = createRoot(container as unknown as Element);
  await act(() => {
    root?.render(<PartnersPage deals={props(overrides)} tab="deals" />);
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

function cards(): TestElement[] {
  return findElements(page(), (element) => element.tagName === "ARTICLE");
}

function card(name: string): TestElement {
  const found = cards().find((candidate) =>
    candidate.textContent.includes(name)
  );
  if (!found) {
    throw new Error(`No card for ${name}`);
  }
  return found;
}

function links(within: TestNode, text: string): TestElement[] {
  return findElements(
    within,
    (element) => element.tagName === "A" && element.textContent === text
  );
}

async function openCard(name: string): Promise<void> {
  const target = card(name);
  const button = findElements(
    target,
    (element) =>
      element.tagName === "BUTTON" &&
      (element.textContent === "Endre" || element.textContent === "Vis")
  )[0];
  if (!button) {
    throw new Error(`No open button on ${name}`);
  }
  await press(button);
}

function sheet(): TestElement | undefined {
  return findElements(
    page(),
    (element) => element.getAttribute("role") === "dialog"
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

describe("PartnersPage, deal partners", () => {
  test("each card shows the partner, where it is and its offers with their state", async () => {
    await mount();

    const names = cards().map(
      (element) => findElements(element, (el) => el.tagName === "H2")[0]
    );
    expect(names.map((heading) => heading?.textContent)).toEqual([
      "Dogtails",
      "Equinor",
      "Løft studios",
    ]);
    const loftCard = card("Løft studios");
    expect(loftCard.textContent).toContain("loftstudios.no · Bergen");
    expect(loftCard.textContent).toContain("20 % hos Løft studios");
    expect(loftCard.textContent).toContain("Synlig");
    const dogCard = card("Dogtails");
    expect(dogCard.textContent).toContain("15 % når du spiser inne");
    expect(dogCard.textContent).toContain("20 % på takeaway");
    expect(dogCard.textContent).toContain("Utkast");
    expect(card("Equinor").textContent).toContain("Hele BISO");
    expect(card("Equinor").textContent).toContain("Ingen tilbud ennå");
    // No ids or raw values on screen.
    expect(page().textContent).not.toContain("p-loft");
    expect(page().textContent).not.toContain("published");
  });

  test("the tabs, the campus chips and the header action are there", async () => {
    await mount();

    const tabs = findElements(page(), (element) => element.tagName === "A");
    const deals = tabs.find((link) => link.textContent === "Tilbudspartnere");
    const logos = tabs.find(
      (link) => link.textContent === "Logoer på nettsiden"
    );
    expect(deals?.getAttribute("aria-current")).toBe("page");
    expect(logos?.getAttribute("href")).toBe("/benefits/partners?tab=logos");
    const chips = ["Alle", "Bergen", "Hele BISO", "Vis avsluttede"].map(
      (label) => findButton(page(), label)
    );
    expect(chips.map((chip) => chip.getAttribute("aria-pressed"))).toEqual([
      "true",
      "false",
      "false",
      "false",
    ]);
    expect(findButton(page(), "+ Ny partner")).toBeDefined();
  });

  test("an ended partner is hidden until Vis avsluttede is on", async () => {
    await mount();
    expect(page().textContent).not.toContain("Gamle Bakeriet");

    await click("Vis avsluttede");

    expect(
      findButton(page(), "Vis avsluttede").getAttribute("aria-pressed")
    ).toBe("true");
    const ended = card("Gamle Bakeriet");
    expect(ended.textContent).toContain("Avsluttet");
    const item = ended.parentNode as TestElement;
    expect(item.style.opacity).toBe("0.55");
    // Its offer is not on the website any more.
    expect(ended.textContent).toContain("Gratis kaffe");
    expect(ended.textContent).not.toContain("Synlig");
    // A new offer would not show either, so the card offers none.
    expect(links(ended, "+ Nytt tilbud")).toHaveLength(0);
    expect(addresses).toEqual(["/benefits/partners?ended=1"]);
  });

  test("a campus chip shows only that campus's partners", async () => {
    await mount();

    await click("Hele BISO");

    expect(cards().map((element) => element.textContent)).toEqual([
      expect.stringContaining("Equinor"),
    ]);
    expect(findButton(page(), "Hele BISO").getAttribute("aria-pressed")).toBe(
      "true"
    );
    expect(findButton(page(), "Alle").getAttribute("aria-pressed")).toBe(
      "false"
    );
    expect(addresses).toEqual(["/benefits/partners?campus=5"]);

    await click("Alle");

    expect(cards()).toHaveLength(3);
    expect(addresses.at(-1)).toBe("/benefits/partners");
  });

  test("an editable card links to a new offer for that partner", async () => {
    await mount();

    const [newDeal] = links(card("Løft studios"), "+ Nytt tilbud");
    expect(newDeal?.getAttribute("href")).toBe(
      "/benefits/new?campus=2&section=member&partner=p-loft"
    );
  });

  test("a read-only partner has no + Nytt tilbud and opens a locked sheet", async () => {
    await mount();
    const readOnly = card("Equinor");
    expect(links(readOnly, "+ Nytt tilbud")).toHaveLength(0);

    await openCard("Equinor");

    const panel = sheet();
    expect(panel?.textContent).toContain(
      "Bare administratorer kan endre partnere for hele BISO."
    );
    const title = findElements(
      panel as TestElement,
      (element) => element.tagName === "H2"
    )[0];
    expect(title?.textContent).toBe("Equinor");
    expect(labelled("Navn").hasAttribute("disabled")).toBe(true);
    expect(labelled("Campus").hasAttribute("disabled")).toBe(true);
    const buttons = findElements(
      panel as TestElement,
      (element) => element.tagName === "BUTTON"
    ).map((button) => button.textContent);
    expect(buttons).not.toContain("Lagre");
    expect(buttons).not.toContain("Avslutt samarbeid");
    expect(buttons).not.toContain("Slett for godt");
  });

  test("saving an edited partner sends every field, toasts and refreshes", async () => {
    await mount();
    await openCard("Løft studios");
    expect(sheet()?.textContent).toContain("Endre partner");

    await type(labelled("Navn"), "Løft studio");
    await click("Lagre");

    expect(calls.update).toEqual([
      [
        "p-loft",
        {
          campus_id: "2",
          description_en: null,
          description_nb: null,
          logo_url: null,
          name: "Løft studio",
          website_url: "https://www.loftstudios.no",
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
    await openCard("Løft studios");
    serverError = BENEFIT_ERRORS.partnerHasOffersOnOtherCampus;

    await click("Lagre");

    expect(toasts).toEqual([
      {
        description: "Partneren har tilbud på en annen campus.",
        kind: "error",
        message: "Kunne ikke lagre. Prøv igjen.",
      },
    ]);
    expect(refreshes).toBe(0);
    expect(sheet()).toBeDefined();
  });

  test("a partner needs a name before it is saved", async () => {
    await mount();
    await openCard("Løft studios");

    await type(labelled("Navn"), "  ");
    await click("Lagre");

    expect(calls.update).toHaveLength(0);
    expect(sheet()?.textContent).toContain("Skriv inn navnet på partneren.");
    expect(labelled("Navn").getAttribute("aria-invalid")).toBe("true");
  });

  test("a new partner starts on the chosen campus and gets https added", async () => {
    await mount();
    await click("Bergen");

    await click("+ Ny partner");
    const panel = sheet() as TestElement;
    expect(panel.textContent).toContain("Ny partner");
    const buttons = findElements(
      panel,
      (element) => element.tagName === "BUTTON"
    ).map((button) => button.textContent);
    expect(buttons).not.toContain("Avslutt samarbeid");
    expect(buttons).not.toContain("Slett for godt");

    await type(labelled("Navn"), "Kaffebar");
    await type(labelled("Nettside"), "kaffebar.no");
    await type(labelled("Kort beskrivelse"), "Kaffe og kaker");
    await click("Lagre");

    expect(calls.create).toEqual([
      [
        {
          campus_id: "2",
          description_en: null,
          description_nb: "Kaffe og kaker",
          logo_url: null,
          name: "Kaffebar",
          website_url: "https://kaffebar.no",
        },
      ],
    ]);
    expect(refreshes).toBe(1);
  });

  test("closing with unsaved changes asks first", async () => {
    await mount();
    await openCard("Løft studios");
    await type(labelled("Navn"), "Løft");

    await press(findByAriaLabel(page(), "Lukk"));

    expect(alertDialog().textContent).toContain("Forkaste endringene?");
    expect(sheet()).toBeDefined();
  });

  describe("ending a partnership", () => {
    const zero = partner("p-zero", "Null AS", {
      deals: [deal("p-zero", "Kommer snart", { status: "draft" })],
    });
    const one = partner("p-one", "En AS", {
      deals: [deal("p-one", "Ett tilbud")],
    });
    const three = partner("p-three", "Tre AS", {
      deals: [
        deal("p-three", "Første"),
        deal("p-three", "Andre"),
        deal("p-three", "Tredje"),
      ],
    });

    const cases: [string, string][] = [
      ["Null AS", "Ingen tilbud forsvinner fra nettsiden."],
      ["En AS", "Det ene tilbudet deres forsvinner fra nettsiden med en gang."],
      ["Tre AS", "De 3 tilbudene deres forsvinner fra nettsiden med en gang."],
    ];
    for (const [name, sentence] of cases) {
      test(`the confirmation counts the offers that disappear (${name})`, async () => {
        await mount({ partners: [zero, one, three] });
        await openCard(name);

        await click("Avslutt samarbeid");

        const text = alertDialog().textContent;
        expect(text).toContain(`Avslutte samarbeidet med ${name}?`);
        expect(text).toContain(sentence);
        expect(text).toContain("blir liggende under «Vis avsluttede»");
      });
    }

    test("confirming ends it, toasts and refreshes", async () => {
      await mount({ partners: [three] });
      await openCard("Tre AS");
      await click("Avslutt samarbeid");

      await click("Avslutt samarbeid", alertDialog());

      expect(calls.end).toEqual([["p-three"]]);
      expect(toasts.map((call) => call.message)).toEqual([
        "Samarbeidet er avsluttet",
      ]);
      expect(refreshes).toBe(1);
      expect(sheet()).toBeUndefined();
    });

    test("an ended partner can start again", async () => {
      await mount({ filter: { campusId: "all", showEnded: true } });
      await openCard("Gamle Bakeriet");

      await click("Start samarbeidet igjen");

      expect(calls.restart).toEqual([["p-old"]]);
      expect(toasts.map((call) => call.message)).toEqual([
        "Samarbeidet er i gang igjen",
      ]);
      expect(refreshes).toBe(1);
    });
  });

  describe("deleting a partner", () => {
    test("the confirmation lists every offer that goes with it", async () => {
      await mount();
      await openCard("Dogtails");

      await click("Slett for godt");

      const dialog = alertDialog();
      expect(dialog.textContent).toContain("Slette Dogtails for godt?");
      expect(dialog.textContent).toContain(
        "Dette sletter også disse tilbudene, og det kan ikke angres:"
      );
      const items = findElements(
        dialog,
        (element) => element.tagName === "LI"
      ).map((item) => item.textContent);
      expect(items).toEqual(["15 % når du spiser inne", "20 % på takeaway"]);
    });

    test("confirming deletes it, toasts and refreshes", async () => {
      await mount();
      await openCard("Dogtails");
      await click("Slett for godt");

      await click("Slett for godt", alertDialog());

      expect(calls.delete).toEqual([["p-dog"]]);
      expect(toasts.map((call) => call.message)).toEqual(["Slettet"]);
      expect(refreshes).toBe(1);
    });

    test("the end confirmation also leads to deleting", async () => {
      await mount();
      await openCard("Dogtails");
      await click("Avslutt samarbeid");

      await click("Slett for godt", alertDialog());

      expect(alertDialog().textContent).toContain("Slette Dogtails for godt?");
      expect(calls.end).toHaveLength(0);
    });

    test("a partner without offers is just deleted", async () => {
      await mount({ partners: [partner("p-solo", "Solo AS")] });
      await openCard("Solo AS");

      await click("Slett for godt");

      expect(alertDialog().textContent).toContain("Dette kan ikke angres.");
      expect(
        findElements(alertDialog(), (element) => element.tagName === "LI")
      ).toHaveLength(0);
    });
  });
});
