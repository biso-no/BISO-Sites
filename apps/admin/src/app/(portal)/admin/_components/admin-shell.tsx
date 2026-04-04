"use client";

import { Sidebar } from "../sidebar";
import type { UserRolesForClient } from "@/lib/authorization";

type AdminShellUser = {
  id: string;
  name: string | null;
  email: string | null;
  avatar: string | null;
  roleLabel: string;
};

type AdminShellProps = {
  children: React.ReactNode;
  user: AdminShellUser;
  roles: UserRolesForClient;
};

export function AdminShell({ children, user, roles }: AdminShellProps) {
  return (
    <div
      className="flex h-screen w-full overflow-hidden"
      style={{
        background: "#000a16",
        color: "white",
      }}
    >
      {/* Ambient background glows */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div
          className="absolute rounded-full"
          style={{
            top: "-20%",
            left: "-10%",
            width: "50%",
            height: "50%",
            background: "#001731",
            filter: "blur(120px)",
            opacity: 0.8,
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            bottom: "-10%",
            right: "-10%",
            width: "40%",
            height: "40%",
            background: "rgba(61,169,224,0.10)",
            filter: "blur(150px)",
          }}
        />
      </div>

      <Sidebar user={user} roles={roles} />

      <main
        className="flex-1 h-screen overflow-y-auto relative z-10 portal-scrollbar"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <div className="max-w-[1600px] mx-auto min-h-full p-8 md:p-12">
          {children}
        </div>
      </main>

      {/* Custom scrollbar CSS scoped to portal shell */}
      <style>{`
        .portal-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .portal-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .portal-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.10);
          border-radius: 10px;
        }
        .portal-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255,255,255,0.20);
        }
      `}</style>
    </div>
  );
}
