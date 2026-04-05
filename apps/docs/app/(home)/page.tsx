import { Button } from "@repo/ui/components/ui/button";
import {
  AppWindow,
  ArrowRight,
  BookOpen,
  FolderGit2,
  Package,
  Server,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

const personaCards = [
  {
    label: "New to the codebase",
    title: "IT Manager Onboarding",
    description:
      "Use the structured onboarding checklist to understand the monorepo, run the apps locally, and review credentials — no deep coding experience required.",
    link: "/docs/repository/onboarding",
    action: "Start onboarding",
    accent: "#3DA9E0" as const,
    accentBg: "rgba(61,169,224,0.10)" as const,
  },
  {
    label: "Ready to ship",
    title: "Developer Quickstart",
    description:
      "Jump straight into the five-minute setup, dev workflow, and package references so you can contribute without guessing where things live.",
    link: "/docs/repository/quickstart",
    action: "Open quickstart",
    accent: "#F7D64A" as const,
    accentBg: "rgba(247,214,74,0.10)" as const,
  },
];

const sectionCards = [
  {
    icon: FolderGit2,
    title: "Repository",
    description:
      "Project structure, installation commands, contribution guides, and monorepo conventions.",
    link: "/docs/repository/project-structure",
  },
  {
    icon: AppWindow,
    title: "Applications",
    description:
      "Deep dives for the web and admin apps — features, routing, and data flow.",
    link: "/docs/applications/overview",
  },
  {
    icon: Package,
    title: "Packages",
    description:
      "Shared API, payment, editor, and UI packages with full usage examples.",
    link: "/docs/packages",
  },
  {
    icon: Server,
    title: "Operations",
    description:
      "Deployments, environment variables, Appwrite, and external service playbooks.",
    link: "/docs/operations/overview",
  },
];

const statCards = [
  {
    icon: AppWindow,
    stat: "3",
    unit: "Applications",
    detail: "Web (public), Admin (editors), and Docs — all Next.js App Router.",
  },
  {
    icon: Package,
    stat: "5",
    unit: "Shared Packages",
    detail: "API, UI, Editor, Payment, and Configs keep logic DRY.",
  },
  {
    icon: Server,
    stat: "1",
    unit: "Operations Layer",
    detail:
      "Playbooks for Appwrite, Vipps, environments, and deployment tooling.",
  },
];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* ── Hero: product visual as background, text overlaid ── */}
      <section className="relative overflow-hidden border-b">
        {/* Background image — fills the section */}
        <Image
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover object-center"
          fill
          priority
          src="/shots.png"
        />

        {/* Radial overlay: dense at centre for legibility, fades out to reveal image at edges */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 70% 90% at 50% 40%, rgba(0,23,49,0.88) 0%, rgba(0,23,49,0.70) 50%, rgba(0,23,49,0.25) 100%)",
          }}
        />

        {/* Fade into page background at the bottom */}
        <div
          aria-hidden
          className="absolute right-0 bottom-0 left-0 h-28"
          style={{
            background:
              "linear-gradient(to bottom, transparent, var(--background))",
          }}
        />

        {/* Text content */}
        <div className="container relative z-10 mx-auto max-w-3xl px-4 pt-20 pb-24 text-center md:pt-24 md:pb-32">
          <div className="flex flex-col items-center space-y-6">
            {/* Badge */}
            <span
              className="inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 font-medium text-sm"
              style={{
                borderColor: "rgba(61,169,224,0.40)",
                background: "rgba(61,169,224,0.12)",
                color: "#7dd3fc",
              }}
            >
              <BookOpen className="h-3.5 w-3.5" style={{ color: "#3DA9E0" }} />
              BISO Sites · Turborepo · Next.js · Appwrite
            </span>

            {/* Headline */}
            <h1 className="font-bold text-4xl text-white leading-[1.1] tracking-tight sm:text-5xl md:text-6xl">
              Documentation for{" "}
              <span
                style={{
                  background: "linear-gradient(90deg, #3DA9E0, #93d9f5)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                every maintainer
              </span>
            </h1>

            {/* Sub-copy */}
            <p
              className="max-w-2xl text-lg leading-relaxed"
              style={{ color: "rgba(255,255,255,0.65)" }}
            >
              Opinionated guides, references, and playbooks so future IT
              managers and contributors can understand, operate, and extend the
              BISO Sites monorepo.
            </p>

            {/* CTAs */}
            <div className="flex flex-col gap-3 pt-1 sm:flex-row">
              <Button
                asChild
                className="gap-2 font-semibold text-white"
                size="lg"
                style={{ background: "#3DA9E0" }}
              >
                <Link href="/docs/repository/onboarding">
                  New IT Manager: Start here
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                className="border font-semibold"
                size="lg"
                style={{
                  background: "rgba(255,255,255,0.08)",
                  borderColor: "rgba(255,255,255,0.20)",
                  color: "rgba(255,255,255,0.88)",
                }}
                variant="outline"
              >
                <Link href="/docs/repository/quickstart">
                  Developers: 5-minute setup
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <main className="container mx-auto flex-1 px-4 py-16">
        <div className="mx-auto max-w-5xl space-y-20">
          {/* ── Persona paths ── */}
          <section className="space-y-6">
            <div className="space-y-1">
              <p className="font-medium text-muted-foreground text-sm uppercase tracking-widest">
                Where do you fit?
              </p>
              <h2 className="font-bold text-2xl tracking-tight">
                Pick your starting point
              </h2>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              {personaCards.map((card) => (
                <div
                  className="group relative flex flex-col rounded-2xl border bg-card p-7 transition-shadow hover:shadow-md"
                  key={card.title}
                  style={{ borderColor: `${card.accent}28` }}
                >
                  <div
                    className="mb-4 flex h-9 w-9 items-center justify-center rounded-full"
                    style={{ background: card.accentBg }}
                  >
                    <div
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ background: card.accent }}
                    />
                  </div>
                  <p
                    className="mb-1 font-medium text-xs uppercase tracking-widest"
                    style={{
                      color: card.accent === "#3DA9E0" ? "#0077b6" : "#92620d",
                    }}
                  >
                    {card.label}
                  </p>
                  <h3 className="mb-3 font-semibold text-xl">{card.title}</h3>
                  <p className="grow text-muted-foreground text-sm leading-relaxed">
                    {card.description}
                  </p>
                  <Button
                    asChild
                    className="mt-5 w-fit gap-1 px-0 font-medium"
                    variant="link"
                  >
                    <Link href={card.link}>
                      {card.action}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          </section>

          {/* ── Section map ── */}
          <section className="space-y-6">
            <div className="space-y-1">
              <p className="font-medium text-muted-foreground text-sm uppercase tracking-widest">
                Section map
              </p>
              <h2 className="font-bold text-2xl tracking-tight">
                Everything in its place
              </h2>
              <p className="max-w-2xl text-muted-foreground text-sm leading-relaxed">
                Use these anchors to jump into the area you need — repository
                basics, app-specific guides, shared packages, or operations
                playbooks.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {sectionCards.map((section) => {
                const Icon = section.icon;
                return (
                  <Link
                    className="group flex gap-4 rounded-xl border bg-card p-6 text-left transition-all hover:border-[#3DA9E0]/40 hover:shadow-sm"
                    href={section.link}
                    key={section.title}
                  >
                    <div
                      className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                      style={{ background: "rgba(61,169,224,0.10)" }}
                    >
                      <Icon
                        className="h-[18px] w-[18px]"
                        style={{ color: "#3DA9E0" }}
                      />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-base">
                        {section.title}
                      </h3>
                      <p className="mt-1 text-muted-foreground text-sm leading-relaxed">
                        {section.description}
                      </p>
                    </div>
                    <ArrowRight className="mt-0.5 ml-auto h-4 w-4 shrink-0 text-muted-foreground/40 transition-all group-hover:translate-x-0.5 group-hover:text-[#3DA9E0]" />
                  </Link>
                );
              })}
            </div>
          </section>

          {/* ── Stats strip ── */}
          <section
            className="rounded-2xl border p-8"
            style={{ background: "rgba(61,169,224,0.04)" }}
          >
            <p className="mb-6 font-medium text-muted-foreground text-sm uppercase tracking-widest">
              The stack at a glance
            </p>
            <div className="grid gap-8 sm:grid-cols-3">
              {statCards.map((s) => {
                const Icon = s.icon;
                return (
                  <div className="flex gap-4" key={s.unit}>
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                      style={{ background: "rgba(61,169,224,0.10)" }}
                    >
                      <Icon className="h-5 w-5" style={{ color: "#3DA9E0" }} />
                    </div>
                    <div>
                      <p className="font-bold text-2xl leading-none">
                        {s.stat}
                        <span
                          className="ml-1.5 font-semibold text-base"
                          style={{ color: "#3DA9E0" }}
                        >
                          {s.unit}
                        </span>
                      </p>
                      <p className="mt-1 text-muted-foreground text-sm leading-snug">
                        {s.detail}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
