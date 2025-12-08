"use client";

import { Button } from "@repo/ui/components/ui/button";
import { ArrowRight, Mail, Shield } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import {
 signInWithApple,
 signInWithFacebook,
 signInWithGoogle,
 signInWithMagicLink,
} from "@/lib/server";

export function Login() {
 const [email, setEmail] = useState("");
 const [isLoading, setIsLoading] = useState(false);
 const [message, setMessage] = useState<{
 type: "success" | "error";
 text: string;
 } | null>(null);
 const [mounted, setMounted] = useState(false);
 const searchParams = useSearchParams();
 const router = useRouter();
 const { resolvedTheme } = useTheme();

 useEffect(() => {
 setMounted(true);
 }, []);

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

 const handleGoogleLogin = async () => {
 await signInWithGoogle();
 };

 const handleFacebookLogin = async () => {
 await signInWithFacebook();
 };

 const handleAppleLogin = async () => {
 await signInWithApple();
 };

 return (
 <div className="relative w-full max-w-md overflow-hidden rounded-2xl shadow-xl">
 {/* Background decoration */}
 <div className="-z-10 absolute inset-0 overflow-hidden">
 <div className="-top-10 -right-10 absolute h-120 w-120 rounded-full bg-blue-accent/5 blur-3xl" />
 <div className="-bottom-20 -left-10 absolute h-100 w-100 rounded-full bg-secondary-100/5 blur-3xl" />
 </div>

 <div className="rounded-2xl border border-border bg-card p-8 shadow-xl">
 {/* Logo Section */}
 <div className="mb-8 flex justify-center">
 {mounted ? (
 <Image
 alt="BISO Logo"
 className="h-12 w-auto"
 height={48}
 priority
 src={
 resolvedTheme === "dark"
 ? "/images/logo-dark.png"
 : "/images/logo-light.png"
 }
 width={160}
 />
 ) : (
 <div className="h-12 w-40 animate-pulse rounded bg-muted" />
 )}
 </div>

 <h1 className="mb-1 text-center font-bold text-2xl text-foreground">
 Welcome Back
 </h1>
 <p className="mb-8 text-center text-muted-foreground">
 Sign in to your BISO account
 </p>

 <form className="space-y-6" onSubmit={handleUserLogin}>
 <div className="space-y-2">
 <label
 className="flex items-center gap-2 font-medium text-foreground text-sm"
 htmlFor="email"
 >
 <Mail className="h-4 w-4 text-brand" />
 Email Address
 </label>
 <div className="relative">
 <input
 className="w-full rounded-lg border border-input bg-background px-4 py-3 text-foreground transition-all duration-200 placeholder:text-muted-foreground focus:border-brand-border-strong focus:outline-none focus:ring-2 focus:ring-brand-border"
 id="email"
 onChange={(e) => setEmail(e.target.value)}
 placeholder="name@example.com"
 type="email"
 value={email}
 />
 </div>
 </div>

 <button
 className="hover:-translate-y-0.5 group relative w-full overflow-hidden rounded-lg bg-linear-to-r from-brand-gradient-from to-brand-gradient-to py-3 font-medium text-white shadow-lg transition-all duration-300 hover:shadow-xl"
 disabled={isLoading}
 type="submit"
 >
 {isLoading ? (
 <span className="flex items-center justify-center">
 <svg
 className="-ml-1 mr-2 h-4 w-4 animate-spin text-white"
 fill="none"
 viewBox="0 0 24 24"
 xmlns="http://www.w3.org/2000/svg"
 >
 <title>Loading...</title>
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
 <span className="w-full border-border border-t" />
 </div>
 <div className="relative flex justify-center text-xs uppercase">
 <span className="bg-card px-2 text-muted-foreground">
 Or continue with
 </span>
 </div>
 </div>

 <div className="grid grid-cols-3 gap-3">
 <Button
 className="flex items-center justify-center rounded-lg border border-border bg-secondary py-3 transition-all duration-200 hover:bg-secondary/80"
 onClick={handleGoogleLogin}
 type="button"
 variant="outline"
 >
 <svg className="h-5 w-5" viewBox="0 0 24 24">
 <title>Google</title>
 <path
 d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
 fill="#4285F4"
 />
 <path
 d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
 fill="#34A853"
 />
 <path
 d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
 fill="#FBBC05"
 />
 <path
 d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
 fill="#EA4335"
 />
 </svg>
 </Button>

 <Button
 className="flex items-center justify-center rounded-lg border border-border bg-secondary py-3 transition-all duration-200 hover:bg-secondary/80"
 onClick={handleFacebookLogin}
 type="button"
 variant="outline"
 >
 <svg className="h-5 w-5" fill="#1877F2" viewBox="0 0 24 24">
 <title>Facebook</title>
 <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
 </svg>
 </Button>

 <Button
 className="flex items-center justify-center rounded-lg border border-border bg-secondary py-3 transition-all duration-200 hover:bg-secondary/80"
 onClick={handleAppleLogin}
 type="button"
 variant="outline"
 >
 <svg
 className="h-5 w-5 text-foreground"
 fill="currentColor"
 viewBox="0 0 24 24"
 >
 <title>Apple</title>
 <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
 </svg>
 </Button>
 </div>

 {message && (
 <div
 className={`mt-6 rounded-lg p-4 ${message.type === "error" ? "border border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400" : "border border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400"}`}
 >
 <p className="flex items-start font-medium text-sm">
 <span
 className={`mr-2 rounded-full ${message.type === "error" ? "bg-red-500/30" : "bg-green-500/30"} p-0.5`}
 >
 <svg
 className="h-4 w-4"
 fill="none"
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
 <div className="mt-6 rounded-lg border border-brand-border bg-brand-muted p-3">
 <div className="flex items-start">
 <Shield className="mt-0.5 mr-2 h-4 w-4 shrink-0 text-brand" />
 <p className="text-muted-foreground text-xs leading-relaxed">
 By signing in, you agree to our{" "}
 <a
 className="text-brand hover:underline"
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

 <div className="mt-6 text-center text-muted-foreground text-xs">
 <p>Don&apos;t have an account yet?</p>
 <Link
 className="inline-flex items-center text-brand hover:underline"
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
