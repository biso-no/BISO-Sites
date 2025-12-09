"use client";

import type { Campus } from "@repo/api/types/appwrite";
import { Button } from "@repo/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import { cn } from "@repo/ui/lib/utils";
import { Check, ChevronDown } from "lucide-react";
import { useState } from "react";
import { useCampus } from "./context/campus";

type SelectCampusProps = {
  campuses: Campus[]; // kept for API compatibility; context campuses take precedence
  placeholder?: string;
  className?: string;
  variant?: "default" | "ghost" | "outline";
  size?: "sm" | "default" | "lg";
  showText?: boolean;
};

export const SelectCampus = ({
  campuses: campusesProp,
  placeholder = "Velg campus",
  className,
  variant = "ghost",
  size = "default",
  showText = true,
}: SelectCampusProps) => {
  const {
    campuses: campusesFromContext,
    activeCampusId,
    selectCampus,
    loading,
  } = useCampus();

  const [isOpen, setIsOpen] = useState(false);

  const campuses = campusesFromContext?.length
    ? campusesFromContext
    : campusesProp;

  const selectedId = activeCampusId ?? "all";
  const selectedCampus =
    selectedId === "all"
      ? null
      : (campuses.find((c) => c.$id === selectedId) ?? null);

  const label = selectedCampus?.name ?? placeholder;

  const handleCampusChange = async (value: string) => {
    if (value === selectedId) {
      return;
    }
    try {
      await selectCampus(value);
    } catch (e) {
      console.error("Failed to change campus:", e);
    }
  };

  return (
    <DropdownMenu onOpenChange={setIsOpen} open={isOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          aria-expanded={isOpen}
          aria-haspopup="menu"
          aria-label="Velg campus"
          className={cn(
            "relative gap-2 transition-all duration-200",
            "hover:scale-[1.02] hover:bg-accent/50",
            "data-[state=open]:bg-accent/70",
            "focus:ring-2 focus:ring-primary focus:ring-offset-2",
            loading && "cursor-not-allowed opacity-50",
            className
          )}
          disabled={loading}
          size={size}
          variant={variant}
        >
          {showText && <span className="font-medium">{label}</span>}

          <ChevronDown
            className={cn(
              "h-3 w-3 transition-transform duration-200",
              isOpen && "rotate-180"
            )}
          />

          {loading && (
            <div className="absolute inset-0 flex items-center justify-center rounded-md bg-background/50">
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="center"
        aria-label="Velg campus"
        className={cn(
          "min-w-[220px] p-2",
          "fade-in-0 zoom-in-95 animate-in duration-200",
          "border shadow-lg backdrop-blur-sm"
        )}
        role="menu"
      >
        <DropdownMenuItem
          aria-current={selectedId === "all" ? "true" : "false"}
          className={cn(
            "flex cursor-pointer items-center gap-3 px-3 py-2.5",
            "transition-all duration-150",
            "hover:bg-accent/50 focus:bg-accent/50",
            "rounded-md",
            "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-inset",
            selectedId === "all" &&
              "bg-accent/30 font-medium text-accent-foreground",
            loading && "cursor-not-allowed opacity-50"
          )}
          disabled={loading || selectedId === "all"}
          onClick={() => handleCampusChange("all")}
          role="menuitem"
        >
          <div className="flex flex-1 flex-col gap-0.5">
            <span className="font-medium text-sm">All Campuses</span>
            <span className="text-muted-foreground text-xs">
              Vis alt innhold
            </span>
          </div>

          {selectedId === "all" && (
            <Check className="zoom-in-50 h-4 w-4 animate-in text-primary duration-200" />
          )}
        </DropdownMenuItem>

        {campuses.map((campus) => {
          const isSelected = campus.$id === selectedId;

          return (
            <DropdownMenuItem
              aria-current={isSelected ? "true" : "false"}
              className={cn(
                "flex cursor-pointer items-center gap-3 px-3 py-2.5",
                "transition-all duration-150",
                "hover:bg-accent/50 focus:bg-accent/50",
                "rounded-md",
                "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-inset",
                isSelected && "bg-accent/30 font-medium text-accent-foreground",
                loading && "cursor-not-allowed opacity-50"
              )}
              disabled={loading || isSelected}
              key={campus.$id}
              onClick={() => handleCampusChange(campus.$id)}
              role="menuitem"
            >
              <div className="flex flex-1 flex-col gap-0.5">
                <span className="font-medium text-sm">{campus.name}</span>
              </div>

              {isSelected && (
                <Check className="zoom-in-50 h-4 w-4 animate-in text-primary duration-200" />
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
