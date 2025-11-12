"use client";

import { useEffect } from "react";

export function ProfileHead() {
  useEffect(() => {
    document.title = "Your Profile | BISO";
  }, []);
  
  return null;
} 