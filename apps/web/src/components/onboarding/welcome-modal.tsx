"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { updateUserPreferences } from "@/lib/actions/user";
import { useRouter } from "next/navigation";

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

export function WelcomeModal({ isOpen, onClose, userId }: WelcomeModalProps) {
  const router = useRouter();
  
  // Prevent scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [isOpen]);

  // Mark the user as having seen the welcome modal
  const handleGotIt = async () => {
    try {
      await updateUserPreferences(userId, { hasExpenseProfile: true });
      onClose();
    } catch (error) {
      console.error("Failed to update user preferences:", error);
      onClose();
    }
  };
  
  // Go to profile page
  const goToProfilePage = () => {
    onClose();
    router.push("/expenses/profile");
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black"
            onClick={onClose}
          />
          
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: "spring", duration: 0.5 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md z-10 overflow-hidden relative"
          >
            {/* Abstract background decoration */}
            <div className="absolute inset-0 overflow-hidden -z-10">
              <div className="absolute top-0 left-0 w-64 h-64 bg-blue-100 rounded-full blur-3xl opacity-30 transform -translate-x-1/2 -translate-y-1/2" />
              <div className="absolute bottom-0 right-0 w-64 h-64 bg-indigo-100 rounded-full blur-3xl opacity-30 transform translate-x-1/2 translate-y-1/2" />
            </div>
            
            <div className="px-6 py-8">
              <div className="mb-6 text-center">
                <h2 className="text-2xl font-bold text-gray-900 mb-3">Welcome to BISO Expenses</h2>
                <p className="text-gray-600 mb-4">
                  We see it is your first time here. Before submitting your expenses, please check your profile information to ensure everything is correct and up to date.
                </p>
              </div>
              
              <div className="flex justify-between mt-8">
                <button
                  type="button"
                  onClick={goToProfilePage}
                  className="px-4 py-2 text-gray-600 font-medium hover:text-gray-700 hover:bg-gray-50 rounded-lg transition duration-200"
                >
                  View Profile
                </button>
                
                <button
                  type="button"
                  onClick={handleGotIt}
                  className="px-5 py-2.5 bg-linear-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-medium rounded-lg shadow-sm hover:shadow transition duration-200"
                >
                  Got It
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
} 