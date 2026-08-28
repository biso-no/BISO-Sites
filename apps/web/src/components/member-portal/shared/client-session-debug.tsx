"use client";

import { clientAccount } from "@repo/api/client";
import { Button } from "@repo/ui/components/ui/button";
import { useCallback, useEffect, useState } from "react";
import { ensureClientAppwriteSession } from "@/lib/account-link-client";

/**
 * Dev-only readout of what the *browser's* Appwrite client sees.
 *
 * The server knows who you are — it holds the session secret in
 * `a_session_biso_web`. The question this answers is the different one that
 * decides whether an OAuth redirect links or signs up: does `clientAccount`
 * have a session Appwrite will honour on a plain top-level navigation?
 *
 * Three signals, in the order they fail:
 *
 * 1. `account.get()` — whether the browser has any session at all. A 401 here
 *    before bootstrapping is expected; a 401 *after* bootstrapping means
 *    `createSession` did not stick.
 * 2. `localStorage.cookieFallback` — the decisive one. Appwrite sets this when
 *    it detects its `Set-Cookie` will not be stored (a cross-site XHR whose
 *    third-party cookie the browser blocked) and hands the SDK a replacement
 *    it can send as the `X-Fallback-Cookies` *header*. XHRs then work, which
 *    is why `account.get()` can succeed while linking still fails — a header
 *    cannot ride along on `window.location.href = …`. If this is present, the
 *    OAuth navigation is anonymous and Appwrite will create a new user, no
 *    matter what the rest of the panel says.
 * 3. Bootstrap on demand — runs `ensureClientAppwriteSession()` in isolation,
 *    without the redirect, so the session step can be observed on its own.
 *
 * Renders nothing in production.
 */

interface Probe {
  cookieFallback: boolean;
  error: string | null;
  name: string | null;
  userId: string | null;
}

const IS_DEV = process.env.NODE_ENV !== "production";

function readCookieFallback(): boolean {
  try {
    return Boolean(window.localStorage.getItem("cookieFallback"));
  } catch {
    return false;
  }
}

export function ClientSessionDebug() {
  const [probe, setProbe] = useState<Probe | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const user = await clientAccount.get();
      setProbe({
        cookieFallback: readCookieFallback(),
        error: null,
        name: user.name || "(no name set)",
        userId: user.$id,
      });
    } catch (error) {
      setProbe({
        cookieFallback: readCookieFallback(),
        error: error instanceof Error ? error.message : String(error),
        name: null,
        userId: null,
      });
    }
  }, []);

  useEffect(() => {
    if (!IS_DEV) {
      return;
    }
    refresh().catch(() => {
      // refresh already captures failures into state.
    });
  }, [refresh]);

  const bootstrap = useCallback(async () => {
    setBusy(true);
    try {
      await ensureClientAppwriteSession();
    } catch (error) {
      setProbe({
        cookieFallback: readCookieFallback(),
        error: `bootstrap failed: ${error instanceof Error ? error.message : String(error)}`,
        name: null,
        userId: null,
      });
      setBusy(false);
      return;
    }
    await refresh();
    setBusy(false);
  }, [refresh]);

  if (!IS_DEV) {
    return null;
  }

  return (
    <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-left font-mono text-xs">
      <div className="mb-2 font-semibold text-amber-700 dark:text-amber-400">
        client-side session probe (dev only)
      </div>

      {probe === null ? (
        <div>checking…</div>
      ) : (
        <dl className="space-y-1">
          <div>
            <dt className="inline font-semibold">clientAccount.get(): </dt>
            <dd className="inline">
              {probe.name === null ? (
                <span className="text-red-600 dark:text-red-400">
                  no session — {probe.error}
                </span>
              ) : (
                <span className="text-green-700 dark:text-green-400">
                  {probe.name} · {probe.userId}
                </span>
              )}
            </dd>
          </div>
          <div>
            <dt className="inline font-semibold">cookieFallback: </dt>
            <dd className="inline">
              {probe.cookieFallback ? (
                <span className="text-red-600 dark:text-red-400">
                  present — real cookie blocked, OAuth link WILL create a new
                  user
                </span>
              ) : (
                <span className="text-green-700 dark:text-green-400">
                  absent — a real cookie is in play
                </span>
              )}
            </dd>
          </div>
        </dl>
      )}

      <div className="mt-3 flex gap-2">
        <Button
          disabled={busy}
          onClick={() => {
            bootstrap().catch(() => {
              // bootstrap already captures failures into state.
            });
          }}
          size="sm"
          type="button"
          variant="outline"
        >
          {busy ? "working…" : "Bootstrap client session"}
        </Button>
        <Button
          disabled={busy}
          onClick={() => {
            refresh().catch(() => {
              // refresh already captures failures into state.
            });
          }}
          size="sm"
          type="button"
          variant="outline"
        >
          Re-check
        </Button>
      </div>
    </div>
  );
}
