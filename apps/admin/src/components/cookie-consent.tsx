"use client";

import { useState, useEffect } from 'react';
import { Button } from '@repo/ui/components/ui/button';
import { useHydration } from '@/lib/hooks/use-hydration';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@repo/ui/components/ui/tabs';
import { Switch } from '@repo/ui/components/ui/switch';
import { Label } from '@repo/ui/components/ui/label';
import Link from 'next/link';
import { Shield } from 'lucide-react';

interface CookieSettings {
  essential: boolean;
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
}

export function CookieConsent() {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("simple");
  const [settings, setSettings] = useState<CookieSettings>({
    essential: true, // Always true and can't be changed
    functional: true,
    analytics: false,
    marketing: false
  });
  const isHydrated = useHydration();

  useEffect(() => {
    if (!isHydrated) return;
    
    // Check if consent has already been given
    const hasConsent = localStorage.getItem('cookie-consent');
    
    if (!hasConsent) {
      // Show the consent dialog after a short delay
      const timer = setTimeout(() => {
        setOpen(true);
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [isHydrated]);

  const saveCookiePreferences = (acceptAll = false) => {
    if (!isHydrated) return;
    
    const preferences = acceptAll 
      ? { essential: true, functional: true, analytics: true, marketing: true }
      : settings;
      
    // Save preferences to localStorage
    localStorage.setItem('cookie-consent', 'true');
    localStorage.setItem('cookie-preferences', JSON.stringify(preferences));
    
    // Here you would typically set the actual cookies based on the preferences
    // For example, initializing analytics only if analytics is true
    
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[500px] bg-white text-gray-900 border border-gray-200 shadow-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center text-gray-900">
            <Shield className="h-5 w-5 mr-2 text-blue-600" />
            Cookie Preferences
          </DialogTitle>
          <DialogDescription className="text-gray-600">
            We use cookies to enhance your experience on our site and to comply with GDPR requirements.
          </DialogDescription>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-gray-100">
            <TabsTrigger value="simple">Simple</TabsTrigger>
            <TabsTrigger value="advanced">Advanced</TabsTrigger>
          </TabsList>
          
          <TabsContent value="simple" className="space-y-4 py-4">
            <p className="text-sm text-gray-600">
              We use cookies to ensure the website functions properly and to improve your experience.
              By clicking &quot;Accept All&quot;, you consent to all cookies. See our{" "}
              <Link href="/privacy" className="text-blue-600 hover:underline">
                Privacy Policy
              </Link>{" "}
              for more information.
            </p>
          </TabsContent>
          
          <TabsContent value="advanced" className="space-y-4 py-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between p-2 rounded-md transition-colors hover:bg-gray-50">
                <div className="space-y-0.5">
                  <Label htmlFor="essential-cookies" className="text-gray-900">Essential Cookies</Label>
                  <p className="text-xs text-gray-500">
                    Required for the website to function properly
                  </p>
                </div>
                <Switch id="essential-cookies" checked disabled />
              </div>
              
              <div className="flex items-center justify-between p-2 rounded-md transition-colors hover:bg-gray-50">
                <div className="space-y-0.5">
                  <Label htmlFor="functional-cookies" className="text-gray-900">Functional Cookies</Label>
                  <p className="text-xs text-gray-500">
                    Remember your preferences to enhance your experience
                  </p>
                </div>
                <Switch 
                  id="functional-cookies" 
                  checked={settings.functional}
                  onCheckedChange={(checked) => 
                    setSettings(prev => ({ ...prev, functional: checked }))
                  }
                />
              </div>
              
              <div className="flex items-center justify-between p-2 rounded-md transition-colors hover:bg-gray-50">
                <div className="space-y-0.5">
                  <Label htmlFor="analytics-cookies" className="text-gray-900">Analytics Cookies</Label>
                  <p className="text-xs text-gray-500">
                    Help us understand how you use our site
                  </p>
                </div>
                <Switch 
                  id="analytics-cookies" 
                  checked={settings.analytics}
                  onCheckedChange={(checked) => 
                    setSettings(prev => ({ ...prev, analytics: checked }))
                  }
                />
              </div>
              
              <div className="flex items-center justify-between p-2 rounded-md transition-colors hover:bg-gray-50">
                <div className="space-y-0.5">
                  <Label htmlFor="marketing-cookies" className="text-gray-900">Marketing Cookies</Label>
                  <p className="text-xs text-gray-500">
                    Used to tailor content to your interests
                  </p>
                </div>
                <Switch 
                  id="marketing-cookies" 
                  checked={settings.marketing}
                  onCheckedChange={(checked) => 
                    setSettings(prev => ({ ...prev, marketing: checked }))
                  }
                />
              </div>
            </div>
            
            <p className="text-xs text-gray-500 mt-4">
              For more details about how we use cookies and your data, please read our{" "}
              <Link href="/privacy" className="text-blue-600 hover:underline">
                Privacy Policy
              </Link>.
            </p>
          </TabsContent>
        </Tabs>
        
        <DialogFooter className="sm:justify-between border-t border-gray-100 pt-4">
          <div className="hidden sm:block">
            <Button 
              variant="outline" 
              onClick={() => saveCookiePreferences()}
              className="text-sm"
            >
              Save Preferences
            </Button>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => saveCookiePreferences()}
              className="sm:hidden w-full text-sm"
            >
              Save Preferences
            </Button>
            <Button 
              onClick={() => saveCookiePreferences(true)}
              className="w-full text-sm bg-blue-600 hover:bg-blue-700 text-white"
            >
              Accept All
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 
