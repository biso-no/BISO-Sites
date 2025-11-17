'use client'

import { ReactNode, useState, useEffect } from 'react';
import Link from 'next/link';
import { unauthorized, usePathname } from 'next/navigation';
import { Button } from '@repo/ui/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from "@repo/ui/components/ui/avatar";
import Breadcrumb from './breadcrumb';
import { RoleSwitcher } from './role-switcher';
import { cn } from '@repo/ui/lib/utils';
import { motion, AnimatePresence } from "framer-motion"
import {
  LayoutDashboard,
  FileText,
  Settings,
  Users,
  ChevronLeft,
  ChevronRight,
  CalendarIcon,
  Store,
  LogOut,
  Building2,
  Shield,
} from 'lucide-react';
import { signOut } from '@/lib/actions/user';
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { AssistantModal } from './ai/admin';
import { AssistantSidebar } from './ai/admin-sidebar';
import { useAssistantUIStore } from './ai/assistant-ui-store';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@repo/ui/components/ui/resizable';
import { ModeToggle } from '@repo/ui/components/mode-toggle';
import { CommandMenu } from './command-menu';
import { NotificationsDropdown } from './notifications/notifications-dropdown';

interface AdminLayoutProps {
  children: ReactNode;
  roles: string[];
  firstName: string;
}

interface NavItem {
  href: string;
  icon: React.ElementType;
  label: string;
  roles: string[];
  subItems?: { href: string; label: string; roles?: string[] }[];
}

const SidebarItem = ({
  item,
  isActive,
  isExpanded,
  pathname,
}: {
  item: NavItem;
  isActive: boolean;
  isExpanded: boolean;
  pathname: string;
}) => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (item.subItems) {
      setIsOpen(item.subItems.some((subItem) => pathname.startsWith(subItem.href)));
    }
  }, [pathname, item.subItems]);

  return (
    <motion.li
      initial={false}
      animate={{
        scale: isActive ? 1.01 : 1,
        backgroundColor: isActive ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0)",
      }}
      className="group relative mb-1 rounded-2xl px-2 py-1"
    >
      <div
        className={cn(
          "flex items-center gap-2 rounded-2xl px-2 py-2 transition-all duration-200 ease-out",
          isActive
            ? "bg-white/15 text-white shadow-[0_15px_35px_-25px_rgba(0,0,0,0.8)] backdrop-blur"
            : "text-white/70 hover:bg-white/5 hover:text-white"
        )}
      >
        <Link href={item.href} className="flex flex-1 items-center gap-3">
          <motion.span
            initial={false}
            animate={{
              backgroundColor: isActive ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.08)",
              color: isActive ? "rgba(255,255,255,0.98)" : "rgba(255,255,255,0.75)",
            }}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-sm font-medium"
          >
            <item.icon className="h-4 w-4" />
          </motion.span>
          {isExpanded && (
            <motion.span
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              className="text-sm font-medium"
            >
              {item.label}
            </motion.span>
          )}
        </Link>
        {item.subItems && isExpanded && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsOpen(!isOpen);
            }}
            className="rounded-lg p-1.5 text-white/60 transition hover:bg-white/10 hover:text-white"
          >
            <ChevronRight
              className={cn("h-4 w-4 transition-transform", isOpen && "rotate-90")}
            />
          </button>
        )}
      </div>
      {item.subItems && isExpanded && (
        <AnimatePresence initial={false}>
          {isOpen && (
            <motion.ul
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="ml-7 mt-2 space-y-1 border-l border-white/10 pl-4"
            >
              {item.subItems.map((subItem) => {
                const isSubActive = pathname === subItem.href;
                return (
                  <motion.li key={subItem.href} initial={{ x: -12, opacity: 0 }} animate={{ x: 0, opacity: 1 }}>
                    <Link
                      href={subItem.href}
                      className={cn(
                        "flex items-center rounded-xl px-3 py-2 text-xs font-medium transition-colors",
                        isSubActive
                          ? "bg-white/15 text-white shadow-inner"
                          : "text-white/60 hover:bg-white/5 hover:text-white"
                      )}
                    >
                      {subItem.label}
                    </Link>
                  </motion.li>
                );
              })}
            </motion.ul>
          )}
        </AnimatePresence>
      )}
    </motion.li>
  );
};

