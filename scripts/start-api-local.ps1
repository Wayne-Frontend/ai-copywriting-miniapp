$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot 'read-local-env.ps1')
$localEnv = Read-ProjectLocalEnv -ProjectRoot $projectRoot
$apiProject = Join-Path $projectRoot 'apps\api\tsconfig.json'
$apiEntry = Join-Path $projectRoot 'apps\api\dist\main.js'
$typescriptCli = Join-Path $projectRoot 'node_modules\typescript\bin\tsc'
if (-not (Test-Path -LiteralPath $typescriptCli)) {
    throw 'TypeScript is not installed. Run pnpm install first.'
}

$databasePassword = Get-ProjectLocalSecret -Settings $localEnv -Name 'POSTGRES_PASSWORD' -Prompt 'PostgreSQL password for ai_copywriting_dev'
$mfaKey = Get-ProjectLocalSecret -Settings $localEnv -Name 'ADMIN_MFA_KEY' -Prompt 'ADMIN_MFA_KEY (base64, same value on every start)'
$bailianKey = Get-ProjectLocalSecret -Settings $localEnv -Name 'DASHSCOPE_API_KEY' -Prompt 'DASHSCOPE_API_KEY (leave blank to skip model tests)' -AllowEmpty
$escapedPassword = [Uri]::EscapeDataString($databasePassword)
Remove-Variable databasePassword

# 仅在当前进程及启动的 API 子进程中提供连接地址，退出后恢复原环境变量。
$previousDatabaseUrl = [Environment]::GetEnvironmentVariable('DATABASE_URL', 'Process')
$previousMfaKey = [Environment]::GetEnvironmentVariable('ADMIN_MFA_KEY', 'Process')
$previousBailianKey = [Environment]::GetEnvironmentVariable('DASHSCOPE_API_KEY', 'Process')
$previousBaseUrl = [Environment]::GetEnvironmentVariable('DASHSCOPE_BASE_URL', 'Process')
$previousModel = [Environment]::GetEnvironmentVariable('DASHSCOPE_MODEL', 'Process')
$exitCode = 1
try {
    $env:DATABASE_URL = "postgresql://postgres:${escapedPassword}@localhost:5432/ai_copywriting_dev"
    $env:ADMIN_MFA_KEY = $mfaKey
    if ($bailianKey) {
        $env:DASHSCOPE_API_KEY = $bailianKey
    }
    else {
        Remove-Item Env:DASHSCOPE_API_KEY -ErrorAction SilentlyContinue
    }
    foreach ($name in @('DASHSCOPE_BASE_URL', 'DASHSCOPE_MODEL')) {
        if ($localEnv.ContainsKey($name)) {
            [Environment]::SetEnvironmentVariable($name, $localEnv[$name], 'Process')
        }
    }
    Remove-Variable escapedPassword
    Remove-Variable mfaKey
    Remove-Variable bailianKey
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
    if ($null -eq $previousBailianKey) {
        Remove-Item Env:DASHSCOPE_API_KEY -ErrorAction SilentlyContinue
    }
    else {
        $env:DASHSCOPE_API_KEY = $previousBailianKey
    }
    [Environment]::SetEnvironmentVariable('DASHSCOPE_BASE_URL', $previousBaseUrl, 'Process')
    [Environment]::SetEnvironmentVariable('DASHSCOPE_MODEL', $previousModel, 'Process')
}

exit $exitCode
