"use client";

import type { Campus, Departments } from "@repo/api/types/appwrite";
import { Button } from "@repo/ui/components/ui/button";
import { cn } from "@repo/ui/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import {
  Building2,
  Check,
  ChevronRight,
  Loader2,
  MapPin,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { getCampusWithDepartments } from "@/app/actions/campus";

type AssignmentPickerProps = {
  campuses: Campus[];
  onComplete: (data: {
    campusId: string;
    campusName: string;
    departmentId: string;
    departmentName: string;
  }) => void;
  initialCampusId?: string;
  initialDepartmentId?: string;
};

type SelectionState = "campus" | "department" | "complete";

function getDepartmentBreadcrumbStyle(
  state: SelectionState,
  selectedDepartment: Departments | null
): string {
  const isActiveState = state === "department" || state === "complete";
  if (!isActiveState) {
    return "text-muted-foreground";
  }
  if (selectedDepartment) {
    return "text-primary";
  }
  return "font-medium text-foreground";
}

export function AssignmentPicker({
  campuses,
  onComplete,
  initialCampusId,
  initialDepartmentId,
}: AssignmentPickerProps) {
  const [state, setState] = useState<SelectionState>(
    initialCampusId && initialDepartmentId ? "complete" : "campus"
  );
  const [selectedCampus, setSelectedCampus] = useState<Campus | null>(
    campuses.find((c) => c.$id === initialCampusId) || null
  );
  const [departments, setDepartments] = useState<Departments[]>([]);
  const [selectedDepartment, setSelectedDepartment] =
    useState<Departments | null>(null);
  const [isLoadingDepartments, setIsLoadingDepartments] = useState(false);

  // Load departments when campus is selected
  useEffect(() => {
    if (!selectedCampus) {
      return;
    }

    setIsLoadingDepartments(true);
    getCampusWithDepartments(selectedCampus.$id)
      .then((result) => {
        if (result.success && result.campus) {
          const activeDepts = (result.campus.departments || []).filter(
            (d) => d.active !== false
          );
          setDepartments(activeDepts);

          // Auto-select if there's only one department
          if (activeDepts.length === 1 && activeDepts[0]) {
            setSelectedDepartment(activeDepts[0]);
            setState("complete");
          } else {
            setState("department");
          }
        }
      })
      .finally(() => setIsLoadingDepartments(false));
  }, [selectedCampus]);

  // Auto-complete when both are selected
  useEffect(() => {
    if (state === "complete" && selectedCampus && selectedDepartment) {
      onComplete({
        campusId: selectedCampus.$id,
        campusName: selectedCampus.name,
        departmentId: selectedDepartment.$id,
        departmentName: selectedDepartment.Name,
      });
    }
  }, [state, selectedCampus, selectedDepartment, onComplete]);

  const handleCampusSelect = (campus: Campus) => {
    setSelectedCampus(campus);
    setSelectedDepartment(null);
  };

  const handleDepartmentSelect = (dept: Departments) => {
    setSelectedDepartment(dept);
    setState("complete");
  };

  const handleReset = () => {
    setSelectedCampus(null);
    setSelectedDepartment(null);
    setDepartments([]);
    setState("campus");
  };

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="overflow-hidden rounded-2xl border bg-card"
      initial={{ opacity: 0, y: 20 }}
      layout
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Header */}
      <div className="border-b bg-muted/30 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-primary/10 to-secondary/10">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">Assignment</h3>
            <p className="text-muted-foreground text-sm">
              Where should this expense be charged?
            </p>
          </div>
        </div>
      </div>

      {/* Selection breadcrumb */}
      <div className="flex items-center gap-2 border-b bg-muted/10 px-6 py-3 text-sm">
        <button
          className={cn(
            "transition-colors",
            selectedCampus
              ? "text-primary hover:underline"
              : "font-medium text-foreground"
          )}
          onClick={handleReset}
          type="button"
        >
          Campus
        </button>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
        <span
          className={cn(
            "transition-colors",
            getDepartmentBreadcrumbStyle(state, selectedDepartment)
          )}
        >
          Department
        </span>
      </div>

      {/* Content */}
      <div className="p-6">
        <AnimatePresence mode="wait">
          {state === "campus" && (
            <motion.div
              animate={{ opacity: 1, x: 0 }}
              className="grid grid-cols-2 gap-3 sm:grid-cols-3"
              exit={{ opacity: 0, x: 20 }}
              initial={{ opacity: 0, x: -20 }}
              key="campus"
            >
              {campuses.map((campus, i) => (
                <motion.button
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "group relative flex flex-col items-center gap-2 rounded-xl border p-4 transition-all",
                    "hover:border-primary/30 hover:bg-primary/5 hover:shadow-sm",
                    selectedCampus?.$id === campus.$id &&
                      "border-primary bg-primary/5"
                  )}
                  initial={{ opacity: 0, y: 10 }}
                  key={campus.$id}
                  onClick={() => handleCampusSelect(campus)}
                  transition={{ delay: i * 0.05 }}
                  type="button"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted transition-colors group-hover:bg-primary/10">
                    <MapPin className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-primary" />
                  </div>
                  <span className="font-medium text-sm">{campus.name}</span>
                </motion.button>
              ))}
            </motion.div>
          )}

          {state === "department" && (
            <motion.div
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              initial={{ opacity: 0, x: 20 }}
              key="department"
            >
              {(() => {
                if (isLoadingDepartments) {
                  return (
                    <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>Loading departments...</span>
                    </div>
                  );
                }
                if (departments.length === 0) {
                  return (
                    <div className="py-8 text-center text-muted-foreground">
                      No departments available for this campus
                    </div>
                  );
                }
                return (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {departments.map((dept, i) => (
                      <motion.button
                        animate={{ opacity: 1, y: 0 }}
                        className={cn(
                          "group relative flex flex-col items-center gap-2 rounded-xl border p-4 transition-all",
                          "hover:border-primary/30 hover:bg-primary/5 hover:shadow-sm",
                          selectedDepartment?.$id === dept.$id &&
                            "border-primary bg-primary/5"
                        )}
                        initial={{ opacity: 0, y: 10 }}
                        key={dept.$id}
                        onClick={() => handleDepartmentSelect(dept)}
                        transition={{ delay: i * 0.05 }}
                        type="button"
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted transition-colors group-hover:bg-primary/10">
                          <Users className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-primary" />
                        </div>
                        <span className="line-clamp-2 text-center font-medium text-sm">
                          {dept.Name}
                        </span>
                      </motion.button>
                    ))}
                  </div>
                );
              })()}
            </motion.div>
          )}

          {state === "complete" && selectedCampus && selectedDepartment && (
            <motion.div
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-4"
              initial={{ opacity: 0, scale: 0.95 }}
              key="complete"
            >
              <div className="flex items-center gap-4 rounded-xl bg-emerald-500/10 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500">
                  <Check className="h-5 w-5 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-emerald-700 dark:text-emerald-300">
                    Assignment selected
                  </p>
                  <p className="truncate text-muted-foreground text-sm">
                    {selectedCampus.name} → {selectedDepartment.Name}
                  </p>
                </div>
                <Button
                  className="shrink-0"
                  onClick={handleReset}
                  size="sm"
                  variant="ghost"
                >
                  Change
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
