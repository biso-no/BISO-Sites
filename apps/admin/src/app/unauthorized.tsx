import { Button } from "@repo/ui/components/ui/button";
import { cn } from "@repo/ui/lib/utils";
import { Home, LogIn, ShieldAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Unauthorized | BISO",
  description: "You need to be signed in to view this page.",
};

export default function Unauthorized() {
  return (
    <main
      className={cn(
        "relative flex min-h-screen flex-col items-center justify-center overflow-hidden",
        "bg-linear-to-br from-primary-100 via-blue-strong to-blue-accent text-white"
      )}
    >
      {/* Animated background decorations */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.12),transparent_50%),radial-gradient(circle_at_bottom_left,rgba(247,214,74,0.15),transparent_55%)]" />

      {/* Subtle animated grid */}
      <div className="absolute inset-0 opacity-[0.03]">
        <div className="mask-[radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] h-full w-full bg-[linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] bg-size-[4rem_4rem]" />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-8 px-6 text-center">
        {/* Badge */}
        <div className="flex items-center gap-3 rounded-full border border-white/20 bg-white/10 px-5 py-2.5 text-xs uppercase tracking-[0.2em] backdrop-blur-sm">
          <ShieldAlert className="h-4 w-4" />
          <span>Tilgang nektet</span>
        </div>

        {/* Main content */}
        <div className="space-y-5">
          <div className="inline-flex rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
            <ShieldAlert className="h-12 w-12 text-white" />
          </div>

          <div className="space-y-4">
            <p className="font-medium text-sm text-white/70 uppercase tracking-[0.25em]">
              401
            </p>
            <h1 className="max-w-xl font-semibold text-4xl text-white leading-tight md:text-5xl">
              Du må være logget inn for å se denne siden
            </h1>
            <p className="max-w-2xl text-base text-white/80 md:text-lg">
              Dette området krever at du er autentisert. Logg inn med din konto
              for å få tilgang til innholdet.
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button
            asChild
            className="bg-white text-primary-100 shadow-black/10 shadow-lg hover:bg-white/90"
            size="lg"
          >
            <Link href="/auth/login">
              <LogIn className="mr-2 h-5 w-5" />
              Logg inn
            </Link>
          </Button>
          <Button
            asChild
            className="border border-white/40 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20"
            size="lg"
            variant="ghost"
          >
            <Link href="/">
              <Home className="mr-2 h-5 w-5" />
              Gå til forsiden
            </Link>
          </Button>
        </div>

        {/* Help section */}
        <div className="mt-4 rounded-3xl border border-white/15 bg-white/10 px-6 py-4 text-sm text-white/80 shadow-lg backdrop-blur-sm">
          <p>
            Har du problemer med å logge inn?{" "}
            <a
              className="font-semibold underline-offset-4 hover:underline"
              href="mailto:contact@biso.no"
            >
              Kontakt oss
            </a>{" "}
            så hjelper vi deg.
          </p>
        </div>
      </div>

      {/* Subtle floating shapes */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="-top-24 absolute left-1/4 h-48 w-48 rounded-full bg-white/5 blur-3xl" />
        <div className="-bottom-24 absolute right-1/3 h-64 w-64 rounded-full bg-gold-default/5 blur-3xl" />
      </div>
    </main>
  );
}
