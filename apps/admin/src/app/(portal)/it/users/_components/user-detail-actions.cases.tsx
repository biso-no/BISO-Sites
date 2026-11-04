import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  mock,
  test,
} from "bun:test";
import { act, createElement } from "react";
import type { Root } from "react-dom/client";
import {
  findElements,
  installReactDom,
  type TestElement,
  type TestNode,
} from "@/test/react-dom-harness";

// Pins every confirm-then-run action on the IT user page: what the dialog
// says, whether its button is the danger one, which Microsoft 365 action runs
// with which arguments, the toast, and whether the page refreshes. Runs in its
// own process (see user-detail-actions.test.ts): the action module is mocked.

interface Result {
  data?: unknown;
  error?: string;
  success?: boolean;
}
const ok = (data?: unknown): Result => ({ data, success: true });

const actions = {
  addM365UserAlias: mock((_input: unknown) => Promise.resolve(ok())),
  addM365UserToGroup: mock((_input: unknown) => Promise.resolve(ok())),
  assignM365License: mock((_input: unknown) => Promise.resolve(ok())),
  checkAliasConflict: mock((_input: unknown) => Promise.resolve(ok())),
  checkUpnAvailability: mock((_input: unknown) => Promise.resolve(ok())),
  forcePasswordResetNextSignIn: mock((_input: unknown) =>
    Promise.resolve(ok())
  ),
  removeM365License: mock((_input: unknown) => Promise.resolve(ok())),
  removeM365UserAlias: mock((_input: unknown) => Promise.resolve(ok())),
  removeM365UserFromGroup: mock((_input: unknown) => Promise.resolve(ok())),
  removeM365UserManager: mock((_input: unknown) => Promise.resolve(ok())),
  resetM365Mfa: mock((_input: unknown) =>
    Promise.resolve(ok({ failures: [] as string[] }))
  ),
  resetM365Password: mock((_input: unknown) =>
    Promise.resolve(ok({ temporaryPassword: "Temp-123" }))
  ),
  revokeM365SignInSessions: mock((_input: unknown) => Promise.resolve(ok())),
  searchM365Groups: mock((_input: unknown) =>
    Promise.resolve(ok([group("g1", "Board"), group("g2", "Tech")]) as Result)
  ),
  searchM365Users: mock((_input: unknown) =>
    Promise.resolve(
      ok([
        listItem("u1", "Ada Lovelace", "ada@biso.no"),
        listItem("m2", "Alan Turing", "alan@biso.no"),
      ]) as Result
    )
  ),
  transferM365Alias: mock((_input: unknown) => Promise.resolve(ok())),
  updateM365UserManager: mock((_input: unknown) => Promise.resolve(ok())),
  updateM365UserProfile: mock((_input: unknown) => Promise.resolve(ok())),
};
const toast = {
  error: mock((_m: string) => undefined),
  success: mock((_m: string) => undefined),
};
const refresh = mock(() => undefined);

mock.module("server-only", () => ({}));
mock.module("../../../_actions/it-users", () => actions);
mock.module("../../../_actions/it-turnover", () => ({
  triggerM365Turnover: mock(() => Promise.resolve(ok())),
}));
mock.module("sonner", () => ({ toast }));
mock.module("next/navigation", () => ({
  usePathname: () => "/it/users/u1",
  useRouter: () => ({ push: () => undefined, refresh }),
  useSearchParams: () => new URLSearchParams(),
}));
mock.module("next-intl", () => ({
  useLocale: () => "no",
  useTranslations: (namespace: string) => (key: string) =>
    `${namespace}.${key}`,
}));

function listItem(id: string, displayName: string, upn: string) {
  return {
    accountEnabled: true,
    createdDateTime: null,
    department: null,
    displayName,
    id,
    jobTitle: null,
    lastSignInDateTime: null,
    mail: upn,
    officeLocation: null,
    userPrincipalName: upn,
  };
}

function group(id: string, displayName: string) {
  return {
    description: null,
    displayName,
    groupTypes: [] as string[],
    id,
    isTeamsRelated: false,
    mail: null,
    mailEnabled: false,
    membershipType: "direct" as const,
    securityEnabled: true,
  };
}

