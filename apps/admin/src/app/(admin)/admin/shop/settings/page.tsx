import { createSessionClient } from '@repo/api/server'
import { getTranslations } from 'next-intl/server'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@repo/ui/components/ui/card'
import { Input } from '@repo/ui/components/ui/input'
import { Label } from '@repo/ui/components/ui/label'
import { Button } from '@repo/ui/components/ui/button'

async function getSettings() {
  const { db } = await createSessionClient()
  try {
    const doc = await db.getRow('app', 'shop_settings', 'singleton')
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
  const t = await getTranslations("adminShop")

  return (
    <div className="flex w-full flex-col">
      <div className="mb-4">
        <h1 className="text-xl font-semibold">{t("settings.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("settings.description")}
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="glass-panel">
          <CardHeader>
            <CardTitle>{t("settings.general")}</CardTitle>
            <CardDescription>{t("settings.generalDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="shopName">
                {t("settings.fields.shopName")}
              </Label>
              <Input id="shopName" name="shopName" defaultValue={general.shopName || 'BISO Shop'} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="contactEmail">
                {t("settings.fields.contactEmail")}
              </Label>
              <Input id="contactEmail" name="contactEmail" type="email" defaultValue={general.contactEmail || ''} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="defaultCampusId">
                {t("settings.fields.defaultCampus")}
              </Label>
              <Input id="defaultCampusId" name="defaultCampusId" defaultValue={general.defaultCampusId || ''} />
            </div>
          </CardContent>
          <CardFooter>
            <form action={saveSettings}>
              <input type="hidden" name="section" value="general" />
              <Button type="submit">
                {t("settings.actions.saveGeneral")}
              </Button>
            </form>
          </CardFooter>
        </Card>

        <Card className="glass-panel">
          <CardHeader>
            <CardTitle>{t("settings.vipps.title")}</CardTitle>
            <CardDescription>{t("settings.vipps.description")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="vipps_merchantSerialNumber">
                {t("settings.fields.vippsMerchantSerialNumber")}
              </Label>
              <Input id="vipps_merchantSerialNumber" name="vipps_merchantSerialNumber" defaultValue={vipps.merchantSerialNumber || ''} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="vipps_subscriptionKey">
                {t("settings.fields.vippsSubscriptionKey")}
              </Label>
              <Input id="vipps_subscriptionKey" name="vipps_subscriptionKey" defaultValue={vipps.subscriptionKey || ''} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="vipps_clientId">
                {t("settings.fields.vippsClientId")}
              </Label>
              <Input id="vipps_clientId" name="vipps_clientId" defaultValue={vipps.clientId || ''} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="vipps_clientSecret">
                {t("settings.fields.vippsClientSecret")}
              </Label>
              <Input id="vipps_clientSecret" name="vipps_clientSecret" type="password" defaultValue={vipps.clientSecret || ''} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="vipps_returnUrl">
                {t("settings.fields.vippsReturnUrl")}
              </Label>
              <Input id="vipps_returnUrl" name="vipps_returnUrl" defaultValue={vipps.returnUrl || ''} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="vipps_callbackPrefix">
                {t("settings.fields.vippsCallbackPrefix")}
              </Label>
              <Input id="vipps_callbackPrefix" name="vipps_callbackPrefix" defaultValue={vipps.callbackPrefix || ''} />
            </div>
          </CardContent>
          <CardFooter>
            <form action={saveSettings}>
              <input type="hidden" name="section" value="vipps" />
              <Button type="submit">
                {t("settings.actions.saveVipps")}
              </Button>
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
  const { db } = await createSessionClient()
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
      await db.updateRow('app', 'shop_settings', 'singleton', {
        general: JSON.stringify(next.general || {}),
        vipps: JSON.stringify(next.vipps || {}),
      })
    } else {
      await db.createRow('app', 'shop_settings', 'singleton', {
        general: JSON.stringify(next.general || {}),
        vipps: JSON.stringify(next.vipps || {}),
      })
    }
  } catch (error) {
    console.error('Failed to save settings', error)
  }
}


