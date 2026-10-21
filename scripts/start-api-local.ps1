$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$apiProject = Join-Path $projectRoot 'apps\api\tsconfig.json'
$apiEntry = Join-Path $projectRoot 'apps\api\dist\main.js'
$typescriptCli = Join-Path $projectRoot 'node_modules\typescript\bin\tsc'
if (-not (Test-Path -LiteralPath $typescriptCli)) {
    throw 'TypeScript is not installed. Run pnpm install first.'
}

$securePassword = Read-Host -Prompt 'PostgreSQL password for ai_copywriting_dev' -AsSecureString
$secureMfaKey = Read-Host -Prompt 'ADMIN_MFA_KEY (base64, same value on every start)' -AsSecureString
$mfaKey = [System.Net.NetworkCredential]::new('', $secureMfaKey).Password
Remove-Variable secureMfaKey
$escapedPassword = [Uri]::EscapeDataString(
    [System.Net.NetworkCredential]::new('', $securePassword).Password
)
Remove-Variable securePassword

# 仅在当前进程及启动的 API 子进程中提供连接地址，退出后恢复原环境变量。
$previousDatabaseUrl = [Environment]::GetEnvironmentVariable('DATABASE_URL', 'Process')
$previousMfaKey = [Environment]::GetEnvironmentVariable('ADMIN_MFA_KEY', 'Process')
$exitCode = 1
try {
    $env:DATABASE_URL = "postgresql://postgres:${escapedPassword}@localhost:5432/ai_copywriting_dev"
    $env:ADMIN_MFA_KEY = $mfaKey
    Remove-Variable escapedPassword
    Remove-Variable mfaKey
    & node $typescriptCli -p $apiProject
    if ($LASTEXITCODE -ne 0) {
        $exitCode = $LASTEXITCODE
    }
    else {
        & node $apiEntry
        $exitCode = $LASTEXITCODE
    }
}
finally {
    if ($null -eq $previousDatabaseUrl) {
        Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
    }
    else {
        $env:DATABASE_URL = $previousDatabaseUrl
    }
    if ($null -eq $previousMfaKey) {
        Remove-Item Env:ADMIN_MFA_KEY -ErrorAction SilentlyContinue
    }
    else {
        $env:ADMIN_MFA_KEY = $previousMfaKey
    }
}

exit $exitCode
