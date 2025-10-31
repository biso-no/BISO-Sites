"use client";

import { ReactNode, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { OnboardingModal } from "./onboarding-modal";
import { WelcomeModal } from "./welcome-modal";
import { useAuth } from "@/lib/hooks/useAuth";
import { updateUserPreferences } from "@/lib/actions/user";

interface OnboardingProviderProps {
  children: ReactNode;
}

export function OnboardingProvider({ children }: OnboardingProviderProps) {
  const { user, profile, isLoading } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [initialCheckComplete, setInitialCheckComplete] = useState(false);
  const pathname = usePathname();
  
  
  // Paths where we don't want to show the onboarding modal
  const excludedPaths = [
    "/login", 
    "/register", 
    "/auth",
    "/admin",
    "/expenses/profile",
  ];
  
  // Check if the current path is in the excluded list
  const isExcludedPath = excludedPaths.some(path => pathname.startsWith(path));
  
  // Check if we're on the expenses path 
  const isExpensesPath = pathname.startsWith("/expenses");

  // Initial check for modal display
  useEffect(() => {
    if (!isLoading) {
      setInitialCheckComplete(true);
    }
  }, [isLoading]);

  // Control modal visibility based on user state and path
  useEffect(() => {
    if (initialCheckComplete && user && !profile && !isExcludedPath) {
      setShowModal(true);
    } else {
      setShowModal(false);
    }
    
    // Check if it's first time in expenses section
    if (initialCheckComplete && user && profile && isExpensesPath && !isExcludedPath) {
      const hasExpenseProfile = user.prefs?.hasExpenseProfile === true;
      setShowWelcomeModal(!hasExpenseProfile);
    } else {
      setShowWelcomeModal(false);
    }
  }, [initialCheckComplete, user, profile, isExcludedPath, isExpensesPath]);

  const handleCloseModal = () => {
    setShowModal(false);
  };
  
  const handleCloseWelcomeModal = () => {
    setShowWelcomeModal(false);
  };

  return (
    <>
      {children}
      {user && (
        <>
          <OnboardingModal
            isOpen={showModal}
            onClose={handleCloseModal}
            userId={user.$id}
          />
          <WelcomeModal
            isOpen={showWelcomeModal}
            onClose={handleCloseWelcomeModal}
            userId={user.$id}
          />
        </>
      )}
    </>
  );
} 