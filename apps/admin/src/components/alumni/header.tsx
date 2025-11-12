"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import Image from "next/image"
import { Menu, Bell, Search, UserCircle } from "lucide-react"
import { Button } from "@repo/ui/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu"
import { MobileNav } from "./mobile-nav"
import { useState, useEffect } from "react"
import { cn } from '@repo/ui/lib/utils'
import { clientFunctions } from "@repo/api/client"
import { SearchPanel } from "@/components/search/SearchPanel"

export function AlumniHeader() {
  const pathname = usePathname()
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [commandOpen, setCommandOpen] = useState(false)
  
  // Handle keyboard shortcut for command palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setCommandOpen(true)
      }
    }
    
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])
  
  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-40 border-b border-secondary-100/10 bg-primary-90/70 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-4">
            <Button
              variant="glass-dark"
              size="icon"
              className="md:hidden"
              onClick={() => setShowMobileMenu(true)}
            >
              <Menu className="h-5 w-5 text-secondary-100" />
              <span className="sr-only">Toggle menu</span>
            </Button>
            <Link href="/alumni" className="hidden md:flex items-center gap-2 group">
              <Image 
                src="/images/biso-dare-to-be-more-dark.png" 
                alt="BISO Alumni" 
                width={160} 
                height={50} 
                className="group-hover:opacity-80 transition-opacity"
              />
            </Link>
          </div>
          
          <div className="hidden md:flex items-center gap-6">
            <Button 
              variant="glass-dark" 
              className="relative w-64 justify-between px-3 text-gray-400 border-secondary-100/20 hover:border-secondary-100/30"
              onClick={() => setCommandOpen(true)}
            >
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-secondary-100" />
                <span>Search anything...</span>
              </div>
              <div className="flex items-center gap-1">
                <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border border-secondary-100/30 bg-primary-80/50 px-1.5 font-mono text-xs font-medium opacity-100 sm:flex">
                  <span className="text-xs">⌘</span>K
                </kbd>
              </div>
            </Button>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="glass-dark"
              size="icon"
              className="md:hidden relative"
              onClick={() => setCommandOpen(true)}
            >
              <Search className="h-5 w-5 text-secondary-100" />
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="glass-dark"
                  size="icon"
                  className="relative group"
                >
                  <Bell className="h-5 w-5 text-gray-300 group-hover:text-secondary-100 transition-colors" />
                  <span className="absolute top-1.5 right-1.5 flex h-2 w-2 rounded-full bg-blue-accent animate-pulse"></span>
                  <span className="sr-only">Notifications</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[300px] glass-dark border-secondary-100/20">
                <DropdownMenuLabel className="text-secondary-100">Notifications</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-secondary-100/20" />
                <div className="flex flex-col gap-2 p-2">
                  <p className="text-sm text-gray-300 text-center py-4">You have no new notifications</p>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="glass-dark" size="icon" className="group">
                  <UserCircle className="h-5 w-5 text-gray-300 group-hover:text-secondary-100 transition-colors" />
                  <span className="sr-only">User account</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="glass-dark border-secondary-100/20">
                <DropdownMenuLabel className="text-secondary-100">My Account</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-secondary-100/20" />
                <DropdownMenuItem asChild>
                  <Link href="/alumni/profile" className="text-gray-300 hover:text-white focus:text-white focus:bg-blue-accent/20">Profile</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/alumni/settings" className="text-gray-300 hover:text-white focus:text-white focus:bg-blue-accent/20">Settings</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-secondary-100/20" />
                <DropdownMenuItem className="text-gray-300 hover:text-white focus:text-white focus:bg-blue-accent/20">
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <MobileNav open={showMobileMenu} onOpenChange={setShowMobileMenu} />
      </header>
      
      {/* Global search panel - moved outside header */}
      <SearchPanel 
        isOpen={commandOpen} 
        onOpenChange={setCommandOpen} 
      />
    </>
  )
} 