import { Link, useLocation } from "react-router";
import { motion } from "motion/react";
import { 
  LayoutDashboard, 
  Layers, 
  Building2,
  Briefcase, 
  Calendar, 
  ShoppingCart, 
  Gift,
  Newspaper, 
  Settings, 
  LogOut,
  Command
} from "lucide-react";
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
    <div className="w-72 h-screen flex flex-col border-r border-white/5 bg-[#000a16]/80 backdrop-blur-xl relative z-20">
      {/* Top Brand */}
      <div className="p-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#3DA9E0] to-[#001731] shadow-[0_0_15px_rgba(61,169,224,0.4)] flex items-center justify-center">
            <span className="text-white font-bold text-xs tracking-tighter">BISO</span>
          </div>
          <span className="text-white font-semibold tracking-wide text-lg">OS</span>
        </div>
        <div className="flex items-center gap-1 text-white/40 text-xs font-mono bg-white/5 px-2 py-1 rounded-md border border-white/5">
          <Command size={12} /> K
        </div>
      </div>

      {/* Nav Links */}
      <nav className="flex-1 px-4 space-y-2 mt-4">
        {NAV_ITEMS.map((item) => {
          const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
          
          return (
            <Link 
              key={item.path} 
              to={item.path}
              className="relative flex items-center gap-3 px-4 py-3 rounded-xl group transition-all"
            >
              {isActive && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute inset-0 bg-white/5 border border-white/10 rounded-xl"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2 }}
                />
              )}
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-[#3DA9E0] rounded-r-full shadow-[0_0_10px_#3DA9E0]" />
              )}
              <item.icon 
                size={18} 
                className={`relative z-10 transition-colors ${isActive ? 'text-[#3DA9E0]' : 'text-white/40 group-hover:text-white/80'}`} 
              />
              <span className={`relative z-10 text-sm font-medium transition-colors ${isActive ? 'text-white' : 'text-white/50 group-hover:text-white/90'}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom Actions */}
      <div className="p-4 border-t border-white/5">
        <Link to="/settings" className="flex items-center gap-3 px-4 py-3 rounded-xl text-white/50 hover:text-white hover:bg-white/5 transition-all">
          <Settings size={18} />
          <span className="text-sm font-medium">Settings</span>
        </Link>
        <div className="mt-4 flex items-center gap-3 px-4 py-3 bg-white/5 rounded-xl border border-white/5">
          <img src={MOCK_USER_IMAGE} alt="User" className="w-9 h-9 rounded-full object-cover border border-white/10" />
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">Alex Editor</p>
            <p className="text-[#3DA9E0] text-xs font-mono truncate">Superadmin</p>
          </div>
          <button className="text-white/40 hover:text-white transition-colors">
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
