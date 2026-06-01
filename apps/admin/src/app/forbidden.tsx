import { ShieldOff } from "lucide-react";
import type { Metadata } from "next";
import {
  MONO_STACK,
  SERIF_STACK,
  STUDIO,
  StudioLinkButton,
} from "./(portal)/_components/studio";

export const metadata: Metadata = {
  title: "Access Forbidden | BISO",
  description: "You do not have permission to access this area.",
};

/**
 * 403 Forbidden — rendered when Next.js fires the forbidden() interrupt
 * (authInterrupts: true is enabled in next.config.ts).
 * Reached when an authenticated, provisioned admin tries to access a section
 * they don't have role access to.
 */
export default function Forbidden() {
  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center px-6 py-16"
      style={{ background: STUDIO.paper }}
    >
      <div className="flex w-full max-w-md flex-col items-center gap-8 text-center">
        {/* Eyebrow */}
        <div
          className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-[11px] uppercase tracking-[0.1em]"
          style={{
            background: "rgba(176,138,62,0.07)",
            borderColor: "rgba(176,138,62,0.24)",
            color: "#6a5118",
            fontFamily: MONO_STACK,
          }}
        >
          <ShieldOff size={12} />
          <span>403 · Access forbidden</span>
        </div>

        {/* Icon */}
        <div
          className="grid h-16 w-16 place-items-center rounded-2xl border"
          style={{
            background: "rgba(176,138,62,0.07)",
            borderColor: "rgba(176,138,62,0.2)",
            color: "#6a5118",
          }}
        >
          <ShieldOff size={28} />
        </div>

        {/* Heading + body */}
        <div className="space-y-3">
          <h1
            className="text-4xl leading-tight md:text-5xl"
            style={{
              color: STUDIO.ink,
              fontFamily: SERIF_STACK,
              fontWeight: 400,
            }}
          >
            You don't have access
          </h1>
          <p className="text-sm leading-6" style={{ color: STUDIO.ink3 }}>
            Your account does not have permission to view this section. If you
            think this is a mistake, contact your administrator.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <StudioLinkButton href="/" variant="primary">
            Back to dashboard
          </StudioLinkButton>
          <StudioLinkButton href="/auth/login" variant="secondary">
            Sign in with a different account
          </StudioLinkButton>
        </div>

        {/* Help */}
        <p
          className="max-w-xs rounded-xl border px-5 py-3.5 text-xs leading-relaxed"
          style={{
            background: "rgba(255,255,255,0.46)",
            borderColor: STUDIO.rule,
            color: STUDIO.ink3,
          }}
        >
          Need help?{" "}
          <a
            className="underline-offset-2 hover:underline"
            href="mailto:contact@biso.no"
            style={{ color: STUDIO.claret }}
          >
            contact@biso.no
          </a>
        </p>
      </div>
    </main>
  );
}
