$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$entry = Join-Path $projectRoot 'apps\api\scripts\create-admin.cjs'
$apiProject = Join-Path $projectRoot 'apps\api\tsconfig.json'
$typescriptCli = Join-Path $projectRoot 'node_modules\typescript\bin\tsc'

$secureDbPassword = Read-Host -Prompt 'PostgreSQL password for ai_copywriting_dev' -AsSecureString
$escapedDbPassword = [Uri]::EscapeDataString([System.Net.NetworkCredential]::new('', $secureDbPassword).Password)
Remove-Variable secureDbPassword
$secureMfaKey = Read-Host -Prompt 'ADMIN_MFA_KEY (same value used to start API)' -AsSecureString
$mfaKey = [System.Net.NetworkCredential]::new('', $secureMfaKey).Password
Remove-Variable secureMfaKey
$username = Read-Host -Prompt 'First admin username (lowercase)'
$secureAdminPassword = Read-Host -Prompt 'First admin password (at least 12 characters)' -AsSecureString
$adminPassword = [System.Net.NetworkCredential]::new('', $secureAdminPassword).Password
Remove-Variable secureAdminPassword

$previous = @{}
foreach ($name in @('DATABASE_URL', 'ADMIN_MFA_KEY', 'BOOTSTRAP_ADMIN_USERNAME', 'BOOTSTRAP_ADMIN_PASSWORD')) {
    $previous[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
}
$exitCode = 1
try {
    $env:DATABASE_URL = "postgresql://postgres:${escapedDbPassword}@localhost:5432/ai_copywriting_dev"
    $env:ADMIN_MFA_KEY = $mfaKey
    $env:BOOTSTRAP_ADMIN_USERNAME = $username
    $env:BOOTSTRAP_ADMIN_PASSWORD = $adminPassword
    Remove-Variable escapedDbPassword, mfaKey, adminPassword
    & node $typescriptCli -p $apiProject
    if ($LASTEXITCODE -eq 0) {
        & node $entry
    }
    $exitCode = $LASTEXITCODE
}
finally {
    foreach ($name in $previous.Keys) {
        if ($null -eq $previous[$name]) {
            Remove-Item "Env:$name" -ErrorAction SilentlyContinue
        }
        else {
            [Environment]::SetEnvironmentVariable($name, $previous[$name], 'Process')
        }
    }
}
exit $exitCode
