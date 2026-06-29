"use client";

import type { Campus } from "@repo/api/types/appwrite";
import { MapPin } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCampus } from "@/components/context/campus";

interface CampusLinkProps {
  campus: Campus;
  onNavigate: () => void;
}

export function CampusLink({ campus, onNavigate }: CampusLinkProps) {
  const { selectCampus } = useCampus();
  const router = useRouter();

  const handleClick = () => {
    // selectCampus persists the choice + refreshes server components; we don't
    // need to await it before routing to the campus overview.
    selectCampus(campus.$id);
    router.push("/campus");
    onNavigate();
  };

  return (
    <button
      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-white/80 transition-colors hover:bg-brand-muted hover:text-brand"
      onClick={handleClick}
      type="button"
    >
      <MapPin aria-hidden className="h-4 w-4 shrink-0 opacity-80" />
      {campus.name}
    </button>
  );
}
