$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot 'read-local-env.ps1')
$localEnv = Read-ProjectLocalEnv -ProjectRoot $projectRoot
$entry = Join-Path $projectRoot 'apps\api\scripts\seed-templates.cjs'
if (-not (Test-Path -LiteralPath $entry)) {
    throw 'Template seed script is missing.'
}

$databasePassword = Get-ProjectLocalSecret -Settings $localEnv -Name 'POSTGRES_PASSWORD' -Prompt 'PostgreSQL password for ai_copywriting_dev'
$escapedPassword = [Uri]::EscapeDataString($databasePassword)
Remove-Variable databasePassword

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
