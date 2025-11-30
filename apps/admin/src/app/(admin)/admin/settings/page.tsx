import { PolicyPagesManager } from "./_components/policy-pages-manager";

export default function AdminSettingsPage() {

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-bold text-2xl tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage global configuration for the public experience.
        </p>
      </div>


      <div className="space-y-3">
        <h2 className="font-semibold text-xl">Content Pages</h2>
        <p className="text-muted-foreground text-sm">
          Manage policy pages. Edit content and auto-translate between NO/EN.
        </p>
        <PolicyPagesManager />
      </div>
    </div>
  );
}