/** Every label reads as its own key, so buttons are found by key. */
const labels = new Proxy({}, { get: (_target, key) => String(key) }) as never;
const allowed = new Proxy({}, { get: () => true }) as never;

const props = {
  authMethods: {
    methods: [
      {
        displayName: "Phone",
        id: "mfa1",
        odataType: "#microsoft.graph.phoneAuthenticationMethod",
        removable: true,
        type: "phone",
      },
    ],
  },
  groups: [group("g1", "Board")],
  isTurnoverTarget: false,
  labels,
  licenses: [{ servicePlans: [], skuId: "sku-a", skuPartNumber: "E3" }],
  options: { campuses: [], departments: [] },
  permissions: allowed,
  subscribedSkus: [
    {
      consumedUnits: 0,
      prepaidUnits: { enabled: 5, suspended: 0, warning: 0 },
      skuId: "sku-b",
      skuPartNumber: "E5",
    },
  ],
  user: {
    ...listItem("u1", "Ada Lovelace", "ada@biso.no"),
    assignedLicenses: [{ skuId: "sku-a" }],
    businessPhones: [] as string[],
    employeeId: null,
    givenName: "Ada",
    mailNickname: "ada",
    manager: listItem("m1", "Grace Hopper", "grace@biso.no"),
    mobilePhone: null,
    proxyAddresses: ["SMTP:ada@biso.no", "smtp:ada.l@biso.no"],
    surname: "Lovelace",
  },
};

// Before the component loads: it reaches react-dom through Radix, and
// react-dom decides at load whether the `input` event exists.
const installedDom = installReactDom();
const { UserDetailClient } = await import("./user-detail-client");
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
  installedDom.document.body.textContent = "";
  for (const action of Object.values(actions)) {
    action.mockClear();
  }
  toast.error.mockClear();
  toast.success.mockClear();
  refresh.mockClear();
});

afterAll(() => installedDom.restore());

async function mount() {
  container = installedDom.document.createElement("div");
  installedDom.document.body.appendChild(container);
  root = createRoot(container as unknown as Element);
  await act(() => {
    root?.render(createElement(UserDetailClient, props as never));
  });
}

const page = () => container as unknown as TestNode;

function buttonsWith(text: string): TestElement[] {
  return findElements(
    page(),
    (element) =>
      element.tagName === "BUTTON" && (element.textContent ?? "").includes(text)
  );
}

function button(text: string): TestElement {
  const found = findElements(
    page(),
    (element) => element.tagName === "BUTTON" && element.textContent === text
  )[0];
  if (!found) {
    throw new Error(`Button not found: ${text}`);
  }
  return found;
}

