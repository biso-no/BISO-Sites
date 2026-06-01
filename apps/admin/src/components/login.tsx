"use client";

import { Key, ShieldCheck } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { signInWithAzure } from "@/lib/server";
import {
  MONO_STACK,
  SERIF_STACK,
  STUDIO,
  buttonStyle,
} from "@/app/(portal)/_components/studio";

export function Login() {
  const t = useTranslations("admin.auth");
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const handleSignIn = () => {
    const redirectTo = searchParams.get("redirectTo") ?? undefined;
    startTransition(async () => {
      await signInWithAzure(redirectTo);
    });
  };

  return (
    <div className="flex w-full max-w-sm flex-col gap-8">
      {/* Heading */}
      <div className="space-y-1">
        <h1
          className="text-4xl leading-tight"
          style={{
            color: STUDIO.ink,
            fontFamily: SERIF_STACK,
            fontWeight: 400,
          }}
        >
          {t("welcomeBack")}
        </h1>
        <p className="text-sm leading-6" style={{ color: STUDIO.ink3 }}>
          {t("signInSubtitle")}
        </p>
      </div>

      {/* Sign-in button */}
      <div className="space-y-4">
        <button
          className="inline-flex w-full items-center justify-center gap-2.5 rounded-xl px-5 py-3.5 font-medium text-sm transition hover:opacity-90 active:scale-[0.99]"
          disabled={isPending}
          onClick={handleSignIn}
          style={buttonStyle("primary")}
          type="button"
        >
          {isPending ? (
            <>
              <svg
                aria-hidden="true"
                className="h-4 w-4 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
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
              <span>Signing in…</span>
            </>
          ) : (
            <>
              <Key className="h-4 w-4" />
              {t("signInWithBISO")}
            </>
          )}
        </button>

        <p
          className="text-center text-xs"
          style={{ color: STUDIO.ink4, fontFamily: MONO_STACK }}
        >
          {t("noAccount")}{" "}
          <a
            className="underline-offset-2 hover:underline"
            href="https://biso.no/contact"
            rel="noopener noreferrer"
            style={{ color: STUDIO.claret }}
          >
            {t("contactForAccess")}
          </a>
        </p>
      </div>

      {/* Privacy notice */}
      <div
        className="flex items-start gap-2.5 rounded-xl p-4 text-xs leading-relaxed"
        style={{
          background: "rgba(176,138,62,0.06)",
          border: "0.5px solid rgba(176,138,62,0.2)",
          color: STUDIO.ink3,
        }}
      >
        <ShieldCheck
          className="mt-0.5 shrink-0"
          size={14}
          style={{ color: STUDIO.gold }}
        />
        <p>
          {t("privacyNoticeBefore")}{" "}
          <a
            className="underline-offset-2 hover:underline"
            href="https://biso.no/privacy"
            rel="noopener noreferrer"
            style={{ color: STUDIO.claret }}
          >
            {t("privacyPolicy")}
          </a>{" "}
          {t("privacyNoticeAfter")}
        </p>
      </div>
    </div>
  );
}
