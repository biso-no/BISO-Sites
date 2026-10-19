import Link from "next/link";

// Shown when the emailed app sign-in link opens in a browser instead of the
// BISO app. It never consumes the token: it only offers the custom-scheme
// link the app handles.
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    userId?: string | string[];
    secret?: string | string[];
  }>;
}) {
  const { userId, secret } = await searchParams;

  const appLink =
    typeof userId === "string" && userId && typeof secret === "string" && secret
      ? `biso://auth/verify?${new URLSearchParams({ userId, secret }).toString()}`
      : null;

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-[500px] w-[500px] rounded-full bg-brand-muted blur-3xl dark:bg-brand-muted" />
        <div className="absolute top-1/3 -left-40 h-[400px] w-[400px] rounded-full bg-brand-accent-muted blur-3xl dark:bg-brand-accent-muted" />
      </div>

      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-xl">
        <h1 className="mb-1 text-center font-bold text-2xl text-foreground">
          Open BISO to finish signing in
        </h1>
        <p className="mb-8 text-center text-muted-foreground">
          This sign-in link belongs to the BISO app. If the app did not open,
          open this email on the phone where BISO is installed.
        </p>

        {appLink && (
          <a
            className="mb-3 flex w-full items-center justify-center rounded-lg bg-linear-to-r from-brand-gradient-from to-brand-gradient-to py-3 font-medium text-white shadow-lg transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl"
            href={appLink}
          >
            Open the BISO app
          </a>
        )}

        <Link
          className="flex w-full items-center justify-center rounded-lg border border-border bg-secondary py-3 font-medium text-foreground transition-all duration-200 hover:bg-secondary/80"
          href="/auth/login"
        >
          Sign in on the website instead
        </Link>
      </div>
    </div>
  );
}