async function click(element: TestElement) {
  await act(async () => {
    element.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function type(placeholder: string, text: string) {
  const input = findElements(
    page(),
    (element) =>
      element.tagName === "INPUT" &&
      element.getAttribute("placeholder") === placeholder
  )[0];
  if (!input) {
    throw new Error(`Input not found: ${placeholder}`);
  }
  // A dispatched "input" event never reaches react-dom's change plugin for
  // these harness inputs, so call the onChange React rendered, with the event
  // fields the handlers read.
  const propsKey = Object.keys(input).find((key) =>
    key.startsWith("__reactProps")
  );
  const rendered = propsKey
    ? (input as unknown as Record<string, { onChange?: (e: unknown) => void }>)[
        propsKey
      ]
    : undefined;
  if (!rendered?.onChange) {
    throw new Error(`No onChange on: ${placeholder}`);
  }
  const { onChange } = rendered;
  await act(async () => {
    input.value = text;
    onChange({ currentTarget: input, target: input });
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

const hasInput = (placeholder: string) =>
  findElements(
    page(),
    (element) =>
      element.tagName === "INPUT" &&
      element.getAttribute("placeholder") === placeholder
  ).length > 0;

/** The open confirm dialog: its texts and whether its button is the red one. */
function dialog() {
  const confirm = button("confirmActionButton");
  const box = confirm.parentNode?.parentNode as TestElement;
  const [title] = findElements(box, (element) => element.tagName === "H3");
  const [description] = findElements(box, (element) => element.tagName === "P");
  return {
    confirm,
    danger: confirm.style.background === "rgba(107,30,30,0.08)",
    description: description?.textContent,
    title: title?.textContent,
  };
}

interface Case {
  action: keyof typeof actions;
  args: unknown;
  danger: boolean;
  description: string;
  name: string;
  /** Opens the dialog. */
  open: () => Promise<void>;
  refreshes: boolean;
  success: string;
  title: string;
}

const CASES: Case[] = [
  {
    action: "removeM365UserAlias",
    args: { alias: "smtp:ada.l@biso.no", userId: "u1" },
    danger: true,
    description: 'confirmRemoveAliasDesc "ada.l@biso.no"',
    name: "remove an alias",
    open: () => click(button("removeAlias")),
    refreshes: true,
    success: "aliasRemoved",
    title: "confirmRemoveAliasTitle",
  },
  {
    action: "updateM365UserManager",
    args: { managerId: "m2", userId: "u1" },
    danger: false,
    description: "confirmChangeManagerDesc → Alan Turing (alan@biso.no)",
    name: "change the manager",
    open: async () => {
      await click(button("changeManager"));
      await type("searchManagerPlaceholder", "Al");
      const [result] = buttonsWith("Alan Turing");
      await click(result as TestElement);
    },
    refreshes: true,
    success: "managerAssigned",
    title: "confirmChangeManagerTitle",
  },
  {
    action: "removeM365UserManager",
    args: { userId: "u1" },
    danger: true,
    description: "confirmRemoveManagerDesc",
    name: "remove the manager",
    open: () => click(button("removeManager")),
    refreshes: true,
    success: "managerRemoved",
    title: "confirmRemoveManagerTitle",
  },
  {
    action: "addM365UserToGroup",
    args: { groupId: "g2", userId: "u1" },
    danger: false,
    description: "confirmAddToGroupDesc — Tech",
    name: "add to a group",
    open: async () => {
      await click(button("addToGroup"));
      await type("searchGroupPlaceholder", "Te");
      const [result] = buttonsWith("Tech");
      await click(result as TestElement);
    },
    refreshes: true,
    success: "groupAdded",
    title: "confirmAddToGroupTitle",
  },
  {
    action: "removeM365UserFromGroup",
    args: { groupId: "g1", userId: "u1" },
    danger: true,
    description: "confirmRemoveFromGroupDesc — Board",
    name: "remove from a group",
    open: () => click(button("removeFromGroup")),
    refreshes: true,
    success: "groupRemoved",
    title: "confirmRemoveFromGroupTitle",
  },
  {
    action: "assignM365License",
    args: { skuId: "sku-b", userId: "u1" },
    danger: false,
    description: "confirmAssignLicenseDesc — E5",
    name: "assign a licence",
    open: async () => {
      await click(button("assignLicense"));
      const [sku] = buttonsWith("E5");
      await click(sku as TestElement);
    },
    refreshes: true,
    success: "licenseAssigned",
    title: "confirmAssignLicenseTitle",
  },
  {
    action: "removeM365License",
    args: { skuId: "sku-a", userId: "u1" },
    danger: true,
    description: "confirmRemoveLicenseDesc — E3",
    name: "remove a licence",
    open: () => click(button("removeLicense")),
    refreshes: true,
    success: "licenseRemoved",
    title: "confirmRemoveLicenseTitle",
  },
  {
    action: "resetM365Mfa",
    args: { userId: "u1" },
    danger: true,
    description: "confirmResetMfaDesc",
    name: "reset MFA",
    open: () => click(button("resetMfa")),
    refreshes: true,
    success: "mfaReset",
    title: "confirmResetMfaTitle",
  },
  {
    action: "forcePasswordResetNextSignIn",
    args: { userId: "u1" },
    danger: true,
    description: "confirmForcePasswordResetDesc",
    name: "force a password reset",
    open: async () => {
      const [first] = buttonsWith("forcePasswordReset");
      await click(first as TestElement);
    },
    refreshes: false,
    success: "passwordForcedReset",
    title: "confirmForcePasswordResetTitle",
  },
  {
    action: "resetM365Password",
    args: { userId: "u1" },
    danger: true,
    description: "confirmResetPasswordDesc",
    name: "reset the password",
    open: async () => {
      const [first] = buttonsWith("resetPassword");
      await click(first as TestElement);
    },
    refreshes: false,
    success: "passwordReset",
    title: "confirmResetPasswordTitle",
  },
  {
    action: "revokeM365SignInSessions",
    args: { userId: "u1" },
    danger: true,
    description: "confirmRevokeSessionsDesc",
    name: "revoke sign-in sessions",
    open: () => click(button("revokeSessions")),
    refreshes: false,
    success: "sessionsRevoked",
    title: "confirmRevokeSessionsTitle",
  },
];

describe("confirm-then-run actions", () => {
  for (const c of CASES) {
    test(`${c.name}: asks, runs, toasts${c.refreshes ? ", refreshes" : ""}`, async () => {
      await mount();
      await c.open();
      const shown = dialog();
      expect({
        danger: shown.danger,
        description: shown.description,
        title: shown.title,
      }).toEqual({
        danger: c.danger,
        description: c.description,
        title: c.title,
      });
      expect(actions[c.action]).not.toHaveBeenCalled();
      await click(shown.confirm);
      expect(actions[c.action].mock.calls).toEqual([[c.args]]);
      expect(toast.success.mock.calls).toEqual([[c.success]]);
      expect(toast.error).not.toHaveBeenCalled();
      expect(refresh).toHaveBeenCalledTimes(c.refreshes ? 1 : 0);
      // The dialog closes once confirmed.
      expect(buttonsWith("confirmActionButton")).toHaveLength(0);
    });

    test(`${c.name}: a refusal is toasted and nothing else happens`, async () => {
      actions[c.action].mockImplementationOnce(() =>
        Promise.resolve({ error: "Refused by Graph" })
      );
      await mount();
      await c.open();
      await click(dialog().confirm);
      expect(toast.error.mock.calls).toEqual([["Refused by Graph"]]);
      expect(toast.success).not.toHaveBeenCalled();
      expect(refresh).not.toHaveBeenCalled();
    });
  }

  test("cancel closes the dialog without running anything", async () => {
    await mount();
    await click(button("removeManager"));
    await click(button("Cancel"));
    expect(buttonsWith("confirmActionButton")).toHaveLength(0);
    expect(actions.removeM365UserManager).not.toHaveBeenCalled();
  });

  test("adding to a group or changing the manager closes the search", async () => {
    await mount();
    await click(button("addToGroup"));
    await type("searchGroupPlaceholder", "Te");
    await click(buttonsWith("Tech")[0] as TestElement);
    await click(dialog().confirm);
    expect(hasInput("searchGroupPlaceholder")).toBe(false);

    await click(button("changeManager"));
    await type("searchManagerPlaceholder", "Al");
    await click(buttonsWith("Alan Turing")[0] as TestElement);
    await click(dialog().confirm);
    expect(hasInput("searchManagerPlaceholder")).toBe(false);
  });

  test("a group or manager search keeps the search open on a refusal", async () => {
    actions.addM365UserToGroup.mockImplementationOnce(() =>
      Promise.resolve({ error: "Refused by Graph" })
    );
    await mount();
    await click(button("addToGroup"));
    await type("searchGroupPlaceholder", "Te");
    await click(buttonsWith("Tech")[0] as TestElement);
    await click(dialog().confirm);
    expect(hasInput("searchGroupPlaceholder")).toBe(true);
  });

  test("assigning a licence closes the licence list", async () => {
    await mount();
    await click(button("assignLicense"));
    expect(buttonsWith("E5")).toHaveLength(1);
    await click(buttonsWith("E5")[0] as TestElement);
    await click(dialog().confirm);
    expect(buttonsWith("E5")).toHaveLength(0);
  });

  test("an MFA reset that leaves methods behind says which", async () => {
    actions.resetM365Mfa.mockImplementationOnce(() =>
      Promise.resolve(ok({ failures: ["Phone", "App"] }))
    );
    await mount();
    await click(button("resetMfa"));
    await click(dialog().confirm);
    expect(toast.error.mock.calls).toEqual([["mfaResetPartial: Phone · App"]]);
    expect(toast.success).not.toHaveBeenCalled();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  test("a password reset shows the temporary password", async () => {
    await mount();
    await click(buttonsWith("resetPassword")[0] as TestElement);
    await click(dialog().confirm);
    expect((container.textContent ?? "").includes("Temp-123")).toBe(true);
  });
});
