import { Button } from "@repo/ui/components/ui/button";
import { cn } from "@repo/ui/lib/utils";
import Link from "next/link";
import { redirect } from "next/navigation";
import { checkNavAccess } from "@/lib/authorization";

const NAV_ITEMS = [
  { href: "/content/entries", label: "Entries" },
  { href: "/content/templates", label: "Templates" },
] as const;

export default async function ContentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const hasAccess = await checkNavAccess("content");
  if (!hasAccess) {
    return redirect("/");
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div>
          <h1 className="font-bold text-3xl tracking-tight">Content</h1>
          <p className="text-muted-foreground">
            Manage templates and editorial entries with live preview.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {NAV_ITEMS.map((item) => (
            <Button
              asChild
              className={cn(
                "rounded-full",
                item.href === "/content/templates" && "border-primary/20"
              )}
              key={item.href}
              variant="outline"
            >
              <Link href={item.href}>{item.label}</Link>
            </Button>
          ))}
        </div>
      </div>

      {children}
    </div>
  );
}
