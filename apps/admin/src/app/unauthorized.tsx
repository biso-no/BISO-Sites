import { LogIn, ShieldAlert } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import {
  MONO_STACK,
  SERIF_STACK,
  STUDIO,
  StudioLinkButton,
} from "./(portal)/_components/studio";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("adminPortal.unauthorized");
  return {
    title: `${t("tagline")} | BISO`,
    description: t("description"),
  };
}

export default async function Unauthorized() {
  const t = await getTranslations("adminPortal.unauthorized");

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
            background: "rgba(107,30,30,0.06)",
            borderColor: "rgba(107,30,30,0.2)",
            color: STUDIO.claret,
            fontFamily: MONO_STACK,
          }}
        >
          <ShieldAlert size={12} />
          <span>401 · {t("tagline")}</span>
        </div>

        {/* Icon */}
        <div
          className="grid h-16 w-16 place-items-center rounded-2xl border"
          style={{
            background: "rgba(107,30,30,0.06)",
            borderColor: "rgba(107,30,30,0.18)",
            color: STUDIO.claret,
          }}
        >
          <ShieldAlert size={28} />
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
            {t("title")}
          </h1>
          <p className="text-sm leading-6" style={{ color: STUDIO.ink3 }}>
            {t("description")}
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <StudioLinkButton href="/auth/login" variant="primary">
            <LogIn size={15} />
            {t("signIn")}
          </StudioLinkButton>
          <StudioLinkButton href="/" variant="secondary">
            {t("goToFrontPage")}
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
          {t.rich("help", {
            link: (chunks) => (
              <a
                className="underline-offset-2 hover:underline"
                href="mailto:contact@biso.no"
                style={{ color: STUDIO.claret }}
              >
                {chunks}
              </a>
            ),
          })}
        </p>
      </div>
    </main>
  );
}
