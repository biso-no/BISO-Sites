param(
    [Parameter(Mandatory = $true)]
    [string]$RoleMailbox,       # e.g. controller.oslo@biso.no

    [Parameter(Mandatory = $true)]
    [string]$OldDelegate,       # e.g. anna.smith@biso.no

    [Parameter(Mandatory = $true)]
    [string]$NewDelegate        # e.g. peter.jones@biso.no
)

# ========================
# CONFIGURATION
# ========================
$AppId     = $env:AZURE_APP_ID
$TenantId  = $env:AZURE_TENANT_ID
$Org       = "bistudentorganisasjon.onmicrosoft.com"   # Root tenant domain
$PfxPath   = "../biso-handover.pfx"
$PfxPass   = $env:AZURE_CERT_PASS   # 🔑 pulled from env var

$result = @{
    success = $true
    steps   = @()
    errors  = @()
}

function Add-Step($msg) { $result.steps += $msg }
function Add-Error($msg) { $result.success = $false; $result.errors += $msg }

# ========================
# MODULE IMPORTS
# ========================
try {
    Import-Module ExchangeOnlineManagement -ErrorAction Stop
    Import-Module Microsoft.Graph.Users -ErrorAction Stop
    Import-Module Microsoft.Graph.Groups -ErrorAction Stop
}
catch {
    Add-Error "Failed to import modules: $_"
    $result | ConvertTo-Json -Compress
    exit 1
}

# ========================
# CERTIFICATE LOAD
# ========================
try {
    if (-not $PfxPass) {
        throw "Environment variable AZURE_CERT_PASS is not set"
    }

    $securePass = ConvertTo-SecureString $PfxPass -AsPlainText -Force
    $cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2($PfxPath, $securePass)
    Add-Step "Loaded certificate from $PfxPath"
}
catch {
    Add-Error "Failed to load certificate: $_"
    $result | ConvertTo-Json -Compress
    exit 1
}

# ========================
# CONNECT
# ========================
try {
    Connect-ExchangeOnline -AppId $AppId -Organization $Org -Certificate $cert -ShowBanner:$false
    Connect-MgGraph -ClientId $AppId -TenantId $TenantId -Certificate $cert -NoWelcome -ErrorAction Stop
    Select-MgProfile -Name beta
    Add-Step "Connected to Exchange Online & Microsoft Graph"
}
catch {
    Add-Error "Failed to connect to EXO/Graph: $_"
    $result | ConvertTo-Json -Compress
    exit 1
}

# ========================
# MAILBOX PERMISSIONS
# ========================
try {
    Remove-MailboxPermission -Identity $RoleMailbox -User $OldDelegate -AccessRights FullAccess -Confirm:$false -ErrorAction SilentlyContinue
    Remove-RecipientPermission -Identity $RoleMailbox -Trustee $OldDelegate -AccessRights SendAs -Confirm:$false -ErrorAction SilentlyContinue
    Add-Step "Removed delegate: $OldDelegate"

    Add-MailboxPermission -Identity $RoleMailbox -User $NewDelegate -AccessRights FullAccess -InheritanceType All -AutoMapping:$true -ErrorAction Stop
    Add-RecipientPermission -Identity $RoleMailbox -Trustee $NewDelegate -AccessRights SendAs -Confirm:$false -ErrorAction Stop
    Add-Step "Added delegate: $NewDelegate"
}
catch {
    Add-Error "Mailbox delegation failed: $_"
}

# ========================
# METADATA TRANSFER
# ========================
try {
    $oldUser = Get-MgUser -UserId $OldDelegate -Property JobTitle,Department,OfficeLocation,MobilePhone,BusinessPhones,StreetAddress,PostalCode,City,State,Country,Manager
    $updateParams = @{}

    foreach ($prop in "JobTitle","Department","OfficeLocation","MobilePhone","BusinessPhones","StreetAddress","PostalCode","City","State","Country") {
        if ($oldUser.$prop) { $updateParams[$prop.Substring(0,1).ToLower() + $prop.Substring(1)] = $oldUser.$prop }
    }

    if ($updateParams.Count -gt 0) {
        Update-MgUser -UserId $NewDelegate @updateParams -ErrorAction Stop
        Add-Step "Transferred metadata to $NewDelegate"
    }

    $mgr = Get-MgUserManager -UserId $OldDelegate -ErrorAction SilentlyContinue
    if ($mgr) {
        Set-MgUserManagerByRef -UserId $NewDelegate -RefUri "/users/$($mgr.Id)" -ErrorAction Stop
        Add-Step "Manager updated for $NewDelegate"
    }
}
catch {
    Add-Error "Metadata transfer failed: $_"
}

# ========================
# RESET OLD DELEGATE
# ========================
try {
    Update-MgUser -UserId $OldDelegate `
        -JobTitle "Alumni" `
        -Department "Alumni" `
        -OfficeLocation "" `
        -MobilePhone "" `
        -BusinessPhones @() `
        -StreetAddress "" `
        -PostalCode "" `
        -City "" `
        -State "" `
        -Country "" `
        -ErrorAction Stop

    Add-Step "$OldDelegate reset to Alumni"
}
catch {
    Add-Error "Failed to reset old delegate: $_"
}

# ========================
# GROUP MEMBERSHIP TRANSFER
# ========================
try {
    $oldUserObj = Get-MgUser -UserId $OldDelegate -Property Id
    $newUserObj = Get-MgUser -UserId $NewDelegate -Property Id
    $oldGroups  = Get-MgUserMemberOf -UserId $OldDelegate -All | Where-Object { $_.'@odata.type' -eq "#microsoft.graph.group" }

    foreach ($group in $oldGroups) {
        try {
            Remove-MgGroupMemberByRef -GroupId $group.Id -DirectoryObjectId $oldUserObj.Id -ErrorAction SilentlyContinue
            New-MgGroupMember -GroupId $group.Id -DirectoryObjectId $newUserObj.Id -ErrorAction SilentlyContinue
            Add-Step "Transferred group: $($group.DisplayName)"
        }
        catch {
            Add-Error "Failed group transfer ($($group.DisplayName)): $_"
        }
    }
}
catch {
    Add-Error "Group membership transfer failed: $_"
}

# ========================
# CLEANUP
# ========================
Disconnect-ExchangeOnline -Confirm:$false
Disconnect-MgGraph
Add-Step "Disconnected from EXO & Graph"

# ========================
# OUTPUT
# ========================
$result | ConvertTo-Json -Compress
exit ($(if ($result.success) {0} else {1}))
