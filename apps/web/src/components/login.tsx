"use client";

import { ArrowRight, GraduationCap, Mail, Shield } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { type BiLoginFailure, readBiLoginFailure } from "@/lib/bi-login";
import { clearBrowserAppwriteSession } from "@/lib/bi-sign-in-client";
import { signInWithBiStudent, signInWithMagicLink } from "@/lib/server";
import { safeRedirectPath } from "@/lib/utils";

/**
 * What the login page says when a BI sign-in comes back failed. The
 * existing-account case should not happen once Appwrite's OIDC provider uses
 * this project's userinfo endpoint (see `apps/api` `/api/auth/bi-userinfo`);
 * it means Appwrite refused to merge into the account holding the student's
 * bi.no email, so the copy keeps the student moving and asks them to report
 * it.
 */
const BI_LOGIN_FAILURE_TEXT: Record<BiLoginFailure, string> = {
  existing_account:
    "BI could not sign you into your existing BISO account. Use a login link to your student email below, and let us know at /contact so we can fix the sign-in.",
  failed:
    "We could not sign you in with BI. Please try again, or use a login link.",
};

export function Login() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [mounted, setMounted] = useState(false);
  // Plain state, not a transition: a successful start never settles (the
  // browser leaves for BI), and the page can come back from the bfcache with
  // the button still "pending" unless `pageshow` resets it.
  const [isStartingBi, setIsStartingBi] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  // The BI failure leg lands here with Appwrite's error in the query string.
  // Show the explanation once, then clean the URL (keeping where the visitor
  // was headed) so a reload is quiet.
  useEffect(() => {
    const failure = readBiLoginFailure(searchParams);
    if (failure) {
      setMessage({ type: "error", text: BI_LOGIN_FAILURE_TEXT[failure] });
      const redirectTo = searchParams.get("redirectTo");
      router.replace(
        redirectTo
          ? `/auth/login?redirectTo=${encodeURIComponent(safeRedirectPath(redirectTo))}`
          : "/auth/login",
        { scroll: false }
      );
    }
  }, [searchParams, router]);

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
      setMessage({
        type: "error",
        text: "Please use your personal email address.",
      });
      // Remove the parameter from URL
      router.replace("/auth/login", { scroll: false });
    }
  }, [searchParams, router]);

  const handleUserLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setMessage({ type: "error", text: "Please enter your email address." });
      return;
    }

    setIsLoading(true);
    try {
      const result = await signInWithMagicLink(email);
      if (!result.ok) {
        setMessage({
          type: "error",
          text: "BISO staff accounts sign in at admin.biso.no. Use your personal email address here.",
        });
        return;
      }
      setMessage({
        type: "success",
        text: "Login link sent! Please check your email.",
      });
    } catch (_error) {
      setMessage({
        type: "error",
        text: "Failed to send login link. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBiLogin = async () => {
    setIsStartingBi(true);
    try {
      await clearBrowserAppwriteSession();
      await signInWithBiStudent();
    } catch {
      setMessage({ type: "error", text: BI_LOGIN_FAILURE_TEXT.failed });
      setIsStartingBi(false);
    }
  };

  return (
    <div className="relative w-full max-w-md overflow-hidden rounded-2xl shadow-xl">
      {/* Background decoration */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-10 -right-10 h-120 w-120 rounded-full bg-blue-accent/5 blur-3xl" />
        <div className="absolute -bottom-20 -left-10 h-100 w-100 rounded-full bg-secondary-100/5 blur-3xl" />
      </div>

      <div className="rounded-2xl border border-border bg-card p-8 shadow-xl">
        {/* Logo Section */}
        <div className="mb-8 flex justify-center">
          {mounted ? (
            <Image
              alt="BISO Logo"
              className="h-12 w-auto"
              height={48}
              priority
              src={
                resolvedTheme === "dark"
                  ? "/images/logo-dark.png"
                  : "/images/logo-light.png"
              }
              width={160}
            />
          ) : (
            <div className="h-12 w-40 animate-pulse rounded bg-muted" />
          )}
        </div>

        <h1 className="mb-1 text-center font-bold text-2xl text-foreground">
          Welcome Back
        </h1>
        <p className="mb-8 text-center text-muted-foreground">
          Sign in to your BISO account
        </p>

        <button
          className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-lg bg-linear-to-r from-brand-gradient-from to-brand-gradient-to py-3 font-medium text-white shadow-lg transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl disabled:opacity-70"
          disabled={isStartingBi}
          onClick={handleBiLogin}
          type="button"
        >
          <GraduationCap className="h-5 w-5" />
          {isStartingBi
            ? "Taking you to BI…"
            : "Sign in with BI student account"}
          <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
        </button>
        <p className="mt-2 text-center text-muted-foreground text-xs">
          BI students: your student membership and member prices follow your BI
          account.
        </p>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-border border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">
              Not a BI student? Use a login link
            </span>
          </div>
        </div>

        <form className="space-y-6" onSubmit={handleUserLogin}>
          <div className="space-y-2">
            <label
              className="flex items-center gap-2 font-medium text-foreground text-sm"
              htmlFor="email"
            >
              <Mail className="h-4 w-4 text-brand" />
              Email Address
            </label>
            <div className="relative">
              <input
                className="w-full rounded-lg border border-input bg-background px-4 py-3 text-foreground transition-all duration-200 placeholder:text-muted-foreground focus:border-brand-border-strong focus:outline-none focus:ring-2 focus:ring-brand-border"
                id="email"
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                type="email"
                value={email}
              />
            </div>
          </div>

          <button
            className="group relative w-full overflow-hidden rounded-lg border border-border bg-secondary py-3 font-medium text-foreground transition-all duration-200 hover:bg-secondary/80"
            disabled={isLoading}
            type="submit"
          >
            {isLoading ? (
              <span className="flex items-center justify-center">
                <svg
                  className="mr-2 -ml-1 h-4 w-4 animate-spin text-foreground"
                  fill="none"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <title>Loading...</title>
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    fill="currentColor"
                  />
                </svg>
                Sending...
              </span>
            ) : (
              <span className="flex items-center justify-center">
                Send Login Link
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </span>
            )}
          </button>
        </form>

        {message && (
          <div
            className={`mt-6 rounded-lg p-4 ${message.type === "error" ? "border border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400" : "border border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400"}`}
            role={message.type === "error" ? "alert" : "status"}
          >
            <p className="flex items-start font-medium text-sm">
              <span
                className={`mr-2 rounded-full ${message.type === "error" ? "bg-red-500/30" : "bg-green-500/30"} p-0.5`}
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <title>
                    {message.type === "error" ? "Error" : "Success"}
                  </title>
                  {message.type === "error" ? (
                    <path
                      d="M6 18L18 6M6 6l12 12"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                    />
                  ) : (
                    <path
                      d="M5 13l4 4L19 7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                    />
                  )}
                </svg>
              </span>
              {message.text}
            </p>
          </div>
        )}
        {/* Staff sign in at admin.biso.no; the magic-link action refuses @biso.no. */}
        {/* Privacy Notice */}
        <div className="mt-6 rounded-lg border border-brand-border bg-brand-muted p-3">
          <div className="flex items-start">
            <Shield className="mt-0.5 mr-2 h-4 w-4 shrink-0 text-brand" />
            <p className="text-muted-foreground text-xs leading-relaxed">
              By signing in, you agree to our{" "}
              <a
                className="text-brand hover:underline"
                href="https://biso.no/privacy"
                rel="noopener noreferrer"
                target="_blank"
              >
                Privacy Policy
              </a>{" "}
              and consent to the processing of your personal data as described
              therein. We comply with GDPR regulations and you can manage your
              data preferences and request data deletion from your profile
              settings.
            </p>
          </div>
        </div>

        <div className="mt-6 text-center text-muted-foreground text-xs">
          <p>
            New here? Signing in with BI or a login link creates your account.
          </p>
          <Link
            className="inline-flex items-center text-brand hover:underline"
            href="/contact"
          >
            Need help signing in?
            <ArrowRight className="ml-1 h-3 w-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}
