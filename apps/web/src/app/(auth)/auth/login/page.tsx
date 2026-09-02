import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Login } from "@/components/login";
import { getAuthStatus } from "@/lib/auth-utils";
import { safeRedirectPath } from "@/lib/utils";

// Only the error codes the auth callback handlers actually emit get a
// banner. Anything else (or arbitrary attacker-supplied strings via
// ?error=…) is ignored — React already escapes the value, but accepting
// only known codes prevents attackers from controlling the on-screen
// copy of the page.
const LOGIN_ERROR_CODES = [
  "invalid_parameters",
  "invitation_failed",
  "server_configuration",
  "unexpected_error",
] as const;

type LoginErrorCode = (typeof LOGIN_ERROR_CODES)[number];

function isKnownErrorCode(value: string | undefined): value is LoginErrorCode {
  return Boolean(value) && LOGIN_ERROR_CODES.includes(value as LoginErrorCode);
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("common.auth");
  return {
    title: `${t("welcomeBack")} | BISO`,
    description: t("signInSubtitle"),
  };
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; redirectTo?: string }>;
}) {
  const [authStatus, { error, redirectTo }, t] = await Promise.all([
    getAuthStatus(),
    searchParams,
    getTranslations("common.auth"),
  ]);

  if (authStatus.isAuthenticated) {
    return redirect(safeRedirectPath(redirectTo));
  }

  const errorMessage = isKnownErrorCode(error)
    ? t(`errors.${error}`)
    : undefined;

  return (
    // No `<Section>`: `(auth)` renders outside `SiteShell`, so there is no nav
    // to clear and no page rhythm to join. The card is the page.
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-surface px-4 py-12">
      {/* In flow above the card, not `absolute` over it — at 320px the old
          fixed-position banner sat on top of the logo. `role="alert"` so it is
          announced when a failed callback lands here. */}
      {errorMessage ? (
        <p
          className="type-body-sm w-full max-w-md rounded-biso-md border border-danger/40 bg-danger/5 p-4 text-danger"
          role="alert"
        >
          {errorMessage}
        </p>
      ) : null}

      <Login />

      <p className="type-body-sm text-ink-muted">
        © {new Date().getFullYear()} BISO. {t("copyright")}
      </p>
    </div>
  );
}
