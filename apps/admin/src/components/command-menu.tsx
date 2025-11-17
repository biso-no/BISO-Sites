'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import {
  Calculator,
  Calendar,
  CreditCard,
  Settings,
  User,
  Smile,
  FileText,
  Store,
  Users,
  LayoutDashboard,
  Building2,
  Shield,
  Briefcase,
  Package,
  ShoppingCart,
  TrendingUp,
  DollarSign,
} from 'lucide-react'

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@repo/ui/components/ui/command'
import { DialogTitle } from '@repo/ui/components/ui/dialog'

type CommandItem = {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  action: () => void
  shortcut?: string
  group: string
  keywords?: string[]
}

export function CommandMenu() {
  const [open, setOpen] = React.useState(false)
  const router = useRouter()

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }

    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  const runCommand = React.useCallback((command: () => void) => {
    setOpen(false)
    command()
  }, [])

  const commands: CommandItem[] = React.useMemo(() => [
    // Navigation
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      action: () => router.push('/admin'),
      group: 'Navigation',
      keywords: ['home', 'overview', 'stats'],
    },
    {
      id: 'users',
      label: 'Users',
      icon: Users,
      action: () => router.push('/admin/users'),
      group: 'Navigation',
      keywords: ['members', 'accounts', 'people'],
    },
    {
      id: 'shop',
      label: 'Shop',
      icon: Store,
      action: () => router.push('/admin/shop'),
      group: 'Navigation',
      keywords: ['store', 'ecommerce'],
    },
    {
      id: 'products',
      label: 'Products',
      icon: Package,
      action: () => router.push('/admin/shop/products'),
      group: 'Shop',
      keywords: ['items', 'catalog', 'inventory'],
    },
    {
      id: 'orders',
      label: 'Orders',
      icon: ShoppingCart,
      action: () => router.push('/admin/shop/orders'),
      group: 'Shop',
      keywords: ['sales', 'purchases', 'transactions'],
    },
    {
      id: 'customers',
      label: 'Customers',
      icon: Users,
      action: () => router.push('/admin/shop/customers'),
      group: 'Shop',
      keywords: ['buyers', 'clients'],
    },
    {
      id: 'expenses',
      label: 'Expenses',
      icon: DollarSign,
      action: () => router.push('/admin/expenses'),
      group: 'Finance',
      keywords: ['costs', 'spending', 'budget'],
    },
    {
      id: 'jobs',
      label: 'Jobs',
      icon: Briefcase,
      action: () => router.push('/admin/jobs'),
      group: 'HR',
      keywords: ['positions', 'vacancies', 'recruitment'],
    },
    {
      id: 'applications',
      label: 'Job Applications',
      icon: FileText,
      action: () => router.push('/admin/jobs/applications'),
      group: 'HR',
      keywords: ['candidates', 'applicants'],
    },
    {
      id: 'posts',
      label: 'Posts & News',
      icon: FileText,
      action: () => router.push('/admin/posts'),
      group: 'Content',
      keywords: ['news', 'articles', 'blog', 'content'],
    },
    {
      id: 'events',
      label: 'Events',
      icon: Calendar,
      action: () => router.push('/admin/events'),
      group: 'Content',
      keywords: ['calendar', 'activities', 'happenings'],
    },
    {
      id: 'units',
      label: 'Units',
      icon: Building2,
      action: () => router.push('/admin/units'),
      group: 'Organization',
      keywords: ['departments', 'divisions', 'teams'],
    },
    {
      id: 'varsling',
      label: 'Varsling',
      icon: Shield,
      action: () => router.push('/admin/varsling'),
      group: 'Compliance',
      keywords: ['whistleblowing', 'reports', 'security'],
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      action: () => router.push('/admin/settings'),
      group: 'System',
      keywords: ['configuration', 'preferences', 'options'],
    },
  ], [router])

  const groupedCommands = React.useMemo(() => {
    const groups = new Map<string, CommandItem[]>()
    commands.forEach((command) => {
      const group = command.group
      if (!groups.has(group)) {
        groups.set(group, [])
      }
      groups.get(group)!.push(command)
    })
    return groups
  }, [commands])

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="relative w-full max-w-sm"
      >
        <div className="relative">
          <input
            type="text"
            placeholder="Hurtigsøk i admin..."
            className="w-full rounded-2xl border border-primary/10 dark:border-primary/20 bg-white/60 dark:bg-card/60 pl-9 pr-16 py-2 text-sm shadow-inner focus:outline-none focus:ring-2 focus:ring-primary-30"
            readOnly
          />
          <span className="pointer-events-none absolute right-3 top-2 text-[11px] uppercase tracking-[0.18em] text-primary-40">
            ⌘K
          </span>
        </div>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <DialogTitle>Command Menu</DialogTitle>
        <CommandInput placeholder="Type a command or search..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          {Array.from(groupedCommands.entries()).map(([group, items], index) => (
            <React.Fragment key={group}>
              {index > 0 && <CommandSeparator />}
              <CommandGroup heading={group}>
                {items.map((item) => {
                  const Icon = item.icon
                  return (
                    <CommandItem
                      key={item.id}
                      value={`${item.label} ${item.keywords?.join(' ') || ''}`}
                      onSelect={() => runCommand(item.action)}
                    >
                      <Icon className="mr-2 h-4 w-4" />
                      <span>{item.label}</span>
                      {item.shortcut && <CommandShortcut>{item.shortcut}</CommandShortcut>}
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </React.Fragment>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  )
}

