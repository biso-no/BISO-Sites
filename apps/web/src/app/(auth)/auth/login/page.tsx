import { redirect } from "next/navigation";
import { Login } from "@/components/login";
import { getAuthStatus } from "@/lib/auth-utils";
import { safeRedirectPath } from "@/lib/utils";

// Only the error codes the auth callback handlers actually emit get a
// banner. Anything else (or arbitrary attacker-supplied strings via
// ?error=…) is ignored — React already escapes the value, but accepting
// only known codes prevents attackers from controlling the on-screen
// copy of the page.
const LOGIN_ERROR_MESSAGES: Record<string, string> = {
  invalid_parameters: "The login link is missing required information.",
  invitation_failed: "We couldn't accept that invitation. Please try again.",
  server_configuration:
    "Login is temporarily unavailable. Please try again later.",
  unexpected_error: "Something went wrong while signing you in.",
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string; error?: string }>;
}) {
  const authStatus = await getAuthStatus();
  const { error, redirectTo } = await searchParams;
  if (authStatus.isAuthenticated) {
    return redirect(safeRedirectPath(redirectTo));
  }

  const errorMessage = error ? LOGIN_ERROR_MESSAGES[error] : undefined;

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4 py-12">
      {/* Background decoration - subtle gradients */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-[500px] w-[500px] rounded-full bg-brand-muted blur-3xl dark:bg-brand-muted" />
        <div className="absolute top-1/3 -left-40 h-[400px] w-[400px] rounded-full bg-brand-accent-muted blur-3xl dark:bg-brand-accent-muted" />
        <div className="absolute right-1/4 bottom-0 h-[450px] w-[450px] rounded-full bg-brand-muted blur-3xl dark:bg-brand-muted" />
      </div>

      {errorMessage && (
        <div className="absolute top-8 left-1/2 -translate-x-1/2 transform rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-red-600 dark:text-red-400">
          {errorMessage}
        </div>
      )}

      <Login />

      {/* Footer text */}
      <div className="absolute bottom-4 w-full text-center text-muted-foreground text-xs">
        &copy; {new Date().getFullYear()} BISO. All rights reserved.
      </div>
    </div>
  );
}
