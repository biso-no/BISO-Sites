import { createAdminClient } from '@/lib/appwrite'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

async function getSettings() {
  const { db } = await createAdminClient()
  try {
    const doc = await db.getDocument('app', 'shop_settings', 'singleton')
    const parsed = {
      ...doc,
      general: typeof (doc as any).general === 'string' ? JSON.parse((doc as any).general) : (doc as any).general,
      vipps: typeof (doc as any).vipps === 'string' ? JSON.parse((doc as any).vipps) : (doc as any).vipps,
    }
    return parsed as any
  } catch {
    return null
  }
}

export default async function ShopSettingsPage() {
  const settings = await getSettings()
  const vipps = settings?.vipps || {}
  const general = settings?.general || {}

  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/40 p-4">
      <div className="mb-4">
        <h1 className="text-xl font-semibold">Shop Settings</h1>
        <p className="text-sm text-muted-foreground">Configure your webshop preferences and Vipps Checkout</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>General</CardTitle>
            <CardDescription>Configure core shop options</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="shopName">Shop name</Label>
              <Input id="shopName" name="shopName" defaultValue={general.shopName || 'BISO Shop'} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="contactEmail">Contact email</Label>
              <Input id="contactEmail" name="contactEmail" type="email" defaultValue={general.contactEmail || ''} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="defaultCampusId">Default campus</Label>
              <Input id="defaultCampusId" name="defaultCampusId" defaultValue={general.defaultCampusId || ''} />
            </div>
          </CardContent>
          <CardFooter>
            <form action={saveSettings}>
              <input type="hidden" name="section" value="general" />
              <Button type="submit">Save General</Button>
            </form>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Vipps Checkout</CardTitle>
            <CardDescription>Enter your Vipps API credentials and options</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="vipps_merchantSerialNumber">Merchant serial number</Label>
              <Input id="vipps_merchantSerialNumber" name="vipps_merchantSerialNumber" defaultValue={vipps.merchantSerialNumber || ''} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="vipps_subscriptionKey">Subscription key (Ocp-Apim-Subscription-Key)</Label>
              <Input id="vipps_subscriptionKey" name="vipps_subscriptionKey" defaultValue={vipps.subscriptionKey || ''} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="vipps_clientId">Client ID</Label>
              <Input id="vipps_clientId" name="vipps_clientId" defaultValue={vipps.clientId || ''} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="vipps_clientSecret">Client Secret</Label>
              <Input id="vipps_clientSecret" name="vipps_clientSecret" type="password" defaultValue={vipps.clientSecret || ''} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="vipps_returnUrl">Return URL</Label>
              <Input id="vipps_returnUrl" name="vipps_returnUrl" defaultValue={vipps.returnUrl || ''} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="vipps_callbackPrefix">Callback Prefix</Label>
              <Input id="vipps_callbackPrefix" name="vipps_callbackPrefix" defaultValue={vipps.callbackPrefix || ''} />
            </div>
          </CardContent>
          <CardFooter>
            <form action={saveSettings}>
              <input type="hidden" name="section" value="vipps" />
              <Button type="submit">Save Vipps</Button>
            </form>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}

export async function saveSettings(formData: FormData) {
  'use server'
  const section = formData.get('section') as string
  const { db } = await createAdminClient()
  const existing = await getSettings()
  const next = existing || { $id: 'singleton', vipps: {}, general: {} }

  if (section === 'general') {
    next.general = {
      shopName: String(formData.get('shopName') || ''),
      contactEmail: String(formData.get('contactEmail') || ''),
      defaultCampusId: String(formData.get('defaultCampusId') || ''),
    }
  } else if (section === 'vipps') {
    next.vipps = {
      merchantSerialNumber: String(formData.get('vipps_merchantSerialNumber') || ''),
      subscriptionKey: String(formData.get('vipps_subscriptionKey') || ''),
      clientId: String(formData.get('vipps_clientId') || ''),
      clientSecret: String(formData.get('vipps_clientSecret') || ''),
      returnUrl: String(formData.get('vipps_returnUrl') || ''),
      callbackPrefix: String(formData.get('vipps_callbackPrefix') || ''),
    }
  }

  try {
    if (existing) {
      await db.updateDocument('app', 'shop_settings', 'singleton', {
        general: JSON.stringify(next.general || {}),
        vipps: JSON.stringify(next.vipps || {}),
      })
    } else {
      await db.createDocument('app', 'shop_settings', 'singleton', {
        general: JSON.stringify(next.general || {}),
        vipps: JSON.stringify(next.vipps || {}),
      })
    }
  } catch (error) {
    console.error('Failed to save settings', error)
  }
}


