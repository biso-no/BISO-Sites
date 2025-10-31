import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@repo/ui/components/ui/card";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Progress } from "@repo/ui/components/ui/progress";
import {
  Banknote,
  CreditCard,
  Mail,
  Phone,
  Edit2,
  Check,
  X,
} from "lucide-react";
import { useFormContext } from "./formContext";

export function UserDetailsStep() {
  const [editMode, setEditMode] = useState(false);
  const { updateFormData, formData, nextStep } = useFormContext();
  
  // In a real app, this would come from your user context/API
  const userProfile = {
    bank_account: "1234 5678 9012 3456",
    email: "john.doe@example.com",
    phone: "+47 123 45 678",
  };

  const [editedDetails, setEditedDetails] = useState(userProfile);

  const handleEdit = () => {
    setEditMode(true);
  };

  const handleSave = () => {
    updateFormData(editedDetails);
    setEditMode(false);
  };

  const handleCancel = () => {
    setEditedDetails(userProfile);
    setEditMode(false);
  };

  return (
    <div className="space-y-6">
      <Progress value={25} className="w-full" />
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {/* Bank Account Card */}
        <Card className="overflow-hidden">
          <CardHeader className="border-b bg-linear-to-r from-blue-50 to-blue-100/50">
            <CardTitle className="flex items-center gap-2">
              <Banknote className="h-5 w-5" />
              Payment Details
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="relative">
              {!editMode && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0"
                  onClick={handleEdit}
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
              )}
              
              <div className="space-y-6">
                <div className="relative group">
                  <motion.div
                    className="w-full h-48 bg-linear-to-br from-blue-600 to-blue-800 rounded-xl p-6 text-white shadow-lg"
                    whileHover={{ scale: 1.02 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    <div className="flex justify-between items-start">
                      <Banknote className="h-8 w-8" />
                      <div className="text-right">
                        <p className="text-sm opacity-80">Bank Account</p>
                        <AnimatePresence mode="wait">
                          {editMode ? (
                            <Input
                              key="edit"
                              value={editedDetails.bank_account}
                              onChange={(e) => setEditedDetails({
                                ...editedDetails,
                                bank_account: e.target.value
                              })}
                              className="bg-white/10 border-white/20 text-white placeholder:text-white/50 mt-1"
                              placeholder="Enter account number"
                            />
                          ) : (
                            <motion.p
                              key="display"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="font-mono text-lg mt-1"
                            >
                              {editedDetails.bank_account}
                            </motion.p>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </motion.div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm text-gray-500 flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      Email Address
                    </label>
                    <AnimatePresence mode="wait">
                      {editMode ? (
                        <Input
                          value={editedDetails.email}
                          onChange={(e) => setEditedDetails({
                            ...editedDetails,
                            email: e.target.value
                          })}
                        />
                      ) : (
                        <p className="text-sm">{editedDetails.email}</p>
                      )}
                    </AnimatePresence>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm text-gray-500 flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      Phone Number
                    </label>
                    <AnimatePresence mode="wait">
                      {editMode ? (
                        <Input
                          value={editedDetails.phone}
                          onChange={(e) => setEditedDetails({
                            ...editedDetails,
                            phone: e.target.value
                          })}
                        />
                      ) : (
                        <p className="text-sm">{editedDetails.phone}</p>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-between items-center">
          {editMode ? (
            <div className="space-x-2">
              <Button onClick={handleSave} className="gap-2">
                <Check className="h-4 w-4" />
                Save Changes
              </Button>
              <Button variant="outline" onClick={handleCancel} className="gap-2">
                <X className="h-4 w-4" />
                Cancel
              </Button>
            </div>
          ) : (
            <Button onClick={nextStep}>Continue</Button>
          )}
        </div>
      </motion.div>
    </div>
  );
}