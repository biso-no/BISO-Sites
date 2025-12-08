"use client";

import type { Departments } from "@repo/api/types/appwrite";
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

type CampusStepProps = {
 campuses: Array<{ $id: string; name: string }>;
 onNext: (data: { campusId: string; departmentId: string }) => void;
 onBack: () => void;
};

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

 const selectedCampusName = campuses.find(
 (c) => c.$id === selectedCampus
 )?.name;
 const selectedDepartmentName = departments.find(
 (d) => d.$id === selectedDepartment
 )?.Name;

 return (
 <Card className="border-0 p-8 shadow-lg">
 <h2 className="mb-6 text-foreground">Campus & Department</h2>

 <div className="space-y-6">
 <div>
 <Label>Campus *</Label>
 <Select
 onValueChange={(value) => setSelectedCampus(value)}
 value={selectedCampus}
 >
 <SelectTrigger>
 <SelectValue placeholder="Select your campus" />
 </SelectTrigger>
 <SelectContent>
 {campuses.map((campus) => (
 <SelectItem key={campus.$id} value={campus.$id}>
 <div className="flex items-center gap-2">
 <Building2 className="h-4 w-4 text-brand" />
 {campus.name}
 </div>
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 <p className="mt-1 text-muted-foreground text-xs">
 Select the campus this expense is associated with
 </p>
 </div>

 {selectedCampus && (
 <motion.div
 animate={{ opacity: 1, y: 0 }}
 initial={{ opacity: 0, y: 10 }}
 >
 <Label>Department *</Label>
 <Select
 disabled={loading}
 onValueChange={setSelectedDepartment}
 value={selectedDepartment}
 >
 <SelectTrigger>
 <SelectValue
 placeholder={
 loading ? "Loading departments..." : "Select department"
 }
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
 <p className="mt-1 text-muted-foreground text-xs">
 Select the department to charge this expense to
 </p>
 </motion.div>
 )}

 {selectedCampus && selectedDepartment && (
 <motion.div
 animate={{ opacity: 1, y: 0 }}
 className="rounded-lg border border-green-200 bg-green-50 p-4"
 initial={{ opacity: 0, y: 10 }}
 >
 <div className="flex items-center gap-2 text-green-700">
 <CheckCircle className="h-5 w-5" />
 <div>
 <p className="font-medium">
 {selectedCampusName} - {selectedDepartmentName}
 </p>
 <p className="text-green-600 text-sm">
 This expense will be charged to this department
 </p>
 </div>
 </div>
 </motion.div>
 )}
 </div>

 <div className="mt-8 flex justify-between">
 <Button onClick={onBack} variant="outline">
 <ArrowLeft className="mr-2 h-4 w-4" />
 Back
 </Button>
 <Button
 className="bg-linear-to-r from-brand-gradient-from to-brand-gradient-to text-white hover:from-brand-gradient-from/90 hover:to-brand-gradient-to/90"
 disabled={!canProceed}
 onClick={handleNext}
 >
 Next: Upload Receipts
 <ChevronRight className="ml-2 h-4 w-4" />
 </Button>
 </div>
 </Card>
 );
}
