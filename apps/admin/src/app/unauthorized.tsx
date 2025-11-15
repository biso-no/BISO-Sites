import Link from "next/link";
import { ArrowLeft, Home, ShieldAlert, LogIn } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import { cn } from "@repo/ui/lib/utils";
import { Metadata } from "next";

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
        <div className="h-full w-full bg-[linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] bg-size-[4rem_4rem] mask-[radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)]" />
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
            <p className="text-sm font-medium uppercase tracking-[0.25em] text-white/70">401</p>
            <h1 className="max-w-xl text-4xl font-semibold leading-tight text-white md:text-5xl">
              Du må være logget inn for å se denne siden
            </h1>
            <p className="max-w-2xl text-base text-white/80 md:text-lg">
              Dette området krever at du er autentisert. Logg inn med din konto for å få tilgang til innholdet.
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button 
            asChild 
            size="lg" 
            className="bg-white text-primary-100 hover:bg-white/90 shadow-lg shadow-black/10"
          >
            <Link href="/auth/login">
              <LogIn className="mr-2 h-5 w-5" />
              Logg inn
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="ghost"
            className="border border-white/40 bg-white/10 text-white hover:bg-white/20 backdrop-blur-sm"
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
              href="mailto:contact@biso.no"
              className="font-semibold underline-offset-4 hover:underline"
            >
              Kontakt oss
            </a>{" "}
            så hjelper vi deg.
          </p>
        </div>
      </div>

      {/* Subtle floating shapes */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 left-1/4 h-48 w-48 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute -bottom-24 right-1/3 h-64 w-64 rounded-full bg-gold-default/5 blur-3xl" />
      </div>
    </main>
  );
}
