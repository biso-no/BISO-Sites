import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Login } from "@/components/login";
import { getAuthStatus } from "@/lib/auth-utils";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string; error?: string }>;
}) {
  const t = await getTranslations("admin.auth");
  const authStatus = await getAuthStatus();
  const { error, redirectTo } = await searchParams;
  if (authStatus.isAuthenticated) {
    // User is already authenticated, redirect them
    const target = redirectTo ? decodeURIComponent(redirectTo) : "/";
    return redirect(target);
  }
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-primary-100 px-4 py-12">
      {/* Background decoration */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-20 -right-20 h-160 w-160 rounded-full bg-blue-accent/5 blur-3xl" />
        <div className="absolute top-1/3 -left-20 h-120 w-120 rounded-full bg-gold-default/5 blur-3xl" />
        <div className="absolute right-1/4 bottom-0 h-140 w-140 rounded-full bg-secondary-100/5 blur-3xl" />
      </div>
      {error && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transform text-red-500">
          {error}
        </div>
      )}
      <Login />

      <div className="absolute bottom-4 w-full text-center text-gray-400 text-xs">
        &copy; {new Date().getFullYear()} BISO. {t("copyright")}
      </div>
    </div>
  );
}
