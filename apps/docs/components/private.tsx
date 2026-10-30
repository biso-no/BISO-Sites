"use client";

import { useEffect, useRef, useState } from "react";
import { signInHref } from "@/lib/auth/sign-in-link";
import { type PrivateResult, requestPrivate } from "@/lib/private/batcher";
import type { PrivateName } from "@/lib/private/registry";

export const PRIVATE_MESSAGES = {
  "signed-out": "Sign in with your BISO admin account to see this.",
  forbidden: "Your account doesn't have access to this.",
  unavailable: "This couldn't be loaded right now. Try again later.",
} as const;

const LINK_CLASS =
  "ml-1 rounded-sm font-medium text-fd-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-fd-ring focus-visible:outline-offset-2";

const BUTTON_CLASS =
  "ml-2 rounded-sm border border-fd-border px-1.5 py-0.5 align-baseline text-[11px] text-fd-muted-foreground leading-none hover:text-fd-foreground focus-visible:outline-2 focus-visible:outline-fd-ring focus-visible:outline-offset-2";

interface PrivateViewProps {
  adminUrl?: string;
  currentUrl?: string;
  label?: string;
  /** `null` while loading, and in the server-rendered HTML. */
  result: PrivateResult | null;
}

/** The pure view: no fetching, so each state can be rendered on its own. */
export function PrivateView({
  adminUrl,
  currentUrl = "",
  label,
  result,
}: PrivateViewProps) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    },
    []
  );

  if (result === null) {
    return (
      <span aria-busy="true" className="inline-block align-baseline">
        <span className="inline-block h-[1em] w-24 animate-pulse rounded-sm bg-fd-muted align-text-bottom" />
        <span className="sr-only">Loading</span>
      </span>
    );
  }

  if (result.state !== "ok") {
    return (
      <span className="text-fd-muted-foreground">
        {PRIVATE_MESSAGES[result.state]}
        {result.state === "signed-out" && adminUrl ? (
          <a className={LINK_CLASS} href={signInHref(adminUrl, currentUrl)}>
            Sign in
          </a>
        ) : null}
      </span>
    );
  }

  const { value } = result;
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      if (timer.current) {
        clearTimeout(timer.current);
      }
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Copying is a convenience; the value stays selectable.
    }
  }

  return (
    <span>
      <span className="whitespace-pre-wrap break-words rounded-sm bg-fd-muted px-1.5 py-0.5 text-fd-foreground">
        {value}
      </span>
      <button
        aria-label={`Copy ${label ?? "value"}`}
        className={BUTTON_CLASS}
        onClick={copy}
        type="button"
      >
        {copied ? "Copied" : "Copy"}
      </button>
      <span aria-live="polite" className="sr-only">
        {copied ? "Copied" : ""}
      </span>
    </span>
  );
}

/**
 * A value that only signed-in BISO staff with access can see. The static page
 * holds only a placeholder; the value comes from `/api/private`, batched with
 * every other `<Private>` on the page.
 */
export function Private({
  name,
  label,
}: {
  name: PrivateName;
  label?: string;
}) {
  const [result, setResult] = useState<PrivateResult | null>(null);
  const [currentUrl, setCurrentUrl] = useState("");

  useEffect(() => {
    let active = true;
    setCurrentUrl(window.location.href);
    requestPrivate(name)
      .then((next) => {
        if (active) {
          setResult(next);
        }
      })
      .catch(() => {
        if (active) {
          setResult({ state: "unavailable" });
        }
      });
    return () => {
      active = false;
    };
  }, [name]);

  return (
    <PrivateView
      adminUrl={process.env.NEXT_PUBLIC_ADMIN_URL}
      currentUrl={currentUrl}
      label={label}
      result={result}
    />
  );
}
