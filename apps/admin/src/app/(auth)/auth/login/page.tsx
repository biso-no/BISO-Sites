import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import {
  MONO_STACK,
  SERIF_STACK,
  STUDIO,
} from "@/app/(portal)/_components/studio";
import { Login } from "@/components/login";
import { getAuthStatus } from "@/lib/auth-utils";
import { sanitizeRedirectTarget } from "@/lib/utils";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string; error?: string }>;
}) {
  const t = await getTranslations("admin.auth");
  const authStatus = await getAuthStatus();
  const { error, redirectTo } = await searchParams;

  if (authStatus.isAuthenticated) {
    return redirect(sanitizeRedirectTarget(redirectTo));
  }

  return (
    <div className="flex min-h-screen" style={{ background: STUDIO.paper }}>
      {/* ─── Left branding panel (desktop only) ─────────────────────────── */}
      <div
        className="relative hidden w-[45%] flex-col justify-between overflow-hidden p-12 lg:flex"
        style={{
          background: `linear-gradient(160deg, ${STUDIO.paper2} 0%, ${STUDIO.paper3} 100%)`,
          borderRight: `0.5px solid ${STUDIO.rule}`,
        }}
      >
        {/* Subtle grid texture */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: `linear-gradient(${STUDIO.rule} 1px, transparent 1px), linear-gradient(90deg, ${STUDIO.rule} 1px, transparent 1px)`,
            backgroundSize: "48px 48px",
            opacity: 0.35,
          }}
        />

        {/* Brand mark */}
        <div className="relative flex items-center gap-3">
          <span
            className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-xl"
            style={{
              background: STUDIO.ink,
              color: STUDIO.paper,
              fontFamily: SERIF_STACK,
              fontStyle: "italic",
            }}
          >
            B
          </span>
          <span className="leading-none">
            <span
              className="block font-semibold text-[13px]"
              style={{ color: STUDIO.ink }}
            >
              BISO Studio
            </span>
            <span
              className="mt-0.5 block text-[10px] uppercase tracking-[0.07em]"
              style={{ color: STUDIO.ink3, fontFamily: MONO_STACK }}
            >
              Admin Portal
            </span>
          </span>
        </div>

        {/* Main editorial content */}
        <div className="relative space-y-6">
          <p
            className="text-[11px] uppercase tracking-[0.12em]"
            style={{ color: STUDIO.claret, fontFamily: MONO_STACK }}
          >
            BI Student Organisation
          </p>
          <h2
            className="text-5xl leading-[1.08] xl:text-6xl"
            style={{
              color: STUDIO.ink,
              fontFamily: SERIF_STACK,
              fontWeight: 400,
            }}
          >
            {t("tagline")}
          </h2>
          <p
            className="max-w-xs text-sm leading-relaxed"
            style={{ color: STUDIO.ink3 }}
          >
            {t("signInSubtitle")}
          </p>
        </div>

        {/* Footer */}
        <p
          className="relative text-xs"
          style={{ color: STUDIO.ink4, fontFamily: MONO_STACK }}
        >
          © {new Date().getFullYear()} BISO · {t("copyright")}
        </p>
      </div>

      {/* ─── Right sign-in column ─────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col items-center justify-center px-8 py-16">
        {/* Mobile brand mark */}
        <div className="mb-10 flex items-center gap-2.5 lg:hidden">
          <span
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-lg"
            style={{
              background: STUDIO.ink,
              color: STUDIO.paper,
              fontFamily: SERIF_STACK,
              fontStyle: "italic",
            }}
          >
            B
          </span>
          <span className="font-semibold text-sm" style={{ color: STUDIO.ink }}>
            BISO Studio
          </span>
        </div>

        {/* OAuth error notice */}
        {error && (
          <div
            className="mb-8 w-full max-w-sm rounded-xl px-4 py-3 text-sm"
            style={{
              background: "rgba(107,30,30,0.07)",
              border: "0.5px solid rgba(107,30,30,0.22)",
              color: STUDIO.claret,
            }}
          >
            {t("signInError")}
          </div>
        )}

        <Login />

        {/* Footer (mobile) */}
        <p
          className="mt-12 text-center text-xs lg:hidden"
          style={{ color: STUDIO.ink4, fontFamily: MONO_STACK }}
        >
          © {new Date().getFullYear()} BISO · {t("copyright")}
        </p>
      </div>
    </div>
  );
}
