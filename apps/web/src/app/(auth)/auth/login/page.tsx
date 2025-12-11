import { redirect } from "next/navigation";
import { Login } from "@/components/login";
import { getAuthStatus } from "@/lib/auth-utils";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string; error?: string }>;
}) {
  // Check if user is already authenticated (not anonymous)
  const authStatus = await getAuthStatus();
  const { error, redirectTo } = await searchParams;
  if (authStatus.isAuthenticated) {
    // User is already authenticated, redirect them
    const target = redirectTo ? decodeURIComponent(redirectTo) : "/";
    return redirect(target);
  }
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4 py-12">
      {/* Background decoration - subtle gradients */}
      <div className="-z-10 absolute inset-0 overflow-hidden">
        <div className="-top-40 -right-40 absolute h-[500px] w-[500px] rounded-full bg-brand-muted blur-3xl dark:bg-brand-muted" />
        <div className="-left-40 absolute top-1/3 h-[400px] w-[400px] rounded-full bg-brand-accent-muted blur-3xl dark:bg-brand-accent-muted" />
        <div className="absolute right-1/4 bottom-0 h-[450px] w-[450px] rounded-full bg-brand-muted blur-3xl dark:bg-brand-muted" />
      </div>

      {error && (
        <div className="-translate-x-1/2 absolute top-8 left-1/2 transform rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-red-600 dark:text-red-400">
          {error}
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
