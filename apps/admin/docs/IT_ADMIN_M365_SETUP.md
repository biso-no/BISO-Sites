# IT Admin Microsoft 365 Setup

The admin IT area uses server-side Microsoft Graph application credentials. Do not expose these values with `NEXT_PUBLIC_` prefixes.

## Environment Variables

Configure these for the admin deployment:

```bash
AZURE_GRAPH_TENANT_ID=00000000-0000-0000-0000-000000000000
AZURE_GRAPH_CLIENT_ID=00000000-0000-0000-0000-000000000000
AZURE_GRAPH_CLIENT_SECRET=...
M365_DOMAIN=biso.no
```

`AZURE_GRAPH_CLIENT_SECRET` is intentionally separate from SharePoint or other Microsoft integrations so credentials can be rotated and scoped independently.

## Phase 1 Graph Permissions

Grant application permissions and admin consent for the app registration used by the admin app.

- `User.Read.All` for user search and profile reads.
- `User.ReadWrite.All` for user create and basic profile updates.
- `GroupMember.Read.All` for group membership reads.
- `UserAuthenticationMethod.Read.All` for the MFA/authentication-method summary.
- `AuditLog.Read.All` plus Microsoft Entra ID P1/P2 licensing for `signInActivity`.

If `signInActivity` or authentication methods are unavailable, the UI should degrade safely and show an actionable permission message.

## Future Write Permissions

Do not grant these until the corresponding safe server actions and audit workflows exist:

- `GroupMember.ReadWrite.All` for group membership changes.
- `LicenseAssignment.ReadWrite.All` for license assignment/removal.
- `UserAuthenticationMethod.ReadWrite.All` for authentication method reset/removal and Temporary Access Pass flows.
- `User.RevokeSessions.All` for session revocation.
- Password-profile permissions for password reset or force-change flows.

Alias add/remove/transfer, mailbox conversion, and mailbox delegation are Exchange Online-owned workflows. Phase 1 only reads Graph-visible aliases and checks conflicts; destructive mailbox operations must be implemented behind explicit Exchange Online PowerShell service abstractions.
