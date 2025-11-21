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
    const target = redirectTo ? decodeURIComponent(redirectTo) : "/admin";
    return redirect(target);
  }
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-primary-100 px-4 py-12">
      {/* Background decoration */}
      <div className="-z-10 absolute inset-0 overflow-hidden">
        <div className="-top-20 -right-20 absolute h-160 w-160 rounded-full bg-blue-accent/5 blur-3xl" />
        <div className="-left-20 absolute top-1/3 h-120 w-120 rounded-full bg-gold-default/5 blur-3xl" />
        <div className="absolute right-1/4 bottom-0 h-140 w-140 rounded-full bg-secondary-100/5 blur-3xl" />
      </div>
      {error && (
        <div className="-translate-x-1/2 -translate-y-1/2 absolute top-1/2 left-1/2 transform text-red-500">
          {error}
        </div>
      )}
      <Login />

      {/* Footer text */}
      <div className="absolute bottom-4 w-full text-center text-gray-400 text-xs">
        &copy; {new Date().getFullYear()} BISO. All rights reserved.
      </div>
    </div>
  );
}
