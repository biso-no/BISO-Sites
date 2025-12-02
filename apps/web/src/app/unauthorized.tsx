"use client";

import { Button } from "@repo/ui/components/ui/button";
import { Home, LogIn, ShieldAlert } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export default function Unauthorized() {
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background">
      {/* Background decoration - subtle gradients */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="-top-40 -right-40 absolute h-[500px] w-[500px] rounded-full bg-[#3DA9E0]/10 blur-3xl dark:bg-[#3DA9E0]/5" />
        <div className="-left-40 absolute top-1/3 h-[400px] w-[400px] rounded-full bg-[#F7D64A]/10 blur-3xl dark:bg-[#F7D64A]/5" />
        <div className="absolute right-1/4 bottom-0 h-[450px] w-[450px] rounded-full bg-[#001731]/5 blur-3xl dark:bg-[#3DA9E0]/5" />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-8 px-6 text-center">
        {/* Logo */}
        <div className="mb-4">
          {mounted ? (
            <Image
              alt="BISO Logo"
              className="h-12 w-auto"
              height={48}
              priority
              src={
                resolvedTheme === "dark"
                  ? "/images/logo-dark.png"
                  : "/images/logo-light.png"
              }
              width={160}
            />
          ) : (
            <div className="h-12 w-40 animate-pulse rounded bg-muted" />
          )}
        </div>

        {/* Badge */}
        <div className="flex items-center gap-3 rounded-full border border-border bg-secondary px-5 py-2.5 text-secondary-foreground text-xs uppercase tracking-[0.2em]">
          <ShieldAlert className="h-4 w-4 text-red-500" />
          <span>Tilgang nektet</span>
        </div>

        {/* Main content */}
        <div className="space-y-5">
          <div className="inline-flex rounded-2xl border border-border bg-card p-4 shadow-lg">
            <ShieldAlert className="h-12 w-12 text-red-500" />
          </div>

          <div className="space-y-4">
            <p className="font-medium text-muted-foreground text-sm uppercase tracking-[0.25em]">
              401
            </p>
            <h1 className="max-w-xl font-semibold text-4xl text-foreground leading-tight md:text-5xl">
              Du må være logget inn for å se denne siden
            </h1>
            <p className="max-w-2xl text-base text-muted-foreground md:text-lg">
              Dette området krever at du er autentisert. Logg inn med din konto
              for å få tilgang til innholdet.
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button
            asChild
            className="bg-linear-to-r from-[#3DA9E0] to-[#001731] text-white shadow-lg hover:opacity-90"
            size="lg"
          >
            <Link href="/auth/login">
              <LogIn className="mr-2 h-5 w-5" />
              Logg inn
            </Link>
          </Button>
          <Button
            asChild
            className="border border-border bg-secondary text-secondary-foreground hover:bg-secondary/80"
            size="lg"
            variant="outline"
          >
            <Link href="/">
              <Home className="mr-2 h-5 w-5" />
              Gå til forsiden
            </Link>
          </Button>
        </div>

        {/* Help section */}
        <div className="mt-4 rounded-2xl border border-border bg-card px-6 py-4 text-muted-foreground text-sm shadow-lg">
          <p>
            Har du problemer med å logge inn?{" "}
            <a
              className="font-semibold text-[#3DA9E0] underline-offset-4 hover:underline"
              href="mailto:contact@biso.no"
            >
              Kontakt oss
            </a>{" "}
            så hjelper vi deg.
          </p>
        </div>
      </div>

      {/* Footer text */}
      <div className="absolute bottom-4 w-full text-center text-muted-foreground text-xs">
        &copy; {new Date().getFullYear()} BISO. All rights reserved.
      </div>
    </main>
  );
}
