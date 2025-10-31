import { Login } from "@/components/login";
import { getAuthStatus } from "@/lib/auth-utils";
import { redirect } from "next/navigation";

export default async function Page({ searchParams }: { 
  searchParams: { redirectTo?: string } 
}) {
  // Check if user is already authenticated (not anonymous)
  const authStatus = await getAuthStatus();
  
  if (authStatus.isAuthenticated) {
    // User is already authenticated, redirect them
    const redirectTo = searchParams.redirectTo;
    const target = redirectTo ? decodeURIComponent(redirectTo) : '/admin';
    return redirect(target);
  }
  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 py-12 bg-primary-100">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden -z-10">
        <div className="absolute -top-20 -right-20 w-160 h-160 rounded-full bg-blue-accent/5 blur-3xl" />
        <div className="absolute top-1/3 -left-20 w-120 h-120 rounded-full bg-gold-default/5 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-140 h-140 rounded-full bg-secondary-100/5 blur-3xl" />
      </div>
      
      <Login />
      
      {/* Footer text */}
      <div className="absolute bottom-4 text-center w-full text-xs text-gray-400">
        &copy; {new Date().getFullYear()} BISO. All rights reserved.
      </div>
    </div>
  )
}