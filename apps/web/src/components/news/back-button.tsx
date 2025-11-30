"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export function BackButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      className="absolute top-8 left-8 flex animate-fade-in-left items-center gap-2 text-white opacity-0 transition-colors hover:text-[#3DA9E0]"
      onClick={() => router.back()}
    >
      <ArrowLeft className="h-5 w-5" />
      Back to Home
    </button>
  );
}
