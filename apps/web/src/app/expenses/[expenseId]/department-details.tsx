import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
import { Button } from "@repo/ui/components/ui/button";
import { Progress } from "@repo/ui/components/ui/progress";
import {
  Building,
  MapPin,
  ChevronRight,
  Search,
} from "lucide-react";
import { Input } from "@repo/ui/components/ui/input";
import { useFormContext } from "./formContext";
import { getCampuses } from "@/app/actions/campus";

export function DepartmentSelectionStep() {
  const { updateFormData, formData, nextStep, prevStep } = useFormContext();
  const [selectedCampus, setSelectedCampus] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredDepartments, setFilteredDepartments] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [hoveredCampus, setHoveredCampus] = useState(null);
  const [campuses, setCampuses] = useState([]);

  useEffect(() => {
    async function fetchCampuses() {
      const fetchedCampuses = await getCampuses(true);
      setCampuses(fetchedCampuses);
    }
    fetchCampuses();
  }, []);

  useEffect(() => {
    if (selectedCampus && searchQuery) {
      const filtered = selectedCampus.departments.filter(dept =>
        dept.Name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredDepartments(filtered);
    } else if (selectedCampus) {
      setFilteredDepartments(selectedCampus.departments);
    }
  }, [searchQuery, selectedCampus]);

  const handleCampusSelect = (campus) => {
    setSelectedCampus(campus);
    setSelectedDepartment(null);
    setSearchQuery("");
  };

  const handleDepartmentSelect = (department) => {
    setSelectedDepartment(department);
    updateFormData({
      campus: selectedCampus.name,
      department: department.Name,
    });
  };

  return (
    <div className="space-y-6">
      <Progress value={50} className="w-full" />
      
      <div className="grid grid-cols-12 gap-6">
        {/* Campus Selection - Left Panel */}
        <div className="col-span-4">
          <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <MapPin className="h-5 w-5" />
            Select Campus
          </h3>
          
          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
            {campuses.map((campus) => (
              <motion.div
                key={campus.$id}
                initial={false}
                animate={{
                  scale: hoveredCampus === campus.$id ? 1.02 : 1,
                  backgroundColor: selectedCampus?.$id === campus.$id ? "rgb(243 244 246)" : "transparent"
                }}
                className="relative rounded-lg overflow-hidden"
                onHoverStart={() => setHoveredCampus(campus.$id)}
                onHoverEnd={() => setHoveredCampus(null)}
              >
                <button
                  onClick={() => handleCampusSelect(campus)}
                  className={`w-full p-4 text-left transition-all relative z-10 rounded-lg
                    ${selectedCampus?.$id === campus.$id 
                      ? 'bg-primary/5 border-primary' 
                      : 'hover:bg-gray-50'}`}
                >
                  <div className="relative z-10">
                    <h4 className="font-medium">{campus.name}</h4>
                    <p className="text-sm text-gray-500">
                      {campus.departments.length} departments
                    </p>
                  </div>
                </button>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Department Selection - Right Panel */}
        <div className="col-span-8">
          <AnimatePresence mode="wait">
            {selectedCampus ? (
              <motion.div
                key="department-list"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <Card>
                  <CardHeader className="border-b">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <Building className="h-5 w-5" />
                        {selectedCampus.name}
                      </CardTitle>
                    </div>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <Input
                        placeholder="Search departments..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </CardHeader>
                  <CardContent className="max-h-[300px] overflow-y-auto">
                    <div className="space-y-2 py-2">
                      <AnimatePresence>
                        {filteredDepartments.map((dept, index) => (
                          <motion.div
                            key={dept.$id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ delay: index * 0.05 }}
                          >
                            <button
                              onClick={() => handleDepartmentSelect(dept)}
                              className={`w-full p-4 text-left rounded-lg transition-all
                                ${selectedDepartment?.$id === dept.$id
                                  ? 'bg-primary/10 ring-2 ring-primary/20'
                                  : 'hover:bg-gray-50'}`}
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <h4 className="font-medium">{dept.Name}</h4>
                                  {dept.building && (
                                    <p className="text-sm text-gray-500">{dept.building}</p>
                                  )}
                                </div>
                                <ChevronRight className={`h-5 w-5 text-gray-400 transition-transform
                                  ${selectedDepartment?.$id === dept.$id ? 'rotate-90' : ''}`} 
                                />
                              </div>
                            </button>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              <motion.div
                key="placeholder"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full flex items-center justify-center"
              >
                <div className="text-center text-gray-500">
                  <Building className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Select a campus to view departments</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={prevStep}>
          Back
        </Button>
        <Button
          onClick={nextStep}
          disabled={!selectedDepartment}
        >
          Continue
        </Button>
      </div>
    </div>
  );
}