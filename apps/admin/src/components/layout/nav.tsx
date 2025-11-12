'use client';
import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Menu, X, Calendar, Users, Info, Newspaper, Mail, Briefcase, ShoppingBag } from 'lucide-react';
import { Button } from '@repo/ui/components/ui/button';
import { ImageWithFallback } from '@repo/ui/components/image';
import Link from 'next/link';
import { SelectCampus } from '@/components/select-campus';
import { useCampus } from '@/components/context/campus';
import { usePathname } from 'next/navigation';

interface NavigationProps {
  onEventsClick?: () => void;
  onNewsClick?: () => void;
  onApplyClick?: () => void;
  onShopClick?: () => void;
}

export function Navigation({ onEventsClick, onNewsClick, onApplyClick, onShopClick }: NavigationProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { campuses } = useCampus();
  const pathname = usePathname();
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const isActive = (href: string) => pathname === href;

  const navItems = useMemo(() => [
    { icon: Users, label: 'Campus', href: '/campus', onClick: undefined },
    { icon: Calendar, label: 'Events', href: '/events', onClick: onEventsClick },
    { icon: Newspaper, label: 'News', href: '/news', onClick: onNewsClick },
    { icon: ShoppingBag, label: 'Shop', href: '/shop', onClick: onShopClick },
    { icon: Briefcase, label: 'Apply Here', href: '/jobs', onClick: onApplyClick, highlight: true },
    //{ icon: Mail, label: 'Contact', href: '#contact', onClick: undefined },
    { icon: Info, label: 'About', href: '#about', onClick: undefined },
  ], [pathname]);

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'bg-[#001731]/95 backdrop-blur-lg shadow-lg shadow-[#3DA9E0]/10'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <motion.div whileHover={{ scale: 1.05 }} className="flex items-center gap-3">
            <Link href="/">
            <ImageWithFallback
              src="/images/logo-home.png"
              alt="BISO logo"
              width={140}               // pick the intrinsic pixel width
              height={40}               // and height that matches your asset ratio
              sizes="(max-width: 768px) 120px, 140px"
              preload                   // above-the-fold
              className="h-10 w-auto"    // control display size via CSS
            />
            </Link>
          </motion.div>


          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            {navItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                onClick={(e) => {
                  if (item.onClick) {
                    e.preventDefault();
                    item.onClick();
                  }
                }}
                className={`flex items-center gap-2 transition-colors duration-300 hover:text-[#3DA9E0] cursor-pointer ${
                  isActive(item.href) 
                    ? 'px-4 py-2 rounded-lg bg-linear-to-r from-[#3DA9E0]/20 to-[#001731]/20 border border-[#3DA9E0]/30 hover:from-[#3DA9E0]/30 hover:to-[#001731]/30'
                    : ''
                } ${
                  isScrolled ? 'text-white' : 'text-white'
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            ))}
            <SelectCampus campuses={campuses}/>
            <Link href="/partner">Partner</Link>
            <Button
              size="sm"
              className="bg-linear-to-r from-[#3DA9E0] to-[#001731] hover:from-[#3DA9E0]/90 hover:to-[#001731]/90 text-white border-0 shadow-lg"
            >
              Member Portal
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className={`md:hidden p-2 rounded-lg transition-colors duration-300 ${
              isScrolled ? 'text-white' : 'text-white'
            }`}
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>

        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-[#001731]/95 backdrop-blur-lg border-t border-[#3DA9E0]/20"
          >
            <div className="px-4 py-6 space-y-4">
              {navItems.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={(e) => {
                    if (item.onClick) {
                      e.preventDefault();
                      item.onClick();
                    }
                    setIsMobileMenuOpen(false);
                  }}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-[#3DA9E0]/10 text-white transition-colors cursor-pointer ${
                    isActive(item.href) 
                      ? 'bg-linear-to-r from-[#3DA9E0]/20 to-[#001731]/20 border border-[#3DA9E0]/30 hover:from-[#3DA9E0]/30 hover:to-[#001731]/30'
                      : ''
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </Link>
              ))}
              <SelectCampus campuses={campuses}/>
              <Button className="w-full bg-linear-to-r from-[#3DA9E0] to-[#001731] hover:from-[#3DA9E0]/90 hover:to-[#001731]/90 text-white border-0">
                Member Portal
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}
