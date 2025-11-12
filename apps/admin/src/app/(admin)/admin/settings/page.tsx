import { listNavMenuAdmin } from "@/app/actions/nav-menu"
import { NavMenuManager } from "./_components/nav-menu-manager"
import { PolicyPagesManager } from "./_components/policy-pages-manager"

export default async function AdminSettingsPage() {
  const navigation = await listNavMenuAdmin()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage global configuration for the public experience.</p>
      </div>

      <NavMenuManager items={navigation.tree} />

      <div className="space-y-3">
        <h2 className="text-xl font-semibold">Content Pages</h2>
        <p className="text-sm text-muted-foreground">Manage policy pages. Edit content and auto-translate between NO/EN.</p>
        <PolicyPagesManager />
      </div>
    </div>
  )
}
