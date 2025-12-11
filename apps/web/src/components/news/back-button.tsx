"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export function BackButton() {
  const router = useRouter();

  return (
    <button
      className="absolute top-8 left-8 flex animate-fade-in-left items-center gap-2 text-white opacity-0 transition-colors hover:text-brand"
      onClick={() => router.back()}
      type="button"
    >
      <ArrowLeft className="h-5 w-5" />
      Back to Home
    </button>
  );
}
