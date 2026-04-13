# SharePoint Documents Integration — Setup Guide

This guide covers everything needed to wire up the Document Management system with SharePoint Online, find the correct drive IDs and folder paths, configure credentials, and keep your SharePoint site pages in sync with the document library.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Azure App Registration](#2-azure-app-registration)
3. [Grant SharePoint Permissions](#3-grant-sharepoint-permissions)
4. [Configure Environment Variables](#4-configure-environment-variables)
5. [Find Your Site ID, Drive ID, and Folder Path](#5-find-your-site-id-drive-id-and-folder-path)
6. [Recommended Folder Structure in SharePoint](#6-recommended-folder-structure-in-sharepoint)
7. [Uploading Your First Document](#7-uploading-your-first-document)
8. [Keeping SharePoint Site Pages in Sync](#8-keeping-sharepoint-site-pages-in-sync)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Prerequisites

- Access to the **Azure Portal** (portal.azure.com) as an admin on the BISO tenant
- Access to the **SharePoint Admin Centre** for the BISO tenant
- The BISO SharePoint site URL (e.g. `https://bisono.sharepoint.com/sites/biso`)
- The admin app running locally or deployed with the env vars below

---

## 2. Azure App Registration

The document upload system authenticates with SharePoint using **client credentials** (app-only auth, no user sign-in required). You may already have an app registration for other Graph API integrations — check if it can be reused, or create a new one scoped only to SharePoint.

### Create a new App Registration (if needed)

1. Go to **Azure Portal → Azure Active Directory → App registrations → New registration**
2. Name: `BISO Documents API` (or reuse existing)
3. Supported account types: **Accounts in this organisational directory only**
4. Redirect URI: leave blank (not needed for client credentials)
5. Click **Register**

### Create a Client Secret

1. In your app registration, go to **Certificates & secrets → New client secret**
2. Description: `BISO Documents Production`
3. Expiry: 24 months (set a calendar reminder to rotate before expiry)
4. Copy the **Value** immediately — it is only shown once

Note down:
- **Application (client) ID** — shown on the app registration overview
- **Directory (tenant) ID** — shown on the app registration overview
- **Client secret value** — from the step above

---

## 3. Grant SharePoint Permissions

The app needs permission to read/write files in SharePoint. Use **Sites.Selected** (recommended — scoped to specific sites only) rather than `Sites.ReadWrite.All`.

### Option A — Sites.Selected (recommended)

This limits the app to only the sites you explicitly grant it access to.

**Step 1: Add the API permission in Azure**

1. In your app registration, go to **API permissions → Add a permission → Microsoft Graph → Application permissions**
2. Search for and add: `Sites.Selected`
3. Click **Grant admin consent** for your tenant

**Step 2: Grant the app access to the specific SharePoint site**

Use the Graph API Explorer or PowerShell. The easiest way is PowerShell:

```powershell
# Install if needed
Install-Module -Name PnP.PowerShell

# Connect to your SharePoint admin centre
Connect-PnPOnline -Url "https://bisono-admin.sharepoint.com" -Interactive

# Grant write access to the specific site
Grant-PnPAzureADAppSitePermission `
  -AppId "<your-client-id>" `
  -DisplayName "BISO Documents API" `
  -Site "https://bisono.sharepoint.com/sites/biso" `
  -Permissions Write
```

### Option B — Sites.ReadWrite.All (simpler, broader)

1. In your app registration, go to **API permissions → Add a permission → Microsoft Graph → Application permissions**
2. Add: `Sites.ReadWrite.All`
3. Click **Grant admin consent**

> ⚠️ This gives the app read/write access to ALL sites in your tenant. Use Sites.Selected if possible.

---

## 4. Configure Environment Variables

Add the following to your `.env.local` (admin app) and your production environment:

```env
# SharePoint / Microsoft Graph
SHAREPOINT_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
SHAREPOINT_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
SHAREPOINT_CLIENT_SECRET=your-client-secret-value

# One or more SharePoint site URLs the app is allowed to access.
# JSON array format. Used to resolve site IDs in the drive picker.
SHAREPOINT_SITES=["https://bisono.sharepoint.com/sites/biso"]
```

> The `SHAREPOINT_SITES` variable is already defined in `.env.example`. All four variables are read by `getSharePointConfig()` in `packages/connectors/src/sharepoint/index.ts`.

---

## 5. Find Your Site ID, Drive ID, and Folder Path

When creating a document in the admin app, you need to provide a **Drive ID** and a **Folder Path**. Here is how to find them.

### Method 1 — Graph Explorer (easiest)

1. Go to [Graph Explorer](https://developer.microsoft.com/en-us/graph/graph-explorer)
2. Sign in with your BISO admin account
3. Run the following queries:

**Get your site ID:**
```
GET https://graph.microsoft.com/v1.0/sites/bisono.sharepoint.com:/sites/biso
```
Copy the `id` field from the response — this is your Site ID.

**List drives (document libraries) on the site:**
```
GET https://graph.microsoft.com/v1.0/sites/{site-id}/drives
```
Each entry in `value` is a document library. Find the one you want (typically named `Documents` or `Shared Documents`). Copy its `id` field — this is your **Drive ID**.

**Browse folders in that drive:**
```
GET https://graph.microsoft.com/v1.0/drives/{drive-id}/root/children
```
Navigate into subfolders as needed to find your target path. The folder path you enter in the admin UI should match the path within the drive root, e.g. `/BISO Documents/National` or `/Governing Documents`.

### Method 2 — SharePoint URL

When you navigate to a document library folder in SharePoint Online and look at the URL, it contains the relative path after `/sites/biso/`. That relative path (from the library root) is your folder path.

For example, if the browser shows:
```
https://bisono.sharepoint.com/sites/biso/Shared%20Documents/Governing%20Documents/National
```
Then your folder path is `/Governing Documents/National`.

---

## 6. Recommended Folder Structure in SharePoint

Create this folder structure in your SharePoint document library before uploading documents through the admin app. The admin app will create files in whichever folder path you specify — it will not auto-create folders.

```
Shared Documents/
└── BISO Documents/
    ├── National/
    │   ├── Statutes/
    │   ├── Code of Conduct/
    │   ├── Business Regulations/
    │   └── Communication Guidelines/
    └── Campus Bylaws/
        ├── Oslo/
        ├── Bergen/
        ├── Trondheim/
        └── Stavanger/
```

When creating a document in the admin app:
- Set **Folder Path** to e.g. `/BISO Documents/National/Statutes`
- All versions of that document will be uploaded to that folder, replacing in place each time

---

## 7. Uploading Your First Document

Once credentials are configured and the folder structure exists in SharePoint:

1. Open the admin app and navigate to **Documents → New Document**
2. Fill in the metadata (title, category, scope, etc.)
3. In the **File & SharePoint** section:
   - If `SHAREPOINT_SITES` is configured, the **Site** dropdown will be populated automatically — select the correct site
   - If the dropdown is empty, paste the **Drive ID** directly (copy it from Graph Explorer as described above)
   - Set the **Folder Path** to the correct path within the drive (e.g. `/BISO Documents/National/Statutes`)
4. Select your PDF and click **Save**

The file is uploaded to SharePoint and the metadata (including the SharePoint item ID, drive ID, and web URL) is saved to Appwrite. Future version uploads will replace the file in-place using the stored item ID.

---

## 8. Keeping SharePoint Site Pages in Sync

If you have SharePoint Online **site pages** (modern pages) that display or link to documents — e.g. a "Governing Documents" page with embedded document viewers or links — you need to make sure those pages reference the correct files after the BISO Documents folder structure is established.

### Why pages may need updating

When a document is uploaded or replaced via the admin app, the file content changes but the **SharePoint item URL stays the same** (because we replace in-place using the item ID). This means existing SharePoint page links and embedded viewers that already point to a file will automatically show the latest version — no manual update needed for those.

However, if you are **setting up the folder structure for the first time**, existing SharePoint page links may point to old file locations or different libraries. Those need to be updated once to point to the new paths.

### Finding and updating links on SharePoint pages

1. **Open the SharePoint site page** in edit mode (click the pencil icon top-right)
2. Look for any **File Viewer web parts** or **Quick Links web parts** that reference documents
3. For each one, update the file reference to point to the corresponding file in the new `BISO Documents/` folder structure
4. For **text links** (hyperlinks in a Text web part), replace the URL with the `sharepoint_web_url` value stored in the Appwrite `documents` table — this is the direct web URL to the file on SharePoint

### Using the Appwrite web URL as the canonical link

Every document in the Appwrite `documents` table has a `sharepoint_web_url` field. This is the permanent web URL for that document on SharePoint (e.g. `https://bisono.sharepoint.com/sites/biso/Shared%20Documents/BISO%20Documents/National/Statutes/BISO_Constitution.pdf`).

Use this URL wherever you need to link to a document on a SharePoint page — it stays valid across version replacements because the file name and path do not change.

### Embedding a document viewer on a SharePoint page

To display a PDF inline on a SharePoint page:

1. Edit the page
2. Click **+** to add a web part → search for **File viewer**
3. Choose **From a link** and paste the `sharepoint_web_url` of the document
4. Save the page

The viewer will always show the latest version because the file is replaced in-place.

### Checking for broken links

After moving or renaming any documents, run a quick check:

1. In SharePoint, go to **Site contents → Site Pages**
2. Open each document-related page and verify that embedded viewers and links resolve correctly
3. Alternatively, use the **SharePoint Check Links** feature: in the page editor, any broken links will be flagged with a warning icon

---

## 9. Troubleshooting

### "SharePoint upload failed: Failed to acquire access token"

- Verify `SHAREPOINT_TENANT_ID`, `SHAREPOINT_CLIENT_ID`, and `SHAREPOINT_CLIENT_SECRET` are all set and correct
- Check the client secret has not expired in Azure (App registrations → Certificates & secrets)
- Ensure admin consent has been granted for the API permissions

### "SharePoint upload failed: 403 Forbidden"

- The app does not have write access to the target site
- If using `Sites.Selected`: re-run the `Grant-PnPAzureADAppSitePermission` command and confirm it completed without errors
- If using `Sites.ReadWrite.All`: confirm admin consent was granted in Azure Portal

### "SharePoint upload failed: 404 Not Found" on version upload

- The stored `sharepoint_item_id` no longer exists — the file may have been deleted or moved directly in SharePoint
- Fix: delete the document record in the admin app and re-create it (upload as a new document, which will store the new item ID)

### Drive ID dropdown is empty in the document editor

- `SHAREPOINT_SITES` environment variable is not set or is malformed
- It must be a valid JSON array: `["https://bisono.sharepoint.com/sites/biso"]`
- Alternatively, paste the Drive ID manually — you can always get it from Graph Explorer

### Version history not showing in SharePoint

- SharePoint versioning must be enabled on the document library
- Go to the library → **Library settings → Versioning settings** → enable **Create a version each time you edit a file**
- With versioning enabled, every in-place replace via the admin app will add a new version entry automatically
