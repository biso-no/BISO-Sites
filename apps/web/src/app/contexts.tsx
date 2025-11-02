"use client"
import React, { createContext, useContext, useState, useEffect } from "react";
import { getDepartments } from "../lib/actions/departments";
import { getCampuses } from "./actions/campus";
import { Campus
 } from "../lib/types/campus";
 import { Department } from "../lib/types/department";
// Define the context
const appContext = createContext<{ departments: Department[], campuses: Campus[] } | null>(null);

// Define the provider component
export const AppContextProvider = ({ children }: { children: React.ReactNode }) => {
  const [departments, setDepartments] =useState<Department[]>([])
  const [campuses, setCampuses] = useState<Campus[]>([])

  // Function to fetch departments from the database
  const fetchDepartments = async () => {
    try {
      const response = await getDepartments()
      setDepartments(response as unknown as Department[] | [])
    } catch (error) {
      console.error("Failed to fetch departments:", error)
    }
  };

  const fetchCampuses = async () => {
    try {
      const response = await getCampuses()
      setCampuses(response)
    } catch (error) {
      console.error("Failed to fetch campuses:", error)
    }
  };

  // Fetch departments when the component mounts
  useEffect(() => {
    fetchDepartments();
    fetchCampuses();
  }, []);

  return (
    <appContext.Provider value={{ departments, campuses }}>
      {children}
    </appContext.Provider>
  );
};

export const useAppContext = () => {
    const context = useContext(appContext)
    if (!context) {
      throw new Error('useNewPropertyFormContext must be used within a NewUserFormContextProvider')
    }
  
    return context
  }