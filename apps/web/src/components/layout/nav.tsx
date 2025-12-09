"use client";
import { ImageWithFallback } from "@repo/ui/components/image";
import { Button } from "@repo/ui/components/ui/button";
import {
 Briefcase,
 Calendar,
 Info,
 Menu,
 Newspaper,
 ShoppingBag,
 Users,
 X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { useCampus } from "@/components/context/campus";
import { SelectCampus } from "@/components/select-campus";
import { LocaleSwitcher } from "../locale-switcher";
import { ModeToggle } from "@repo/ui/components/mode-toggle";

type NavigationProps = {
 onEventsClick?: () => void;
 onNewsClick?: () => void;
 onApplyClick?: () => void;
 onShopClick?: () => void;
};

export function Navigation({
 onEventsClick,
 onNewsClick,
 onApplyClick,
 onShopClick,
}: NavigationProps) {
 const [isScrolled, setIsScrolled] = useState(false);
 const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
 const { campuses } = useCampus();
 const pathname = usePathname();
 const t = useTranslations("common.navigation");
 const router = useRouter();
 useEffect(() => {
 const handleScroll = () => {
 setIsScrolled(window.scrollY > 50);
 };
 window.addEventListener("scroll", handleScroll);
 return () => window.removeEventListener("scroll", handleScroll);
 }, []);

 const isActive = (href: string) => pathname === href;

 const navItems = useMemo(
 () => [
 { icon: Users, label: t("campus"), href: "/campus", onClick: undefined },
 {
 icon: Calendar,
 label: t("events"),
 href: "/events",
 onClick: onEventsClick,
 },
 {
 icon: Newspaper,
 label: t("news"),
 href: "/news",
 onClick: onNewsClick,
 },
 {
 icon: ShoppingBag,
 label: t("shop"),
 href: "/shop",
 onClick: onShopClick,
 },
 {
 icon: Briefcase,
 label: t("applyHere"),
 href: "/jobs",
 onClick: onApplyClick,
 highlight: true,
 },
 //{ icon: Mail, label: 'Contact', href: '#contact', onClick: undefined },
 { icon: Info, label: t("about"), href: "#about", onClick: undefined },
 ],
 [onApplyClick, onEventsClick, onNewsClick, onShopClick, t]
 );

 return (
 <motion.nav
 animate={{ y: 0 }}
 className={`fixed top-0 right-0 left-0 z-50 transition-all duration-300 ${
 isScrolled
 ? "bg-nav-background shadow-brand/10 shadow-lg backdrop-blur-lg"
 : "bg-transparent"
 }`}
 initial={{ y: -100 }}
 >
 <div className="mx-auto w-full max-w-[min(1400px,100%)] px-4 sm:px-6 lg:px-8">
 <div className="flex h-20 flex-wrap items-center justify-between gap-4">
 {/* Logo */}
 <motion.div
 className="flex items-center gap-3"
 whileHover={{ scale: 1.05 }}
 >
 <Link href="/">
 <ImageWithFallback
 alt="BISO logo"
 className="h-10 w-auto"
 height={40} // pick the intrinsic pixel width
 sizes="(max-width: 768px) 120px, 140px" // and height that matches your asset ratio
 src="/images/home-logo.png" // above-the-fold
 width={140} // control display size via CSS
 />
 </Link>
 </motion.div>

 {/* Desktop Navigation */}
 <div className="hidden flex-1 flex-wrap items-center justify-end gap-6 md:flex">
 {navItems.map((item) => (
 <Link
 className={`flex cursor-pointer items-center gap-2 transition-colors duration-300 hover:text-brand ${
 isActive(item.href)
 ? "rounded-lg border border-brand-border-strong bg-linear-to-r from-brand-muted-strong to-brand-muted-strong px-4 py-2 hover:from-brand-muted-strong hover:to-brand-muted-strong"
 : ""
 } ${isScrolled ? "text-white" : "text-white"}`}
 href={item.href}
 key={item.label}
 onClick={(e) => {
 if (item.onClick) {
 e.preventDefault();
 item.onClick();
 }
 }}
 >
 <item.icon className="h-4 w-4" />
 {item.label}
 </Link>
 ))}
 <SelectCampus campuses={campuses} className="text-white" />
 <ModeToggle className="text-white" />
 <LocaleSwitcher className="text-white" size="sm" variant="ghost" />
 <Link className="text-white hover:text-brand" href="/partner">{t("partner")}</Link>
 <Button
 className="border-brand bg-transparent text-white hover:bg-brand hover:text-white"
 onClick={() => router.push("/member")}
 size="sm"
 variant="outline"
 >
 {t("memberPortal")}
 </Button>
 </div>

 {/* Mobile Menu Button */}
 <div className="flex items-center gap-2 md:hidden">
 <ModeToggle className="text-white" />
 <Button
 className={`rounded-lg p-2 transition-colors duration-300 ${
 isScrolled ? "text-white" : "text-white"
 }`}
 onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
 variant="ghost"
 >
 {isMobileMenuOpen ? (
 <X className="h-6 w-6" />
 ) : (
 <Menu className="h-6 w-6" />
 )}
 </Button>
 </div>
 </div>
 </div>

 {/* Mobile Menu */}
 <AnimatePresence>
 {isMobileMenuOpen && (
 <motion.div
 animate={{ opacity: 1, height: "auto" }}
 className="border-brand-border border-t bg-nav-background backdrop-blur-lg md:hidden"
 exit={{ opacity: 0, height: 0 }}
 initial={{ opacity: 0, height: 0 }}
 >
 <div className="space-y-4 px-4 py-6">
 {navItems.map((item) => (
 <Link
 className={`flex cursor-pointer items-center gap-3 rounded-lg px-4 py-3 text-white transition-colors hover:bg-brand-muted ${
 isActive(item.href)
 ? "border border-brand-border-strong bg-linear-to-r from-brand-muted-strong to-brand-muted-strong hover:from-brand-muted-strong hover:to-brand-muted-strong"
 : ""
 }`}
 href={item.href}
 key={item.label}
 onClick={(e) => {
 if (item.onClick) {
 e.preventDefault();
 item.onClick();
 }
 setIsMobileMenuOpen(false);
 }}
 >
 <item.icon className="h-5 w-5" />
 {item.label}
 </Link>
 ))}
 <SelectCampus campuses={campuses} className="text-white w-full" />
 <LocaleSwitcher className="text-white w-full" size="sm" variant="ghost" />
 <Button
 className="w-full border-brand bg-transparent text-white hover:bg-brand hover:text-white"
 onClick={() => router.push("/member")}
 variant="outline"
 >
 {t("memberPortal")}
 </Button>
 </div>
 </motion.div>
 )}
 </AnimatePresence>
 </motion.nav>
 );
}
