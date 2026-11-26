import { mock } from "bun:test";
import { loadMessages } from "@repo/i18n/messages";
import { IntlMessageFormat } from "intl-messageformat";
import { act, createElement, type FunctionComponent } from "react";
import type { Root } from "react-dom/client";
import { installReactDom, type TestElement } from "@/test/react-dom-harness";

/**
 * What the Messages tab's component tests share. Import it, call
 * `installMocks()`, then load the components with `await import`, so the
 * stand-ins are in place first. `mock.module` is process-wide: shared
 * modules keep their other exports.
 */

// Real English messages through the ICU formatter next-intl uses, so a
// missing key or a broken plural fails the test.
const messages = await loadMessages("en");

export function translator(namespace: string) {
  return (key: string, values: Record<string, string | number> = {}) => {
    const path = [...namespace.split("."), ...key.split(".")];
    let node: unknown = messages;
    for (const part of path) {
      node = (node as Record<string, unknown> | undefined)?.[part];
    }
    if (typeof node !== "string") {
      throw new Error(`Missing message: ${path.join(".")}`);
    }
    return String(new IntlMessageFormat(node, "en").format(values));
  };
}

export const toast = {
  error: mock((_message: string) => undefined),
  info: mock((_message: string) => undefined),
  success: mock((_message: string) => undefined),
  warning: mock((_message: string) => undefined),
};
const actualNavigation = await import("next/navigation");
const actualSonner = await import("sonner");
const actualIntl = await import("next-intl");

/**
 * Puts the stand-ins in place. Every test file calls it before importing
 * components: another suite may have swapped these modules for its own
 * since this module was first loaded.
 */
export function installMocks(): void {
  mock.module("server-only", () => ({}));
  mock.module("@repo/api/server", () => ({
    createAdminClient: mock(async () => ({ db: {}, messaging: {}, users: {} })),
  }));
  mock.module("@/lib/authorization", () => ({
    requireAuth: mock(async () => ({})),
  }));
  mock.module("next/cache", () => ({
    revalidatePath: mock(() => undefined),
    revalidateTag: mock(() => undefined),
    unstable_cache: (fn: unknown) => fn,
  }));
  mock.module("next/navigation", () => ({
    ...actualNavigation,
    useRouter: () => ({ refresh: mock(() => undefined) }),
  }));
  mock.module("sonner", () => ({ ...actualSonner, toast }));
  mock.module("next-intl", () => ({
    ...actualIntl,
    useLocale: () => "en",
    useTranslations: translator,
  }));
}

installMocks();

/** The message actions, on their module so the components see stand-ins. */
export const messageActions = await import(
  "../../../../_actions/big-event-messages"
);

export function resetToasts(): void {
  for (const fn of Object.values(toast)) {
    fn.mockClear();
  }
}

/** One mounted component at a time, unmounted by `unmount`. */
export function createMounter() {
  const dom = installReactDom();
  let root: Root | null = null;
  return {
    async mount<P extends object>(
      component: FunctionComponent<P>,
      props: P
    ): Promise<TestElement> {
      const { createRoot } = await import("react-dom/client");
      const container = dom.document.createElement("div");
      dom.document.body.appendChild(container);
      root = createRoot(container as unknown as Element);
      await act(async () => {
        root?.render(createElement(component, props));
        await Promise.resolve();
      });
      return container as unknown as TestElement;
    },
    restore(): void {
      dom.restore();
    },
    async unmount(): Promise<void> {
      if (root) {
        await act(async () => root?.unmount());
      }
      root = null;
      dom.document.body.textContent = "";
    },
  };
}

/** Lets pending promises and state updates settle. */
export async function settle(ms = 0): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
}

export async function click(element: TestElement): Promise<void> {
  await act(async () => {
    element.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

export async function type(element: TestElement, text: string): Promise<void> {
  await act(() => {
    element.value = text;
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
