import Link from "next/link";
import { Button } from "@repo/ui/components/ui/button";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
            BISO Sites Documentation
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
            Comprehensive documentation for the BISO Sites monorepo. Everything you need to understand, develop, and deploy this application suite.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-8">
            <Button asChild size="lg">
              <Link href="/docs">
                Get Started
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/docs/quickstart">
                5-Minute Quickstart
              </Link>
            </Button>
          </div>

          <div className="grid md:grid-cols-3 gap-6 pt-16">
            <div className="p-6 border rounded-lg">
              <div className="text-3xl mb-4">🚀</div>
              <h3 className="font-semibold text-lg mb-2">Quick Setup</h3>
              <p className="text-sm text-muted-foreground">
                Get up and running in minutes with our detailed installation and setup guides.
              </p>
            </div>
            <div className="p-6 border rounded-lg">
              <div className="text-3xl mb-4">📦</div>
              <h3 className="font-semibold text-lg mb-2">Package APIs</h3>
              <p className="text-sm text-muted-foreground">
                Detailed API references for all shared packages including UI, API, and payment processing.
              </p>
            </div>
            <div className="p-6 border rounded-lg">
              <div className="text-3xl mb-4">🏗️</div>
              <h3 className="font-semibold text-lg mb-2">Architecture</h3>
              <p className="text-sm text-muted-foreground">
                Understand the system design, data flow, and architectural patterns used throughout.
              </p>
            </div>
          </div>

          <div className="pt-16 text-left max-w-2xl mx-auto space-y-6">
            <h2 className="text-2xl font-bold">What&apos;s Inside?</h2>
            <div className="space-y-4 text-muted-foreground">
              <div>
                <strong className="text-foreground">3 Applications:</strong>
                <ul className="list-disc list-inside ml-4 mt-1">
                  <li>Web - Public-facing website</li>
                  <li>Admin - Content management system</li>
                  <li>Docs - This documentation site</li>
                </ul>
              </div>
              <div>
                <strong className="text-foreground">5 Shared Packages:</strong>
                <ul className="list-disc list-inside ml-4 mt-1">
                  <li>API - Appwrite client integrations</li>
                  <li>UI - Shared component library (shadcn/ui)</li>
                  <li>Editor - Puck-based page builder</li>
                  <li>Payment - Multi-provider payment processing</li>
                  <li>Configs - Shared TypeScript and ESLint configurations</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
