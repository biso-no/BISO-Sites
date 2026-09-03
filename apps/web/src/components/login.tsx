"use client";

import { ArrowRight, Mail, Shield } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useId, useState } from "react";
import {
  signInWithApple,
  signInWithFacebook,
  signInWithGoogle,
  signInWithMagicLink,
} from "@/lib/server";

/**
 * The magic-link form and the three OAuth providers.
 *
 * `(auth)` renders outside `SiteShell`, so this card is the whole page. Three
 * things were wrong with it beyond styling:
 *
 * 1. **The three provider buttons had no accessible name.** Each contained a
 *    bare `<svg>` and nothing else, so a screen reader announced three
 *    unlabelled buttons. They carry `aria-label` now, and the logos are
 *    `aria-hidden` decoration beside it.
 * 2. **The logo flashed.** `useTheme()` behind a `mounted` flag meant every
 *    visitor got a pulsing grey rectangle before the logo resolved — on the
 *    first screen of the app. Two `<Image>`s and `dark:` do it with no flash.
 *    (Same fix as `app/unauthorized.tsx`.)
 * 3. **The privacy link left the site.** It pointed at the absolute
 *    `https://biso.no/privacy` with `target="_blank"`, so from any other
 *    environment — localhost, a preview deploy — it navigated to production.
 *    It is the internal `/privacy` route.
 */

const PROVIDERS = [
  { key: "google", label: "Google", onClick: signInWithGoogle },
  { key: "facebook", label: "Facebook", onClick: signInWithFacebook },
  { key: "apple", label: "Apple", onClick: signInWithApple },
] as const;

const providerButtonClass =
  "flex items-center justify-center rounded-biso-md border border-edge py-3 text-ink transition-colors hover:border-ink-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

function ProviderMark({ provider }: { provider: string }) {
  if (provider === "google") {
    return (
      <svg aria-hidden="true" className="size-5" viewBox="0 0 24 24">
        <path
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          fill="#4285F4"
        />
        <path
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          fill="#34A853"
        />
        <path
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          fill="#FBBC05"
        />
        <path
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          fill="#EA4335"
        />
      </svg>
    );
  }
  if (provider === "facebook") {
    return (
      <svg
        aria-hidden="true"
        className="size-5"
        fill="#1877F2"
        viewBox="0 0 24 24"
      >
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    );
  }
  return (
    <svg
      aria-hidden="true"
      className="size-5 text-ink"
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
    </svg>
  );
}

export function Login() {
  const t = useTranslations("common.auth");
  const emailId = useId();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();

  // Handle the restrictedDomain parameter but immediately clear it
  useEffect(() => {
    if (searchParams.get("restrictedDomain")) {
      setMessage({ type: "error", text: t("restrictedDomain") });
      // Remove the parameter from URL
      router.replace("/auth/login", { scroll: false });
    }
  }, [searchParams, router, t]);

  /**
   * On success the server action redirects and this promise never resolves, so
   * the catch only ever sees a real failure. It previously had none: when
   * `createOAuth2Token` throws — which **Facebook does today**, with Appwrite
   * answering `Invalid redirect` while Google and Apple succeed from the same
   * origin with the same URLs — the click did nothing at all, silently.
   */
  const handleProviderLogin = async (start: () => Promise<void>) => {
    setMessage(null);
    try {
      await start();
    } catch (_error) {
      setMessage({ type: "error", text: t("signInFailed") });
    }
  };

  const handleUserLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setMessage({ type: "error", text: t("emailRequired") });
      return;
    }

    setIsLoading(true);
    try {
      await signInWithMagicLink(email);
      setMessage({ type: "success", text: t("magicLinkSent") });
    } catch (_error) {
      setMessage({ type: "error", text: t("magicLinkFailed") });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md rounded-biso-lg border border-edge bg-surface p-8">
      <div className="mb-8 flex justify-center">
        <Image
          alt="BISO"
          className="h-12 w-auto dark:hidden"
          height={48}
          priority
          src="/images/logo-light.png"
          width={160}
        />
        <Image
          alt="BISO"
          className="hidden h-12 w-auto dark:block"
          height={48}
          priority
          src="/images/logo-dark.png"
          width={160}
        />
      </div>

      <h1 className="type-display-sm break-words text-center text-ink">
        {t("welcomeBack")}
      </h1>
      <p className="type-body mt-2 mb-8 text-center text-ink-muted">
        {t("signInSubtitle")}
      </p>

      <form className="flex flex-col gap-5" onSubmit={handleUserLogin}>
        <div className="flex flex-col gap-2">
          <label
            className="type-body-sm flex items-center gap-2 font-medium text-ink"
            htmlFor={emailId}
          >
            <Mail aria-hidden="true" className="size-4 text-ink-accent" />
            {t("emailLabel")}
          </label>
          <input
            autoComplete="email"
            className="type-body w-full rounded-biso-md border border-edge bg-surface px-4 py-3 text-ink placeholder:text-ink-muted focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2"
            id={emailId}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("emailPlaceholder")}
            required
            type="email"
            value={email}
          />
        </div>

        <button
          aria-busy={isLoading}
          className="type-label inline-flex w-full items-center justify-center gap-2 rounded-biso-pill bg-action px-5 py-3 text-action-ink transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:opacity-60"
          disabled={isLoading}
          type="submit"
        >
          {isLoading ? t("sending") : t("sendLink")}
          {isLoading ? null : (
            <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
          )}
        </button>
      </form>

      <div className="my-6 flex items-center gap-4">
        <span aria-hidden="true" className="h-px flex-1 bg-edge" />
        <span className="type-label text-ink-muted">{t("orContinueWith")}</span>
        <span aria-hidden="true" className="h-px flex-1 bg-edge" />
      </div>

      <div className="grid grid-cols-3 gap-3">
        {PROVIDERS.map((provider) => (
          <button
            aria-label={t("continueWith", { provider: provider.label })}
            className={providerButtonClass}
            key={provider.key}
            onClick={() => handleProviderLogin(provider.onClick)}
            type="button"
          >
            <ProviderMark provider={provider.key} />
          </button>
        ))}
      </div>

      {message ? (
        <p
          className={`type-body-sm mt-6 rounded-biso-md border p-4 ${
            message.type === "error"
              ? "border-danger/40 bg-danger/5 text-danger"
              : "border-success/40 bg-success/5 text-success"
          }`}
          role={message.type === "error" ? "alert" : "status"}
        >
          {message.text}
        </p>
      ) : null}

      <div className="mt-6 flex items-start gap-2 rounded-biso-md border border-edge bg-surface-sunken p-4">
        <Shield
          aria-hidden="true"
          className="mt-0.5 size-4 shrink-0 text-ink-accent"
        />
        <p className="type-body-sm text-ink-muted">
          {t("privacyNoticeBefore")}{" "}
          <Link
            className="text-ink-accent underline underline-offset-4 hover:no-underline focus-visible:rounded-biso-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            href="/privacy"
          >
            {t("privacyPolicy")}
          </Link>{" "}
          {t("privacyNoticeAfter")}
        </p>
      </div>

      <p className="type-body-sm mt-6 text-center text-ink-muted">
        {t("noAccount")}{" "}
        <Link
          className="inline-flex items-center gap-1 text-ink-accent underline underline-offset-4 hover:no-underline focus-visible:rounded-biso-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          href="/contact"
        >
          {t("contactForAccess")}
          <ArrowRight aria-hidden="true" className="size-3 shrink-0" />
        </Link>
      </p>
    </div>
  );
}
