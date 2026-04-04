import { Outlet } from "react-router";
import { Sidebar } from "./Sidebar";

export function AdminLayout() {
  return (
    <div className="flex h-screen w-full bg-[#000a16] text-white overflow-hidden selection:bg-[#3DA9E0]/30 selection:text-white">
      {/* Background ambient glows */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-[#001731] rounded-full blur-[120px] opacity-80" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#3DA9E0]/10 rounded-full blur-[150px]" />
      </div>
      
      <Sidebar />
      
      <main className="flex-1 h-screen overflow-y-auto relative z-10 custom-scrollbar">
        <div className="max-w-[1600px] mx-auto min-h-full p-8 md:p-12">
          <Outlet />
        </div>
      </main>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}</style>
    </div>
  );
}
