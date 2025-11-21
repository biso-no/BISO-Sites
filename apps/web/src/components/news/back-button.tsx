"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export function BackButton() {
  const router = useRouter();

  return (
    <button
      onClick={() => router.back()}
      className="absolute top-8 left-8 flex items-center gap-2 text-white hover:text-[#3DA9E0] transition-colors opacity-0 animate-fade-in-left"
    >
      <ArrowLeft className="w-5 h-5" />
      Back to Home
    </button>
  );
}
