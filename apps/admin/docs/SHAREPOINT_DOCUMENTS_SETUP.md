# SharePoint Documents Integration — Setup Guide

This guide covers everything needed to wire up the Document Management system with SharePoint Online, find the drive ID of the document library, configure credentials, and keep your SharePoint site pages in sync with the document library.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Azure App Registration](#2-azure-app-registration)
3. [Grant SharePoint Permissions](#3-grant-sharepoint-permissions)
4. [Configure Environment Variables](#4-configure-environment-variables)
5. [Find Your Site ID and Drive ID](#5-find-your-site-id-and-drive-id)
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

### Deploy order

Roll the versioned-documents feature out in this order:

1. Push the `document_versions` table to Appwrite, together with any new
   `documents.category` enum values (for example `authorization-matrix` and
   `target-documents`).
2. Set `SHAREPOINT_DOCUMENTS_DRIVE_ID` and the client secret
   (`SHAREPOINT_CLIENT_SECRET`) in the admin environment (see section 4).
3. Make sure the app registration has write access to the Intranet site (see
   section 3).
4. Deploy admin and web.

Until step 1 is done, the admin document editor shows no version history and
uploads fail with "Saved to SharePoint but the database write failed".

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
# JSON array format.
SHAREPOINT_SITES=["https://bisono.sharepoint.com/sites/biso"]

# Drive (document library) that holds "Organisational documents". Required:
# uploads fail with a configuration error when it is missing.
SHAREPOINT_DOCUMENTS_DRIVE_ID=b!...
```

> The `SHAREPOINT_SITES` variable is already defined in `.env.example`. The first four variables are read by `getSharePointConfig()` in `packages/connectors/src/sharepoint/index.ts`. The fifth, `SHAREPOINT_DOCUMENTS_DRIVE_ID`, is read by the admin app and is required for uploads: all five must be set.

---

## 5. Find Your Site ID and Drive ID

The admin form does not ask where a file should go. Every upload is written to
one document library, named by the `SHAREPOINT_DOCUMENTS_DRIVE_ID` environment
variable, and the folders inside it are worked out from the document's
category, campus and language (see section 6). The only value to look up is
that library's drive id.

1. Go to [Graph Explorer](https://developer.microsoft.com/en-us/graph/graph-explorer)
2. Sign in with your BISO admin account
3. Run the following queries:

**Get your site ID:**
```
GET https://graph.microsoft.com/v1.0/sites/bisono.sharepoint.com:/sites/biso
```
Copy the `id` field from the response — this is your Site ID. Use the path of
the Intranet site that holds `Organisational documents`.

**List drives (document libraries) on the site:**
```
GET https://graph.microsoft.com/v1.0/sites/{site-id}/drives
```
Each entry in `value` is a document library. Find the one that contains the
`Organisational documents` folder (typically named `Documents` or
`Shared Documents`). Copy its `id` field, which starts with `b!`, and set it as
`SHAREPOINT_DOCUMENTS_DRIVE_ID`.

---

## 6. Recommended Folder Structure in SharePoint

The admin app writes under `Organisational documents` in the Intranet document
library and creates any missing folders itself:

```
Organisational documents/
  <Category>/[<Campus>/]<Norsk versjon | Engelsk versjon>/
    <Title>.pdf                  ← current version, replaced in place
    Previous versions/
      <Title> v12.pdf            ← one file per uploaded version
      <Title> v11.pdf
```

Category folders are `Statutes`, `Local laws`, `Code of Conduct`,
`Authorization Matrix`, `Target Documents`, `Business Regulations` and
`Communication Guidelines`. A campus-specific document sits in a subfolder named
after its campus (for example `Local laws/Bergen/Norsk versjon/`), and national
documents sit directly under the category.

File names come from the document title, not from the uploaded file.

---

## 7. Uploading Your First Document

Once credentials are configured (folders are created automatically on the first upload):

1. Open the admin app and navigate to **Documents → New Document**
2. Fill in the metadata (title, category, scope, etc.)
3. Enter the **version** as a number (`12` or `7.1`); the `v` is added for you
4. Select your PDF and click **Save**

The file is uploaded twice: as the current file and as a per-version copy in
`Previous versions`. A public "anyone with the link" URL is created for the
current file and shown in the editor with a **Copy link** button. To publish a
later version, open the document, enter the higher version number and upload
the new PDF.

---

## 8. Keeping SharePoint Site Pages in Sync

If you have SharePoint Online **site pages** (modern pages) that display or link to documents — e.g. a "Governing Documents" page with embedded document viewers or links — you need to make sure those pages reference the correct files under `Organisational documents/`.

### Why pages may need updating

The current file is replaced in place, so its URL and its public link never
change. Link the SharePoint page to the document once, using **Copy link** in
the admin app, and it will always open the latest version.

However, if you are **setting up the folder structure for the first time**, existing SharePoint page links may point to old file locations or different libraries. Those need to be updated once to point to the new paths.

### Finding and updating links on SharePoint pages

1. **Open the SharePoint site page** in edit mode (click the pencil icon top-right)
2. Look for any **File Viewer web parts** or **Quick Links web parts** that reference documents
3. For each one, update the file reference to point to the corresponding file in the `Organisational documents/` folder structure
4. For **text links** (hyperlinks in a Text web part), open the document in the admin app, use **Copy link**, and replace the URL with the copied link

### Using the copied link as the canonical link

Open a document in the admin app and use **Copy link** to get its link. This is
the "anyone with the link" URL of the document's current file under
`Organisational documents/`.

Use this link wherever you need to link to a document on a SharePoint page — it stays valid across version replacements because the file is replaced in place and keeps its name and path.

### Embedding a document viewer on a SharePoint page

To display a PDF inline on a SharePoint page:

1. Edit the page
2. Click **+** to add a web part → search for **File viewer**
3. Choose **From a link** and paste the link you copied with **Copy link** in the admin app
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

- The current file no longer exists in SharePoint — it may have been deleted or moved directly in SharePoint
- Fix: delete the document record in the admin app and create it again with the same title, category, language, scope and campus. The new upload replaces the file at the same path, so links to that path keep working

### Version history not showing in SharePoint

- SharePoint versioning must be enabled on the document library
- Go to the library → **Library settings → Versioning settings** → enable **Create a version each time you edit a file**
- With versioning enabled, every in-place replace via the admin app will add a new version entry automatically
- This is SharePoint's own history of the current file. It exists alongside the `Previous versions` folder, which holds one PDF per uploaded version: the folder is what biso.no shows under "Previous versions", while SharePoint's version history is only visible inside SharePoint

### "SharePoint is not configured: SHAREPOINT_DOCUMENTS_DRIVE_ID is not set"

- Set `SHAREPOINT_DOCUMENTS_DRIVE_ID` to the Intranet document library's drive id

### Saved, but no public link

- The tenant or the Intranet site does not allow "Anyone" links. Enable them in
  the SharePoint admin centre, or share the `biso.no` documents page instead

### "A document with this title already exists in this category…"

- Two documents with the same title, category, language and campus would share
  one SharePoint file, so the second is refused
- Open the existing document and upload a new version instead

### "Campus not found for this document"

- The document is campus-specific but its campus could not be looked up
- Pick a valid campus and save again

### "The title, category, language, scope and campus decide where the file is stored in SharePoint and cannot be changed after upload…"

- These five values decide the file's path in SharePoint, and the file is not
  moved when a document is edited, so an edit that would change the path is
  refused. Changing only the letter case of the title is allowed
- To fix a wrong title, category, language, scope or campus, create a new
  document with the right values and delete the old one
- Description, status and department can be changed at any time

### "This category is not enabled in the database yet. Ask IT to add it to the documents table."

- The form offers the category, but the `category` column of the Appwrite
  `documents` table does not accept it yet (currently `authorization-matrix`
  and `target-documents`)
- Fix: add the value to the `documents.category` enum in Appwrite and
  regenerate the types (see "Deploy order" in section 1). Nothing was written
  to SharePoint

### "Saved to SharePoint but the database write failed…"

- The files reached SharePoint but Appwrite rejected a row, most often because
  the `document_versions` table has not been pushed yet (see "Deploy order")
- For a new document, save again. For a new version, upload the same version
  number again: the upload is repeated and the missing rows are written
