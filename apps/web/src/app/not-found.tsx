import { Button } from "@repo/ui/components/ui/button";
import { cn } from "@repo/ui/lib/utils";
import { ArrowLeft, Home, SearchX } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <main
      className={cn(
        "relative flex min-h-screen flex-col items-center justify-center overflow-hidden",
        "bg-linear-to-br from-primary-100 via-blue-strong to-blue-accent text-white"
      )}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.14),transparent_55%),radial-gradient(circle_at_bottom_right,rgba(61,169,224,0.18),transparent_60%)]" />

      <div className="relative z-10 flex flex-col items-center gap-8 px-6 text-center">
        <div className="flex items-center gap-3 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs uppercase tracking-[0.2em]">
          <SearchX className="h-4 w-4" />
          <span>Siden finnes ikke</span>
        </div>

        <div className="space-y-4">
          <p className="text-sm font-medium uppercase tracking-[0.25em] text-white/70">
            404
          </p>
          <h1 className="max-w-xl text-4xl font-semibold leading-tight text-white md:text-5xl">
            Vi fant ikke siden du lette etter.
          </h1>
          <p className="max-w-2xl text-base text-white/80 md:text-lg">
            Kanskje ble innholdet flyttet, eller kanskje det er skrevet feil
            adresse. La oss hjelpe deg tilbake til noe relevant.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button
            asChild
            size="lg"
            className="bg-white text-primary-100 hover:bg-white/90"
          >
            <Link href="/">
              <Home className="mr-2 h-5 w-5" />
              Gå til forsiden
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="ghost"
            className="border border-white/40 bg-white/10 text-white hover:bg-white/20"
          >
            <Link href="/campus">
              <ArrowLeft className="mr-2 h-5 w-5" />
              Tilbake til campus-oversikten
            </Link>
          </Button>
        </div>

        <div className="rounded-3xl border border-white/15 bg-white/10 px-6 py-4 text-sm text-white/80 shadow-lg">
          <p>
            Trenger du hjelp? Kontakt oss på{" "}
            <a
              href="mailto:contact@biso.no"
              className="font-semibold underline-offset-4 hover:underline"
            >
              contact@biso.no
            </a>{" "}
            så følger vi deg opp.
          </p>
        </div>
      </div>
    </main>
  );
}
