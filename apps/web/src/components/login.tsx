"use client";

import { ArrowRight, GraduationCap, Mail, Shield } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useId, useState } from "react";
import { readBiLoginFailure } from "@/lib/bi-login";
import { clearBrowserAppwriteSession } from "@/lib/bi-sign-in-client";
import { signInWithBiStudent, signInWithMagicLink } from "@/lib/server";
import { safeRedirectPath } from "@/lib/utils";

/**
 * The sign-in card: "Sign in with BI" first, a login link for everyone else.
 *
 * BI students sign in with their BI account (OIDC) — their membership and
 * member prices follow the student number on it. Alumni, partners and guests
 * use a login link. The Google, Facebook and Apple buttons are gone, as the
 * Branding Committee asked.
 *
 * `(auth)` renders outside `SiteShell`, so this card is the whole page. Three
 * things were wrong with it beyond styling, and stay fixed:
 *
 * 1. **Controls without an accessible name.** The old provider buttons were a
 *    bare `<svg>` each. Every control here carries visible text; icons are
 *    `aria-hidden` decoration beside it.
 * 2. **The logo flashed.** `useTheme()` behind a `mounted` flag meant every
 *    visitor got a pulsing grey rectangle before the logo resolved — on the
 *    first screen of the app. Two `<Image>`s and `dark:` do it with no flash.
 *    (Same fix as `app/unauthorized.tsx`.)
 * 3. **The privacy link left the site.** It pointed at the absolute
 *    production URL in a new tab, so from any other environment — localhost,
 *    a preview deploy — it navigated to production. It is the internal
 *    `/privacy` route.
 */

const primaryButtonClass =
  "type-label inline-flex w-full items-center justify-center gap-2 rounded-biso-pill bg-action px-5 py-3 text-action-ink transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:opacity-60";

const secondaryButtonClass =
  "type-label inline-flex w-full items-center justify-center gap-2 rounded-biso-pill border border-edge px-5 py-3 text-ink transition-colors hover:border-ink-accent hover:text-ink-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:opacity-60";

const inlineLinkClass =
  "text-ink-accent underline underline-offset-4 hover:no-underline focus-visible:rounded-biso-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

export function Login() {
  const t = useTranslations("common.auth");
  const emailId = useId();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);
  // Plain state, not a transition: a successful start never settles (the
  // browser leaves for BI), and the page can come back from the bfcache with
  // the button still "pending" unless `pageshow` resets it.
  const [isStartingBi, setIsStartingBi] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();

  // The BI failure leg lands here with Appwrite's error in the query string.
  // Show the explanation once, then clean the URL (keeping where the visitor
  // was headed) so a reload is quiet.
  useEffect(() => {
    const failure = readBiLoginFailure(searchParams);
    if (failure) {
      setMessage({ type: "error", text: t(`biFailure.${failure}`) });
      const redirectTo = searchParams.get("redirectTo");
      router.replace(
        redirectTo
          ? `/auth/login?redirectTo=${encodeURIComponent(safeRedirectPath(redirectTo))}`
          : "/auth/login",
        { scroll: false }
      );
    }
  }, [searchParams, router, t]);

  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        setIsStartingBi(false);
      }
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  // Handle the restrictedDomain parameter but immediately clear it
  useEffect(() => {
    if (searchParams.get("restrictedDomain")) {
      setMessage({ type: "error", text: t("restrictedDomain") });
      // Remove the parameter from URL
      router.replace("/auth/login", { scroll: false });
    }
  }, [searchParams, router, t]);

  /**
   * Clears any leftover browser-side Appwrite session first, so an abandoned
   * link attempt cannot attach this sign-in to someone else's account. On
   * success the server action redirects to BI and this never settles, so the
   * catch only ever sees a real failure — which is surfaced, never swallowed.
   */
  const handleBiLogin = async () => {
    setMessage(null);
    setIsStartingBi(true);
    try {
      await clearBrowserAppwriteSession();
      await signInWithBiStudent();
    } catch {
      setMessage({ type: "error", text: t("biFailure.failed") });
      setIsStartingBi(false);
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
      const result = await signInWithMagicLink(email);
      // Staff addresses are refused server-side: they sign in at
      // admin.biso.no, and a login link would lock them out of it.
      if (!result.ok) {
        setMessage({ type: "error", text: t("staffUseAdmin") });
        return;
      }
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

      <button
        aria-busy={isStartingBi}
        className={primaryButtonClass}
        disabled={isStartingBi}
        onClick={handleBiLogin}
        type="button"
      >
        <GraduationCap aria-hidden="true" className="size-4 shrink-0" />
        {isStartingBi ? t("biSignInPending") : t("biSignIn")}
        {isStartingBi ? null : (
          <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
        )}
      </button>
      <p className="type-body-sm mt-3 text-center text-ink-muted">
        {t("biSignInHint")}
      </p>

      <div className="my-6 flex items-center gap-4">
        <span aria-hidden="true" className="h-px flex-1 bg-edge" />
        <span className="type-label text-center text-ink-muted">
          {t("orUseLoginLink")}
        </span>
        <span aria-hidden="true" className="h-px flex-1 bg-edge" />
      </div>

      <form className="flex flex-col gap-5" onSubmit={handleUserLogin}>
        <div className="flex flex-col gap-2">
          <label
            className="type-body-sm flex items-center gap-2 font-semibold text-ink"
            htmlFor={emailId}
          >
            <Mail aria-hidden="true" className="size-4 text-ink-accent" />
            {t("emailLabel")}
          </label>
          <input
            autoComplete="email"
            className="type-body w-full rounded-biso-md border border-edge bg-surface px-4 py-3 text-ink placeholder:text-ink-muted focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-solid focus-visible:outline-offset-2"
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
          className={secondaryButtonClass}
          disabled={isLoading}
          type="submit"
        >
          {isLoading ? t("sending") : t("sendLink")}
          {isLoading ? null : (
            <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
          )}
        </button>
      </form>

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
          <Link className={inlineLinkClass} href="/privacy">
            {t("privacyPolicy")}
          </Link>{" "}
          {t("privacyNoticeAfter")}
        </p>
      </div>

      <div className="type-body-sm mt-6 text-center text-ink-muted">
        <p>{t("newHere")}</p>
        <Link
          className={`mt-1 inline-flex items-center gap-1 ${inlineLinkClass}`}
          href="/contact"
        >
          {t("needHelp")}
          <ArrowRight aria-hidden="true" className="size-3 shrink-0" />
        </Link>
      </div>
    </div>
  );
}
