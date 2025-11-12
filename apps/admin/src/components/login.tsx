"use client"

import { useState, useEffect } from "react"
import { Mail, Send, Key, ArrowRight, ExternalLink, Shield } from "lucide-react"
import Link from "next/link"
import { signInWithAzure, signInWithMagicLink } from "@/lib/server"
import Image from "next/image"
import { useSearchParams, useRouter } from "next/navigation"
import { Button } from "@repo/ui/components/ui/button"

export function Login() {
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const searchParams = useSearchParams()
  const router = useRouter()
  
  // Handle the restrictedDomain parameter but immediately clear it
  useEffect(() => {
    if (searchParams.get("restrictedDomain")) {
      setMessage({ type: "error", text: "Please use your personal email address." })
      // Remove the parameter from URL
      router.replace("/auth/login", { scroll: false })
    }
  }, [searchParams, router])

  const handleUserLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) {
      setMessage({ type: "error", text: "Please enter your email address." })
      return
    }
    
    /*
    if (email.toLowerCase().includes("@biso.no")) {
      setMessage({ type: "error", text: "Please use your personal email address." })
      return
    }
    */
    
    setIsLoading(true)
    try {
      await signInWithMagicLink(email)
      setMessage({ type: "success", text: "Login link sent! Please check your email." })
    } catch (error) {
      setMessage({ type: "error", text: "Failed to send login link. Please try again." })
    } finally {
      setIsLoading(false)
    }
  }

  const handleAdminLogin = async () => {
    await signInWithAzure()
  }

  return (
    <div className="relative w-full max-w-md overflow-hidden rounded-2xl shadow-xl">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden -z-10">
        <div className="absolute -top-10 -right-10 w-120 h-120 rounded-full bg-blue-accent/5 blur-3xl" />
        <div className="absolute -bottom-20 -left-10 w-100 h-100 rounded-full bg-secondary-100/5 blur-3xl" />
      </div>
      
      <div className="glass-dark border border-white/5 rounded-2xl p-8">
        {/* Logo Section */}
        <div className="flex justify-center mb-6">
          <div className="relative h-12 w-12">
            {/* Replace with your actual logo */}
            <div className="h-12 w-12 rounded-lg bg-linear-to-br from-blue-accent to-secondary-100 flex items-center justify-center">
              <span className="text-white font-bold text-xl">B</span>
            </div>
          </div>
        </div>
        
        <h1 className="text-2xl font-bold text-center mb-1 gradient-text">Welcome Back</h1>
        <p className="text-center text-gray-400 mb-8">Sign in to your BISO account</p>
        
        <form onSubmit={handleUserLogin} className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium text-gray-300 flex items-center gap-2">
              <Mail className="h-4 w-4 text-blue-accent" />
              Email Address
            </label>
            <div className="relative">
              <input 
                id="email" 
                type="email" 
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 backdrop-blur-sm px-4 py-3 text-white placeholder:text-gray-500 focus:border-blue-accent/50 focus:outline-none focus:ring-2 focus:ring-blue-accent/25 transition-all duration-200"
              />
            </div>
          </div>
          
          <button 
            type="submit"
            disabled={isLoading}
            className="w-full relative overflow-hidden rounded-lg bg-linear-to-r from-blue-accent to-secondary-100 text-white py-3 font-medium shadow-glow-blue transition-all duration-300 hover:-translate-y-0.5 hover:shadow-glow group"
          >
            {isLoading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
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
            <span className="w-full border-t border-white/10" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-primary-90 px-2 text-gray-400">
              Or
            </span>
          </div>
        </div>
        

        <Button
          onClick={handleAdminLogin}
          className="w-full glass border border-white/10 text-white py-3 rounded-lg flex items-center justify-center font-medium hover:brightness-110 transition-all duration-300 group"
        >
          <Key className="mr-2 h-4 w-4 text-gold-default" />
          Sign in with BISO account
          <ExternalLink className="ml-2 h-3.5 w-3.5 text-gray-400 transition-transform group-hover:translate-x-0.5" />
        </Button>
        
          
        {message && (
          <div className={`mt-6 p-4 rounded-lg ${message.type === "error" ? "bg-red-500/20 border border-red-500/30 text-red-200" : "bg-green-500/20 border border-green-500/30 text-green-200"}`}>
            <p className="text-sm font-medium flex items-start">
              <span className={`mr-2 rounded-full ${message.type === "error" ? "bg-red-500/30" : "bg-green-500/30"} p-0.5`}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {message.type === "error" ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  )}
                </svg>
              </span>
              {message.text}
            </p>
          </div>
        )}
        {/*We should not allow users to sign in with BISO email addresses, as they must use their personal ones*/}
        {/* Privacy Notice */}
        <div className="mt-6 p-3 border border-blue-500/20 rounded-lg bg-blue-500/5">
          <div className="flex items-start">
            <Shield className="h-4 w-4 text-blue-400 mt-0.5 mr-2 shrink-0" />
            <p className="text-xs text-gray-400 leading-relaxed">
              By signing in, you agree to our <a href="https://biso.no/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Privacy Policy</a> and consent to the processing of your personal data as described therein. We comply with GDPR regulations and you can manage your data preferences and request data deletion from your profile settings.
            </p>
          </div>
        </div>
        
        <div className="mt-6 text-center text-xs text-gray-500">
          <p>Don&apos;t have an account yet?</p>
          <Link href="/contact" className="text-blue-accent hover:underline inline-flex items-center">
            Contact us for access
            <ArrowRight className="ml-1 h-3 w-3" />
          </Link>
        </div>
      </div>
    </div>
  )
}