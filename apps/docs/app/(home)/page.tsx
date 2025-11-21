import { Button } from "@repo/ui/components/ui/button";
import Link from "next/link";

const personaCards = [
  {
    title: "New IT Manager",
    description:
      "Use the onboarding checklist to understand the monorepo, run the apps, and review credentials even if you have limited coding experience.",
    link: "/docs/repository/onboarding",
    action: "Open onboarding",
  },
  {
    title: "Developers & Contributors",
    description:
      "Jump straight into the quickstart, dev workflow, and package references so you can ship features without guessing where things live.",
    link: "/docs/repository/quickstart",
    action: "View quickstart",
  },
];

const sectionCards = [
  {
    title: "Repository",
    description: "Project structure, installation, commands, and contributing.",
    link: "/docs/repository/project-structure",
  },
  {
    title: "Applications",
    description:
      "Deep dives for the web and admin apps, including features and routing.",
    link: "/docs/applications/overview",
  },
  {
    title: "Packages",
    description:
      "Shared API, payment, editor, and UI packages with usage examples.",
    link: "/docs/packages",
  },
  {
    title: "Operations",
    description:
      "Deployments, environment variables, Appwrite, and external services.",
    link: "/docs/operations/overview",
  },
];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <main className="container mx-auto flex-1 px-4 py-16">
        <div className="mx-auto max-w-5xl space-y-16">
          <div className="space-y-6 text-center">
            <span className="inline-flex items-center rounded-full border px-4 py-1 font-medium text-muted-foreground text-sm">
              BISO Sites · Turborepo · Next.js · Appwrite
            </span>
            <h1 className="font-bold text-5xl tracking-tight md:text-6xl">
              Documentation for every maintainer
            </h1>
            <p className="mx-auto max-w-3xl text-muted-foreground text-xl md:text-2xl">
              Opinionated guides, references, and playbooks so future IT
              managers and contributors can understand, operate, and extend the
              BISO Sites monorepo.
            </p>
            <div className="flex flex-col justify-center gap-4 pt-4 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/docs/repository/onboarding">
                  New IT Manager: Start here
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/docs/repository/quickstart">
                  Developers: 5-minute setup
                </Link>
              </Button>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {personaCards.map((card) => (
              <div
                className="rounded-xl border bg-card p-6 text-left shadow-sm"
                key={card.title}
              >
                <p className="text-muted-foreground text-sm uppercase tracking-wide">
                  Persona flow
                </p>
                <h3 className="mt-2 font-semibold text-2xl">{card.title}</h3>
                <p className="mt-3 text-muted-foreground">{card.description}</p>
                <Button asChild className="mt-4 px-0" variant="link">
                  <Link href={card.link}>{card.action} -&gt;</Link>
                </Button>
              </div>
            ))}
          </div>

          <div className="space-y-4">
            <div className="space-y-1 text-center">
              <p className="text-muted-foreground text-sm uppercase tracking-wide">
                Section map
              </p>
              <h2 className="font-bold text-3xl">Everything in its place</h2>
              <p className="mx-auto max-w-2xl text-muted-foreground">
                Use these anchors to dive straight into the area you
                need—repository basics, app-specific guides, shared packages, or
                operations playbooks.
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              {sectionCards.map((section) => (
                <Link
                  className="rounded-xl border bg-muted/10 p-6 text-left transition hover:border-primary hover:bg-background"
                  href={section.link}
                  key={section.title}
                >
                  <h3 className="font-semibold text-xl">{section.title}</h3>
                  <p className="mt-2 text-muted-foreground">
                    {section.description}
                  </p>
                </Link>
              ))}
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <div className="rounded-lg border p-6 text-left">
              <div className="mb-3 text-3xl">🗂️</div>
              <h3 className="mb-1 font-semibold text-lg">3 Applications</h3>
              <p className="text-muted-foreground text-sm">
                Web (public), Admin (editors), and Docs (this site) powered by
                Next.js App Router.
              </p>
            </div>
            <div className="rounded-lg border p-6 text-left">
              <div className="mb-3 text-3xl">🧩</div>
              <h3 className="mb-1 font-semibold text-lg">5 Shared Packages</h3>
              <p className="text-muted-foreground text-sm">
                API, UI, Editor, Payment, and Configs keep logic consistent
                across apps.
              </p>
            </div>
            <div className="rounded-lg border p-6 text-left">
              <div className="mb-3 text-3xl">🛠️</div>
              <h3 className="mb-1 font-semibold text-lg">Operations Ready</h3>
              <p className="text-muted-foreground text-sm">
                Playbooks for environments, Appwrite, Vipps, and deployment
                tooling.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
