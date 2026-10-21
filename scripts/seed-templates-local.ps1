$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$entry = Join-Path $projectRoot 'apps\api\scripts\seed-templates.cjs'
if (-not (Test-Path -LiteralPath $entry)) {
    throw 'Template seed script is missing.'
}

$securePassword = Read-Host -Prompt 'PostgreSQL password for ai_copywriting_dev' -AsSecureString
$escapedPassword = [Uri]::EscapeDataString(
    [System.Net.NetworkCredential]::new('', $securePassword).Password
)
Remove-Variable securePassword

$previousDatabaseUrl = [Environment]::GetEnvironmentVariable('DATABASE_URL', 'Process')
$exitCode = 1
try {
    Set-Item -Path Env:DATABASE_URL -Value ('postgresql://postgres:' + $escapedPassword + '@localhost:5432/ai_copywriting_dev')
    if (-not $env:DATABASE_URL) {
        throw 'Failed to pass the database address to the seed process.'
    }
    Remove-Variable escapedPassword
    & node $entry
    $exitCode = $LASTEXITCODE
}
finally {
    if ($null -eq $previousDatabaseUrl) {
        Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
    }
    else {
        $env:DATABASE_URL = $previousDatabaseUrl
    }
}

exit $exitCode
