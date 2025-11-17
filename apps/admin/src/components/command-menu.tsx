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
import { useTranslations } from 'next-intl'

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
  const t = useTranslations('admin')
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
      label: t('navigation.dashboard'),
      icon: LayoutDashboard,
      action: () => router.push('/admin'),
      group: t('commandGroups.navigation'),
      keywords: t('commandKeywords.dashboard').split(' '),
    },
    {
      id: 'users',
      label: t('navigation.users'),
      icon: Users,
      action: () => router.push('/admin/users'),
      group: t('commandGroups.navigation'),
      keywords: t('commandKeywords.users').split(' '),
    },
    {
      id: 'shop',
      label: t('navigation.shop'),
      icon: Store,
      action: () => router.push('/admin/shop'),
      group: t('commandGroups.navigation'),
      keywords: t('commandKeywords.shop').split(' '),
    },
    {
      id: 'products',
      label: t('shopSubItems.products'),
      icon: Package,
      action: () => router.push('/admin/shop/products'),
      group: t('commandGroups.shop'),
      keywords: t('commandKeywords.products').split(' '),
    },
    {
      id: 'orders',
      label: t('shopSubItems.orders'),
      icon: ShoppingCart,
      action: () => router.push('/admin/shop/orders'),
      group: t('commandGroups.shop'),
      keywords: t('commandKeywords.orders').split(' '),
    },
    {
      id: 'customers',
      label: t('shopSubItems.customers'),
      icon: Users,
      action: () => router.push('/admin/shop/customers'),
      group: t('commandGroups.shop'),
      keywords: t('commandKeywords.customers').split(' '),
    },
    {
      id: 'expenses',
      label: t('navigation.expenses'),
      icon: DollarSign,
      action: () => router.push('/admin/expenses'),
      group: t('commandGroups.finance'),
      keywords: t('commandKeywords.expenses').split(' '),
    },
    {
      id: 'jobs',
      label: t('navigation.jobs'),
      icon: Briefcase,
      action: () => router.push('/admin/jobs'),
      group: t('commandGroups.hr'),
      keywords: t('commandKeywords.jobs').split(' '),
    },
    {
      id: 'applications',
      label: t('jobsSubItems.applications'),
      icon: FileText,
      action: () => router.push('/admin/jobs/applications'),
      group: t('commandGroups.hr'),
      keywords: t('commandKeywords.applications').split(' '),
    },
    {
      id: 'posts',
      label: t('navigation.posts'),
      icon: FileText,
      action: () => router.push('/admin/posts'),
      group: t('commandGroups.content'),
      keywords: t('commandKeywords.posts').split(' '),
    },
    {
      id: 'events',
      label: t('navigation.events'),
      icon: Calendar,
      action: () => router.push('/admin/events'),
      group: t('commandGroups.content'),
      keywords: t('commandKeywords.events').split(' '),
    },
    {
      id: 'units',
      label: t('navigation.units'),
      icon: Building2,
      action: () => router.push('/admin/units'),
      group: t('commandGroups.organization'),
      keywords: t('commandKeywords.units').split(' '),
    },
    {
      id: 'varsling',
      label: t('navigation.varsling'),
      icon: Shield,
      action: () => router.push('/admin/varsling'),
      group: t('commandGroups.compliance'),
      keywords: t('commandKeywords.varsling').split(' '),
    },
    {
      id: 'settings',
      label: t('navigation.settings'),
      icon: Settings,
      action: () => router.push('/admin/settings'),
      group: t('commandGroups.system'),
      keywords: t('commandKeywords.settings').split(' '),
    },
  ], [router, t])

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
            placeholder={t('commandMenuPlaceholder')}
            className="w-full rounded-2xl border border-primary/10 dark:border-primary/20 bg-white/60 dark:bg-card/60 pl-9 pr-16 py-2 text-sm shadow-inner focus:outline-none focus:ring-2 focus:ring-primary-30"
            readOnly
          />
          <span className="pointer-events-none absolute right-3 top-2 text-[11px] uppercase tracking-[0.18em] text-primary-40">
            ⌘K
          </span>
        </div>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <DialogTitle>{t('commandMenuTitle')}</DialogTitle>
        <CommandInput placeholder={t('commandMenuSearchPlaceholder')} />
        <CommandList>
          <CommandEmpty>{t('commandMenuNoResults')}</CommandEmpty>
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

