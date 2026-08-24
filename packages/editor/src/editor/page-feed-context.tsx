"use client";

import { createContext, type ReactNode, useContext, useMemo } from "react";
import { useEditorStore } from "./store";
import type { EditorLocale } from "./types";

export interface PageFeedSource {
  /** Department id the auto-source blocks resolve their feed from. */
  department: string;
  /** Language those feeds are requested in. */
  locale: EditorLocale;
}

const PageFeedContext = createContext<PageFeedSource | null>(null);

/**
 * Request-scoped feed source for a rendered page.
 *
 * Auto-source blocks (events/jobs/news/partners) used to read the department
 * and locale straight from the shared editor store. That works in the editor,
 * where everything is client-side, but not for server rendering: zustand's
 * `useStore` passes `api.getInitialState` as the `useSyncExternalStore` server
 * snapshot, so a host that seeds the singleton with `setState` during render
 * is invisible to SSR. The server would render every auto-source block against
 * the store defaults while the client rendered it against the real page — a
 * server/client divergence on exactly the blocks this whole area is about.
 *
 * A provider makes the values part of the React tree, so both passes agree.
 * The editor deliberately does not mount one: `usePageFeedSource` falls back to
 * the store there, which is what keeps the canvas live as the author edits the
 * page's department on the Page tab.
 */
export function PageFeedProvider({
  children,
  department,
  locale,
}: PageFeedSource & { children: ReactNode }) {
  const value = useMemo(() => ({ department, locale }), [department, locale]);
  return (
    <PageFeedContext.Provider value={value}>
      {children}
    </PageFeedContext.Provider>
  );
}

/**
 * The department and locale an auto-source block should fetch with: the
 * surrounding provider when a host supplies one (public site), otherwise the
 * live editor store (admin canvas).
 */
export function usePageFeedSource(): PageFeedSource {
  const provided = useContext(PageFeedContext);
  const storeDepartment = useEditorStore((s) => s.doc.meta.department);
  const storeLocale = useEditorStore((s) => s.locale);
  return provided ?? { department: storeDepartment, locale: storeLocale };
}
