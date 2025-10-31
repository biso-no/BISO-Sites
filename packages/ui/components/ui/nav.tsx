"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Receipt, 
  User, 
  Settings, 
  LogOut,
  Menu,
  X,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Button } from '@repo/ui/components/ui/button';
import { signOut } from '@/lib/actions/user';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { CookieConsent } from '@/components/cookie-consent';

interface UserLayoutProps {
  children: React.ReactNode;
}

const navigation = [
  { name: 'Expenses', href: '/expenses', icon: Receipt },
  { name: 'Profile', href: '/expenses/profile', icon: User },
  //{ name: 'Settings', href: '/settings', icon: Settings },
];

const handleLogout = async () => {
  await signOut();
}

const UserLayout = ({ children }: UserLayoutProps) => {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  
  // Close mobile menu on resize to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsMobileMenuOpen(false);
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Cookie Consent */}
      <CookieConsent />
      
      {/* Desktop Sidebar */}
      <div className={cn(
        "hidden lg:fixed lg:inset-y-0 lg:flex lg:flex-col z-30 transition-all duration-300 ease-in-out",
        isCollapsed ? "lg:w-20" : "lg:w-72"
      )}>
        <div className="flex flex-col grow bg-white border-r border-gray-100 shadow-sm h-full">
          {/* Header/Logo */}
          <div className="flex items-center justify-between h-20 shrink-0 px-5 bg-white border-b border-gray-100">
            {isCollapsed ? (
              <Image 
                src="/images/logo-light.png" 
                alt="BI Student Organisation" 
                width={40} 
                height={40} 
                className="mx-auto"
              />
            ) : (
              <Image 
                src="/images/logo-home.png" 
                alt="BI Student Organisation" 
                width={160} 
                height={40} 
                className="h-10 w-auto"
              />
            )}
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "rounded-full p-1 hover:bg-gray-100", 
                isCollapsed ? "-mr-2.5" : "ml-2"
              )}
              onClick={() => setIsCollapsed(!isCollapsed)}
            >
              {isCollapsed ? (
                <ChevronRight className="h-5 w-5 text-gray-500" />
              ) : (
                <ChevronLeft className="h-5 w-5 text-gray-500" />
              )}
            </Button>
          </div>

          {/* Navigation Links */}
          <div className="flex flex-col grow px-4 py-6 overflow-y-auto">
            <nav className="flex-1 space-y-2">
              {navigation.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      "flex items-center px-4 py-3 rounded-xl transition-all duration-200",
                      isCollapsed ? "justify-center" : "justify-start",
                      isActive 
                        ? "bg-blue-50 text-blue-700 shadow-sm" 
                        : "text-gray-700 hover:bg-gray-50 hover:text-blue-600"
                    )}
                    title={isCollapsed ? item.name : ""}
                  >
                    <item.icon className={cn(
                      "h-5 w-5",
                      isCollapsed ? "" : "mr-3",
                      isActive ? "text-blue-600" : "text-gray-500"
                    )} />
                    {!isCollapsed && (
                      <span className="font-medium text-sm">
                        {item.name}
                      </span>
                    )}
                    {isActive && !isCollapsed && (
                      <motion.div
                        className="absolute left-0 w-1 h-8 bg-blue-600 rounded-r-full"
                        layoutId="activeIndicator"
                      />
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* Logout Button */}
            <div className="mt-auto pt-6 border-t border-gray-100">
              <Button
                variant="ghost"
                className={cn(
                  "w-full rounded-xl py-3 transition-colors duration-200 text-gray-700 hover:bg-gray-50 hover:text-blue-600",
                  isCollapsed ? "justify-center px-0" : "justify-start px-4"
                )}
                onClick={handleLogout}
                title={isCollapsed ? "Logout" : ""}
              >
                <LogOut className={cn(
                  "h-5 w-5", 
                  isCollapsed ? "" : "mr-3", 
                  "text-gray-500"
                )} />
                {!isCollapsed && (
                  <span className="font-medium text-sm">Logout</span>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Header */}
      <div className="lg:hidden fixed w-full z-20">
        <div className="flex items-center justify-between h-16 px-4 bg-white border-b border-gray-100 shadow-sm">
          <div className="flex items-center">
            <Image 
              src="/images/logo-light.png" 
              alt="BI Student Organisation" 
              width={40} 
              height={40} 
              className="mr-3"
            />
            <h1 className="text-lg font-bold text-gray-900">BISO</h1>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full p-1 hover:bg-gray-100"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? (
              <X className="h-6 w-6 text-gray-700" />
            ) : (
              <Menu className="h-6 w-6 text-gray-700" />
            )}
          </Button>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-10 pt-16 bg-white/95 backdrop-blur-sm"
            >
              <div className="flex flex-col h-full">
                <div className="flex-1 overflow-y-auto py-6 px-6">
                  <nav className="space-y-4">
                    {navigation.map((item) => {
                      const isActive = pathname === item.href;
                      return (
                        <Link
                          key={item.name}
                          href={item.href}
                          className={cn(
                            "flex items-center px-5 py-4 text-base font-medium rounded-xl transition-all",
                            isActive 
                              ? "bg-blue-50 text-blue-700 shadow-sm" 
                              : "text-gray-700 hover:bg-gray-50"
                          )}
                          onClick={() => setIsMobileMenuOpen(false)}
                        >
                          <item.icon className={cn(
                            "h-6 w-6 mr-4",
                            isActive ? "text-blue-600" : "text-gray-500"
                          )} />
                          {item.name}
                          {isActive && (
                            <motion.div
                              className="absolute left-0 w-1 h-12 bg-blue-600 rounded-r-full"
                              layoutId="mobileActiveIndicator"
                            />
                          )}
                        </Link>
                      );
                    })}
                  </nav>
                </div>
                
                <div className="p-6 border-t border-gray-100">
                  <Button
                    variant="ghost"
                    className="w-full justify-start px-5 py-4 text-base font-medium rounded-xl text-gray-700 hover:bg-gray-50"
                    onClick={async () => {
                      setIsMobileMenuOpen(false);
                      await handleLogout();
                    }}
                  >
                    <LogOut className="h-6 w-6 mr-4 text-gray-500" />
                    Logout
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Main Content */}
      <div className={cn(
        "transition-all duration-300 ease-in-out",
        isCollapsed ? "lg:pl-20" : "lg:pl-72",
        "pt-16 lg:pt-0"
      )}>
        <main className="min-h-screen">
          {children}
        </main>
      </div>
    </div>
  );
};

export default UserLayout;