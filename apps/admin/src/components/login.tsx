"use client";

import { Button } from "@repo/ui/components/ui/button";
import { ArrowRight, ExternalLink, Key, Mail, Shield } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { signInWithAzure, signInWithMagicLink } from "@/lib/server";

export function Login() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();

  // Handle the restrictedDomain parameter but immediately clear it
  useEffect(() => {
    if (searchParams.get("restrictedDomain")) {
      setMessage({
        type: "error",
        text: "Please use your personal email address.",
      });
      // Remove the parameter from URL
      router.replace("/auth/login", { scroll: false });
    }
  }, [searchParams, router]);

  const handleUserLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setMessage({ type: "error", text: "Please enter your email address." });
      return;
    }

    /*
    if (email.toLowerCase().includes("@biso.no")) {
      setMessage({ type: "error", text: "Please use your personal email address." })
      return
    }
    */

    setIsLoading(true);
    try {
      await signInWithMagicLink(email);
      setMessage({
        type: "success",
        text: "Login link sent! Please check your email.",
      });
    } catch (_error) {
      setMessage({
        type: "error",
        text: "Failed to send login link. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdminLogin = async () => {
    await signInWithAzure();
  };

  return (
    <div className="relative w-full max-w-md overflow-hidden rounded-2xl shadow-xl">
      {/* Background decoration */}
      <div className="-z-10 absolute inset-0 overflow-hidden">
        <div className="-top-10 -right-10 absolute h-120 w-120 rounded-full bg-blue-accent/5 blur-3xl" />
        <div className="-bottom-20 -left-10 absolute h-100 w-100 rounded-full bg-secondary-100/5 blur-3xl" />
      </div>

      <div className="glass-dark rounded-2xl border border-white/5 p-8">
        {/* Logo Section */}
        <div className="mb-6 flex justify-center">
          <div className="relative h-12 w-12">
            {/* Replace with your actual logo */}
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-linear-to-br from-blue-accent to-secondary-100">
              <span className="font-bold text-white text-xl">B</span>
            </div>
          </div>
        </div>

        <h1 className="gradient-text mb-1 text-center font-bold text-2xl">
          Welcome Back
        </h1>
        <p className="mb-8 text-center text-gray-400">
          Sign in to your BISO account
        </p>

        <form className="space-y-6" onSubmit={handleUserLogin}>
          <div className="space-y-2">
            <label
              className="flex items-center gap-2 font-medium text-gray-300 text-sm"
              htmlFor="email"
            >
              <Mail className="h-4 w-4 text-blue-accent" />
              Email Address
            </label>
            <div className="relative">
              <input
                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white backdrop-blur-sm transition-all duration-200 placeholder:text-gray-500 focus:border-blue-accent/50 focus:outline-none focus:ring-2 focus:ring-blue-accent/25"
                id="email"
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                type="email"
                value={email}
              />
            </div>
          </div>

          <button
            className="hover:-translate-y-0.5 group relative w-full overflow-hidden rounded-lg bg-linear-to-r from-blue-accent to-secondary-100 py-3 font-medium text-white shadow-glow-blue transition-all duration-300 hover:shadow-glow"
            disabled={isLoading}
            type="submit"
          >
            {isLoading ? (
              <span className="flex items-center justify-center">
                <svg
                  aria-label="Loading"
                  className="-ml-1 mr-2 h-4 w-4 animate-spin text-white"
                  fill="none"
                  role="img"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <title>Loading</title>
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    fill="currentColor"
                  />
                </svg>
                Sending...
              </span>
            ) : (
              <span className="flex items-center justify-center">
                Send Login Link
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </span>
            )}
          </button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-white/10 border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-primary-90 px-2 text-gray-400">Or</span>
          </div>
        </div>

        <Button
          className="glass group flex w-full items-center justify-center rounded-lg border border-white/10 py-3 font-medium text-white transition-all duration-300 hover:brightness-110"
          onClick={handleAdminLogin}
        >
          <Key className="mr-2 h-4 w-4 text-gold-default" />
          Sign in with BISO account
          <ExternalLink className="ml-2 h-3.5 w-3.5 text-gray-400 transition-transform group-hover:translate-x-0.5" />
        </Button>

        {message && (
          <div
            className={`mt-6 rounded-lg p-4 ${message.type === "error" ? "border border-red-500/30 bg-red-500/20 text-red-200" : "border border-green-500/30 bg-green-500/20 text-green-200"}`}
          >
            <p className="flex items-start font-medium text-sm">
              <span
                className={`mr-2 rounded-full ${message.type === "error" ? "bg-red-500/30" : "bg-green-500/30"} p-0.5`}
              >
                <svg
                  aria-label={message.type === "error" ? "Error" : "Success"}
                  className="h-4 w-4"
                  fill="none"
                  role="img"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <title>
                    {message.type === "error" ? "Error" : "Success"}
                  </title>
                  {message.type === "error" ? (
                    <path
                      d="M6 18L18 6M6 6l12 12"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                    />
                  ) : (
                    <path
                      d="M5 13l4 4L19 7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                    />
                  )}
                </svg>
              </span>
              {message.text}
            </p>
          </div>
        )}
        {/*We should not allow users to sign in with BISO email addresses, as they must use their personal ones*/}
        {/* Privacy Notice */}
        <div className="mt-6 rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
          <div className="flex items-start">
            <Shield className="mt-0.5 mr-2 h-4 w-4 shrink-0 text-blue-400" />
            <p className="text-gray-400 text-xs leading-relaxed">
              By signing in, you agree to our{" "}
              <a
                className="text-blue-400 hover:underline"
                href="https://biso.no/privacy"
                rel="noopener noreferrer"
                target="_blank"
              >
                Privacy Policy
              </a>{" "}
              and consent to the processing of your personal data as described
              therein. We comply with GDPR regulations and you can manage your
              data preferences and request data deletion from your profile
              settings.
            </p>
          </div>
        </div>

        <div className="mt-6 text-center text-gray-500 text-xs">
          <p>Don&apos;t have an account yet?</p>
          <Link
            className="inline-flex items-center text-blue-accent hover:underline"
            href="/contact"
          >
            Contact us for access
            <ArrowRight className="ml-1 h-3 w-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}
