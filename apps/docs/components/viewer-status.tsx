"use client";

import { useEffect, useState } from "react";

export interface ViewerInfo {
  canSeePrivate: boolean;
  name?: string;
  signedIn: boolean;
}

const TRAILING_SLASHES = /\/+$/;
const WHITESPACE = /\s+/;

const LINK_CLASS =
  "rounded-md px-2 py-1 text-[13px] text-paper underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-paper focus-visible:outline-offset-2 md:text-sm";

function firstName(name: string | undefined): string {
  return name?.trim().split(WHITESPACE)[0] ?? "";
}

/** The pure view: no fetching, so each state can be rendered on its own. */
export function ViewerStatusView({
  adminUrl,
  currentUrl,
  viewer,
}: {
  adminUrl: string | undefined;
  currentUrl: string;
  viewer: ViewerInfo | null;
}) {
  if (!(adminUrl && viewer)) {
    return null;
  }

  if (!viewer.signedIn) {
    const href = `${adminUrl.replace(TRAILING_SLASHES, "")}/auth/login?redirectTo=${encodeURIComponent(currentUrl)}`;
    return (
      <a className={LINK_CLASS} href={href}>
        Sign in
      </a>
    );
  }

  const name = firstName(viewer.name);
  return (
    <span className="flex items-center gap-2 px-2 text-[13px] text-paper md:text-sm">
      {name ? <span>{name}</span> : null}
      {viewer.canSeePrivate ? (
        <span className="rounded border border-paper px-1.5 py-0.5 text-[11px] leading-none">
          Private details on
        </span>
      ) : null}
    </span>
  );
}

/** Shows who is signed in, or a sign-in link. Renders nothing until known. */
export function ViewerStatus() {
  const [viewer, setViewer] = useState<ViewerInfo | null>(null);
  const [currentUrl, setCurrentUrl] = useState("");
  const adminUrl = process.env.NEXT_PUBLIC_ADMIN_URL;

  useEffect(() => {
    if (!adminUrl) {
      return;
    }
    const controller = new AbortController();
    setCurrentUrl(window.location.href);
    fetch("/api/viewer", { cache: "no-store", signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: ViewerInfo | null) => setViewer(data))
      .catch(() => setViewer(null));
    return () => controller.abort();
  }, [adminUrl]);

  return (
    <ViewerStatusView
      adminUrl={adminUrl}
      currentUrl={currentUrl}
      viewer={viewer}
    />
  );
}
