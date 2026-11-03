"use client";

import { lazy, useSyncExternalStore } from "react";

/**
 * The Plate editing field, in a chunk of its own that only edit mode loads,
 * so the public site never does. The one way into `rich/` from outside it.
 */
export const RichTextField = lazy(() => import("./rich/field"));

const subscribe = () => () => undefined;
const onClient = () => true;
const onServer = () => false;

/**
 * False on the server and while the page hydrates, true from then on. The
 * field needs a DOM to read its HTML and the admin editor renders on the
 * server first, so the field is drawn, and its chunk loaded, only once this
 * is true.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(subscribe, onClient, onServer);
}
