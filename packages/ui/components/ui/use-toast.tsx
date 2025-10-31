"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import ReactDOM from "react-dom"
import { createPortal } from "react-dom"

type ToastProps = {
  title?: string
  description?: string
  variant?: "default" | "destructive"
  duration?: number
}

type ToastContextType = {
  toast: (props: ToastProps) => void
}

const ToastContext = React.createContext<ToastContextType | undefined>(undefined)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<(ToastProps & { id: string })[]>([])
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null)

  // Create portal container on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Check if container already exists
      let container = document.getElementById('toast-portal-container')
      
      if (!container) {
        container = document.createElement('div')
        container.id = 'toast-portal-container'
        document.body.appendChild(container)
      }
      
      setPortalContainer(container)
      
      return () => {
        if (container && document.body.contains(container)) {
          document.body.removeChild(container)
        }
      }
    }
  }, [])

  const toast = (props: ToastProps) => {
    const id = Math.random().toString(36).substring(2, 9)
    setToasts((prev) => [...prev, { ...props, id }])
  }

  // Remove toast after its duration
  useEffect(() => {
    if (toasts.length === 0) return
    
    const timeouts = toasts.map((toast) => {
      return setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id))
      }, toast.duration || 5000)
    })
    
    return () => {
      timeouts.forEach(clearTimeout)
    }
  }, [toasts])

  // Store the toast function in window for easier access
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__TOAST_CONTEXT__ = { toast }
    }
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {portalContainer && createPortal(
        <div className="fixed bottom-0 right-0 z-50 p-4 space-y-2" data-toast-context="true">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`p-4 rounded-md shadow-lg transition-all duration-300 transform translate-y-0 max-w-md ${
                toast.variant === "destructive"
                  ? "bg-red-600 text-white"
                  : "bg-white text-gray-900 dark:bg-gray-800 dark:text-gray-100"
              }`}
            >
              {toast.title && (
                <div className="font-medium">{toast.title}</div>
              )}
              {toast.description && (
                <div className="text-sm mt-1">
                  {toast.description}
                </div>
              )}
            </div>
          ))}
        </div>,
        portalContainer
      )}
    </ToastContext.Provider>
  )
}

export const useToast = () => {
  const context = React.useContext(ToastContext)
  
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider")
  }
  
  return context
}

export const toast = (props: ToastProps) => {
  if (typeof window === "undefined") return
  
  // Get existing context if available
  const contextValue = (window as any).__TOAST_CONTEXT__
  if (contextValue && typeof contextValue.toast === 'function') {
    contextValue.toast(props)
    return
  }
  
  // Otherwise create a temporary toast container
  const container = document.createElement("div")
  document.body.appendChild(container)
  
  // Create a component that will use the toast context
  function ToastComponent() {
    const { toast } = useToast()
    
    useEffect(() => {
      toast(props)
      
      // Clean up after a delay
      const timer = setTimeout(() => {
        if (container && document.body.contains(container)) {
          document.body.removeChild(container)
        }
      }, (props.duration || 5000) + 300)
      
      return () => {
        clearTimeout(timer)
        if (container && document.body.contains(container)) {
          document.body.removeChild(container)
        }
      }
    }, [])
    
    return null
  }
  
  // Render the ToastProvider with our component
  ReactDOM.render(
    <ToastProvider>
      <ToastComponent />
    </ToastProvider>,
    container
  )
} 