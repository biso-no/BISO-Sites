import Link from "next/link";
import { Button } from "@repo/ui/components/ui/button";

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
    description: "Deep dives for the web and admin apps, including features and routing.",
    link: "/docs/applications/overview",
  },
  {
    title: "Packages",
    description: "Shared API, payment, editor, and UI packages with usage examples.",
    link: "/docs/packages",
  },
  {
    title: "Operations",
    description: "Deployments, environment variables, Appwrite, and external services.",
    link: "/docs/operations/overview",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 container mx-auto px-4 py-16">
        <div className="max-w-5xl mx-auto space-y-16">
          <div className="text-center space-y-6">
            <span className="inline-flex items-center rounded-full border px-4 py-1 text-sm font-medium text-muted-foreground">
              BISO Sites · Turborepo · Next.js · Appwrite
            </span>
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
              Documentation for every maintainer
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto">
              Opinionated guides, references, and playbooks so future IT managers and
              contributors can understand, operate, and extend the BISO Sites monorepo.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Button asChild size="lg">
                <Link href="/docs/repository/onboarding">New IT Manager: Start here</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/docs/repository/quickstart">Developers: 5-minute setup</Link>
              </Button>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {personaCards.map((card) => (
              <div
                key={card.title}
                className="rounded-xl border bg-card p-6 text-left shadow-sm"
              >
                <p className="text-sm uppercase tracking-wide text-muted-foreground">
                  Persona flow
                </p>
                <h3 className="mt-2 text-2xl font-semibold">{card.title}</h3>
                <p className="mt-3 text-muted-foreground">{card.description}</p>
                <Button asChild variant="link" className="mt-4 px-0">
                  <Link href={card.link}>{card.action} -&gt;</Link>
                </Button>
              </div>
            ))}
          </div>

          <div className="space-y-4">
            <div className="text-center space-y-1">
              <p className="text-sm uppercase tracking-wide text-muted-foreground">
                Section map
              </p>
              <h2 className="text-3xl font-bold">Everything in its place</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Use these anchors to dive straight into the area you need—repository basics,
                app-specific guides, shared packages, or operations playbooks.
              </p>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              {sectionCards.map((section) => (
                <Link
                  key={section.title}
                  href={section.link}
                  className="rounded-xl border bg-muted/10 p-6 text-left transition hover:border-primary hover:bg-background"
                >
                  <h3 className="text-xl font-semibold">{section.title}</h3>
                  <p className="mt-2 text-muted-foreground">{section.description}</p>
                </Link>
              ))}
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="rounded-lg border p-6 text-left">
              <div className="text-3xl mb-3">🗂️</div>
              <h3 className="font-semibold text-lg mb-1">3 Applications</h3>
              <p className="text-sm text-muted-foreground">
                Web (public), Admin (editors), and Docs (this site) powered by Next.js App Router.
              </p>
            </div>
            <div className="rounded-lg border p-6 text-left">
              <div className="text-3xl mb-3">🧩</div>
              <h3 className="font-semibold text-lg mb-1">5 Shared Packages</h3>
              <p className="text-sm text-muted-foreground">
                API, UI, Editor, Payment, and Configs keep logic consistent across apps.
              </p>
            </div>
            <div className="rounded-lg border p-6 text-left">
              <div className="text-3xl mb-3">🛠️</div>
              <h3 className="font-semibold text-lg mb-1">Operations Ready</h3>
              <p className="text-sm text-muted-foreground">
                Playbooks for environments, Appwrite, Vipps, and deployment tooling.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
