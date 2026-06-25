# BISO Expense Approvals — Teams bot

Provisioned in the BISO tenant (`74a117b9-9343-4c86-b44d-398c88ba1ed8`) for the
direct-to-ledger reimbursement approval flow. This folder is the **Teams app
package** (manifest + icons) used to publish the bot to the org app catalog.

## Provisioned resources

| Resource | Value |
|---|---|
| App registration | **BISO Expense Approvals Bot** |
| Bot Microsoft App ID | `62b0ae22-d882-4516-ab5f-37de1b5f7de8` |
| Azure Bot resource | `biso-expense-approvals` (RG `BISOapp`, F0, SingleTenant) |
| Messaging endpoint | `https://api.biso.no/api/teams/bot` |
| Teams channel | enabled |
| Teams app (manifest) id | `287d6b99-0b85-49d0-afa2-c75920bb5f9a` |
| Graph app permissions (consented) | `Mail.Send`, `TeamsAppInstallation.ReadWriteForUser.All`, `User.Read.All` |

The client **secret** is not stored here — set it as `TEAMS_BOT_APP_PASSWORD`
(see below). Rotate it in Entra → App registrations → BISO Expense Approvals Bot.

## Environment variables (api service)

```
TEAMS_BOT_APP_ID=62b0ae22-d882-4516-ab5f-37de1b5f7de8
TEAMS_BOT_APP_PASSWORD=<the client secret>
TEAMS_BOT_APP_TENANT_ID=74a117b9-9343-4c86-b44d-398c88ba1ed8
TEAMS_APP_ID=287d6b99-0b85-49d0-afa2-c75920bb5f9a   # catalog app id (verify after upload, see below)
```

The approver lookup (`findUsersByDepartment`) reuses the existing `AZURE_GRAPH_*`
app; the bot app above carries the install/mail Graph permissions.

## Remaining manual step — publish to the org catalog

The bot can only be installed for users once its app package is in the org
catalog:

1. **Teams Admin Center** → Teams apps → Manage apps → **Upload new app** →
   upload `biso-expense-approvals.zip`. (Or Graph `POST /appCatalogs/teamsApps`
   with `AppCatalog.ReadWrite.All`.)
2. Confirm the **catalog app id** used for proactive install:
   ```
   az rest --method GET --url "https://graph.microsoft.com/v1.0/appCatalogs/teamsApps?\$filter=externalId eq '287d6b99-0b85-49d0-afa2-c75920bb5f9a'" --query "value[].id" -o tsv
   ```
   Set `TEAMS_APP_ID` to that value (usually equals the manifest id for custom
   line-of-business apps).

## Icons

`color.png` (192×192) and `outline.png` (32×32) are **solid-colour placeholders**.
Replace with the real BISO marks and re-zip before publishing if desired:
`(cd apps/api/teams-manifest && zip biso-expense-approvals.zip manifest.json color.png outline.png)`.