export function AdminLayout({ children, roles, firstName }: AdminLayoutProps) {
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const pathname = usePathname();
  const [selectedRole, setSelectedRole] = useState(roles.includes('Admin') ? 'Admin' : roles[0] || '');
  const [isLoading, setIsLoading] = useState(true);
  const { mode: assistantMode, isSidebarOpen: assistantSidebarOpen, setSidebarOpen } = useAssistantUIStore();

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  const toggleSidebar = () => setIsSidebarExpanded(!isSidebarExpanded);

  const navItems: NavItem[] = [
    { href: '/admin', icon: LayoutDashboard, label: 'Dashboard', roles: ['Admin'] },
    { href: '/admin/posts', icon: FileText, label: 'Posts', roles: ['Admin', 'pr'] },
    {
      href: '/admin/shop',
      icon: Store,
      label: 'Shop',
      roles: ['Admin', 'finance'],
      subItems: [
        { href: '/admin/shop/orders', label: 'Orders', roles: ['Admin', 'finance'] },
        { href: '/admin/shop/products', label: 'Products', roles: ['Admin', 'finance'] },
        { href: '/admin/shop/customers', label: 'Customers', roles: ['Admin', 'finance'] },
        { href: '/admin/shop/settings', label: 'Settings', roles: ['Admin'] },
      ],
    },
    
    {
      href: '/admin/expenses',
      icon: CalendarIcon,
      label: 'Expenses',
      roles: ['Admin', 'finance'],
    },
    {
      href: '/admin/jobs',
      icon: Users,
      label: 'Jobs',
      roles: ['Admin', 'hr', 'pr'],
      subItems: [
        { href: '/admin/jobs', label: 'All jobs', roles: ['Admin', 'hr', 'pr'] },
        { href: '/admin/jobs/applications', label: 'Applications', roles: ['Admin', 'hr', 'pr'] },
      ],
    },
    {
      href: '/admin/events',
      icon: CalendarIcon,
      label: 'Events',
      roles: ['Admin', 'pr'],
      subItems: [
        { href: '/admin/events', label: 'All events', roles: ['Admin', 'pr'] },
        { href: '/admin/events/new', label: 'Create event', roles: ['Admin', 'pr'] },
      ],
    },
    /*
    {
      href: '/admin/alumni',
      icon: Users,
      label: 'Alumni',
      roles: ['Admin'],
      subItems: [
        { href: '/admin/alumni/mentors', label: 'Mentor Approvals', roles: ['Admin'] },
      ],
    },
    */
    {
      href: '/admin/units',
      icon: Building2,
      label: 'Units',
      roles: ['Admin', 'hr', 'finance', 'pr'],
    },
    { href: '/admin/users', icon: Users, label: 'Users', roles: ['Admin', 'hr', 'finance'] },
    { href: '/admin/varsling', icon: Shield, label: 'Varsling', roles: ['Admin'] },
    {
      href: '/admin/settings',
      icon: Settings,
      label: 'Settings',
      roles: ['Admin'],
      subItems: [
        { href: '/admin/settings', label: 'Navigation', roles: ['Admin'] },
        { href: '/admin/settings/profile', label: 'Profile', roles: ['Admin'] },
        { href: '/admin/settings/security', label: 'Security', roles: ['Admin'] },
      ],
    },
  ];
  

  const hasAccess = (itemRoles: string[]) => selectedRole ? itemRoles.includes(selectedRole) : false;


  const handleSignOut = async () => {
    setIsLoading(true);
    try {
      await signOut();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative isolate flex min-h-screen overflow-hidden bg-linear-to-br from-primary-10/25 via-slate-50 to-secondary-10/40 dark:from-background dark:via-card dark:to-background">
      <div className="pointer-events-none absolute inset-0 bg-grid-primary-soft opacity-40 dark:opacity-20" />
      <div className="pointer-events-none absolute -left-20 top-[-18%] h-72 w-72 rounded-full bg-secondary-20/60 dark:bg-primary/30 blur-[140px]" />
      <div className="pointer-events-none absolute bottom-[-25%] right-[-10%] h-80 w-80 rounded-full bg-gold-muted/45 dark:bg-secondary-100/20 blur-[160px]" />

      <div className="relative z-10 flex h-screen w-full gap-4 overflow-hidden p-4">
        <motion.nav
          initial={false}
          animate={{ width: isSidebarExpanded ? 268 : 88 }}
          className="relative flex h-full shrink-0 flex-col overflow-hidden rounded-[26px] border border-primary-100/30 bg-primary-100/95 text-white shadow-[0_45px_80px_-45px_rgba(0,23,49,0.9)]"
        >
          <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(61,169,224,0.25),transparent_60%)]" />
          <div className="relative flex h-full flex-col">
            <div className="flex-1 overflow-y-auto pb-6">
              <motion.div
                className="flex items-center gap-3 px-4 pb-4 pt-5"
                initial={false}
                animate={{ justifyContent: isSidebarExpanded ? "flex-start" : "center" }}
              >
                <Link href="/admin" className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-lg font-semibold tracking-tight text-white">
                  B
                </Link>
                {isSidebarExpanded && (
                  <div className="space-y-0.5">
                    <span className="text-xs uppercase tracking-[0.2em] text-white/60">BISO Admin</span>
                    <span className="text-base font-semibold leading-none text-white">Control Center</span>
                  </div>
                )}
              </motion.div>
              <div className="px-4">
                <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3">
                  <p className="text-[0.65rem] uppercase tracking-[0.24em] text-white/60">Aktiv rolle</p>
                  <p className="text-sm font-medium text-white">{selectedRole}</p>
                </div>
              </div>
              <ul className="mt-6 space-y-1 px-2">
                <AnimatePresence mode="wait">
                  {navItems.map((item) => {
                    if (!hasAccess(item.roles)) return null;

                    const isActive =
                      item.href === "/admin"
                        ? pathname === "/admin" || pathname === "/admin/"
                        : pathname.startsWith(item.href);

                    return (
                      <SidebarItem
                        key={item.href}
                        item={item}
                        isActive={isActive}
                        isExpanded={isSidebarExpanded}
                        pathname={pathname}
                      />
                    );
                  })}
                </AnimatePresence>
              </ul>
            </div>
            <div className="space-y-3 px-4 pb-4">
              <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-xs text-white/70">
                <p className="font-semibold text-white">Supportlinje</p>
                <p className="mt-1 text-white/70">support@biso.no</p>
              </div>
              <button
                onClick={toggleSidebar}
                className="flex h-11 w-full items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-sm font-medium text-white/80 transition hover:bg-white/20"
              >
                <motion.div animate={{ rotate: isSidebarExpanded ? 0 : 180 }} transition={{ duration: 0.25 }}>
                  <ChevronLeft className="h-5 w-5" />
                </motion.div>
                {isSidebarExpanded && <span className="ml-2">Collapse</span>}
              </button>
            </div>
          </div>
        </motion.nav>

        <div className="flex flex-1 flex-col overflow-hidden rounded-[32px] bg-white/85 dark:bg-card/85 shadow-[0_45px_80px_-60px_rgba(0,23,49,0.35)] dark:shadow-[0_45px_80px_-60px_rgba(61,169,224,0.15)] backdrop-blur-xl">
          <header className="sticky top-0 z-20 flex flex-col gap-4 border-b border-primary/10 dark:border-primary/20 bg-white/85 dark:bg-card/85 px-6 py-4 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:gap-6 lg:px-10">
          <div className="flex flex-col gap-2">
            <span className="text-xs uppercase tracking-[0.22em] text-primary-60">
              {isLoading ? "Laster..." : `Velkommen tilbake`}
            </span>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-2xl font-semibold text-primary-100">
                {isLoading ? <Skeleton className="h-8 w-32" /> : firstName}
              </span>
              {roles.includes("Admin") && (
                <RoleSwitcher roles={roles} selectedRole={selectedRole} setSelectedRole={setSelectedRole} />
              )}
            </div>
            <div className="rounded-full border border-primary/10 dark:border-primary/20 bg-primary/5 dark:bg-primary/10 px-4 py-1 text-xs font-medium text-primary-70 dark:text-primary">
              <Breadcrumb />
            </div>
          </div>

          <div className="flex flex-1 flex-wrap items-center justify-end gap-3">
            <CommandMenu />
            <NotificationsDropdown />
            <ModeToggle />
            <Avatar className="h-10 w-10 border border-primary/10 dark:border-primary/20 shadow-sm">
              <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${firstName}`} />
              <AvatarFallback>{firstName.charAt(0)}</AvatarFallback>
            </Avatar>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-xl border border-primary/10 dark:border-primary/20 bg-primary-10/60 dark:bg-card/70 text-primary-80 dark:text-primary hover:bg-primary/10 dark:hover:bg-primary/15"
              onClick={handleSignOut}
              disabled={isLoading}
            >
              {isLoading ? (
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                  <LogOut className="h-5 w-5" />
                </motion.div>
              ) : (
                <LogOut className="h-5 w-5" />
              )}
            </Button>
          </div>
        </header>

        <main className="relative flex-1">
          <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-primary-10/18 via-transparent to-secondary-10/30" />
          {assistantMode === "sidebar" && assistantSidebarOpen ? (
            <ResizablePanelGroup direction="horizontal" className="relative z-10 h-full">
              <ResizablePanel defaultSize={70} minSize={40} className="min-w-0">
                <div className="h-full overflow-y-auto px-6 py-6 lg:px-10 lg:py-8">
                  {children}
                </div>
              </ResizablePanel>
              <ResizableHandle className="bg-primary/10" />
              <ResizablePanel defaultSize={30} minSize={22} maxSize={50} className="min-w-[280px] bg-white/70 backdrop-blur-xl">
                <div className="flex h-full flex-col border-l border-primary/10">
                  <div className="flex items-center justify-between border-b border-primary/10 px-4 py-3">
                    <span className="text-sm font-semibold text-primary-90">Admin Assistant</span>
                    <Button variant="outline" size="sm" onClick={() => setSidebarOpen(false)}>
                      Close
                    </Button>
                  </div>
                  <div className="flex-1 min-h-0">
                    <AssistantSidebar open={assistantSidebarOpen} onOpenChange={setSidebarOpen} docked />
                  </div>
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          ) : (
            <div className="relative z-10 h-full overflow-y-auto px-6 py-6 lg:px-10 lg:py-8">
              {children}
            </div>
          )}
          <div className="fixed bottom-6 right-6 z-40">
            <AssistantModal />
          </div>
        </main>
        </div>
      </div>
    </div>
  );
}
