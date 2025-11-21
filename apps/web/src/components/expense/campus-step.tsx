"use client";

import { Campus, type Departments } from "@repo/api/types/appwrite";
import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { Label } from "@repo/ui/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { ArrowLeft, Building2, CheckCircle, ChevronRight } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { getCampusWithDepartments } from "@/app/actions/campus";

interface CampusStepProps {
  campuses: Array<{ $id: string; name: string }>;
  onNext: (data: { campusId: string; departmentId: string }) => void;
  onBack: () => void;
}

export function CampusStep({ campuses, onNext, onBack }: CampusStepProps) {
  const [selectedCampus, setSelectedCampus] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [departments, setDepartments] = useState<Departments[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selectedCampus) {
      setLoading(true);
      setSelectedDepartment("");

      getCampusWithDepartments(selectedCampus)
        .then((result) => {
          if (result.success && result.campus) {
            setDepartments(result.campus.departments || []);
          }
        })
        .finally(() => setLoading(false));
    }
  }, [selectedCampus]);

  const canProceed = selectedCampus && selectedDepartment;

  const handleNext = () => {
    if (canProceed) {
      onNext({
        campusId: selectedCampus,
        departmentId: selectedDepartment,
      });
    }
  };

  const selectedCampusName = campuses.find((c) => c.$id === selectedCampus)?.name;
  const selectedDepartmentName = departments.find((d) => d.$id === selectedDepartment)?.Name;

  return (
    <Card className="p-8 border-0 shadow-lg">
      <h2 className="text-gray-900 mb-6">Campus & Department</h2>

      <div className="space-y-6">
        <div>
          <Label>Campus *</Label>
          <Select value={selectedCampus} onValueChange={(value) => setSelectedCampus(value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select your campus" />
            </SelectTrigger>
            <SelectContent>
              {campuses.map((campus) => (
                <SelectItem key={campus.$id} value={campus.$id}>
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-[#3DA9E0]" />
                    {campus.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-gray-500 mt-1">
            Select the campus this expense is associated with
          </p>
        </div>

        {selectedCampus && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Label>Department *</Label>
            <Select
              value={selectedDepartment}
              onValueChange={setSelectedDepartment}
              disabled={loading}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={loading ? "Loading departments..." : "Select department"}
                />
              </SelectTrigger>
              <SelectContent>
                {departments
                  .filter((dept) => dept.active !== false)
                  .map((dept) => (
                    <SelectItem key={dept.$id} value={dept.$id}>
                      {dept.Name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500 mt-1">
              Select the department to charge this expense to
            </p>
          </motion.div>
        )}

        {selectedCampus && selectedDepartment && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-green-50 rounded-lg border border-green-200"
          >
            <div className="flex items-center gap-2 text-green-700">
              <CheckCircle className="w-5 h-5" />
              <div>
                <p className="font-medium">
                  {selectedCampusName} - {selectedDepartmentName}
                </p>
                <p className="text-sm text-green-600">
                  This expense will be charged to this department
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      <div className="mt-8 flex justify-between">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Button
          onClick={handleNext}
          disabled={!canProceed}
          className="bg-linear-to-r from-[#3DA9E0] to-[#001731] hover:from-[#3DA9E0]/90 hover:to-[#001731]/90 text-white"
        >
          Next: Upload Receipts
          <ChevronRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </Card>
  );
}
