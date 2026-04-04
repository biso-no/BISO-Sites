import {
  Briefcase,
  Building2,
  Calendar,
  Command,
  Gift,
  Layers,
  LayoutDashboard,
  LogOut,
  Newspaper,
  Settings,
  ShoppingCart,
} from "lucide-react";
import { motion } from "motion/react";
import { Link, useLocation } from "react-router";
import { MOCK_USER_IMAGE } from "../data";

const NAV_ITEMS = [
  { path: "/", label: "Overview", icon: LayoutDashboard },
  { path: "/pages", label: "Pages", icon: Layers },
  { path: "/departments", label: "Departments", icon: Building2 },
  { path: "/jobs", label: "Jobs", icon: Briefcase },
  { path: "/events", label: "Events", icon: Calendar },
  { path: "/shop", label: "Products", icon: ShoppingCart },
  { path: "/benefits", label: "Benefits", icon: Gift },
  { path: "/news", label: "News", icon: Newspaper },
];

export function Sidebar() {
  const location = useLocation();

  return (
    <div className="relative z-20 flex h-screen w-72 flex-col border-white/5 border-r bg-[#000a16]/80 backdrop-blur-xl">
      {/* Top Brand */}
      <div className="flex items-center justify-between p-8">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#3DA9E0] to-[#001731] shadow-[0_0_15px_rgba(61,169,224,0.4)]">
            <span className="font-bold text-white text-xs tracking-tighter">
              BISO
            </span>
          </div>
          <span className="font-semibold text-lg text-white tracking-wide">
            OS
          </span>
        </div>
        <div className="flex items-center gap-1 rounded-md border border-white/5 bg-white/5 px-2 py-1 font-mono text-white/40 text-xs">
          <Command size={12} /> K
        </div>
      </div>

      {/* Nav Links */}
      <nav className="mt-4 flex-1 space-y-2 px-4">
        {NAV_ITEMS.map((item) => {
          const isActive =
            location.pathname === item.path ||
            (item.path !== "/" && location.pathname.startsWith(item.path));

          return (
            <Link
              className="group relative flex items-center gap-3 rounded-xl px-4 py-3 transition-all"
              key={item.path}
              to={item.path}
            >
              {isActive && (
                <motion.div
                  animate={{ opacity: 1 }}
                  className="absolute inset-0 rounded-xl border border-white/10 bg-white/5"
                  initial={{ opacity: 0 }}
                  layoutId="sidebar-active"
                  transition={{ duration: 0.2 }}
                />
              )}
              {isActive && (
                <div className="absolute top-1/2 left-0 h-6 w-1 -translate-y-1/2 rounded-r-full bg-[#3DA9E0] shadow-[0_0_10px_#3DA9E0]" />
              )}
              <item.icon
                className={`relative z-10 transition-colors ${isActive ? "text-[#3DA9E0]" : "text-white/40 group-hover:text-white/80"}`}
                size={18}
              />
              <span
                className={`relative z-10 font-medium text-sm transition-colors ${isActive ? "text-white" : "text-white/50 group-hover:text-white/90"}`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom Actions */}
      <div className="border-white/5 border-t p-4">
        <Link
          className="flex items-center gap-3 rounded-xl px-4 py-3 text-white/50 transition-all hover:bg-white/5 hover:text-white"
          to="/settings"
        >
          <Settings size={18} />
          <span className="font-medium text-sm">Settings</span>
        </Link>
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-white/5 bg-white/5 px-4 py-3">
          <img
            alt="User"
            className="h-9 w-9 rounded-full border border-white/10 object-cover"
            src={MOCK_USER_IMAGE}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-sm text-white">
              Alex Editor
            </p>
            <p className="truncate font-mono text-[#3DA9E0] text-xs">
              Superadmin
            </p>
          </div>
          <button className="text-white/40 transition-colors hover:text-white">
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
