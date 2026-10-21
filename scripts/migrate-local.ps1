$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$prismaCli = Join-Path $projectRoot 'node_modules\prisma\build\index.js'
if (-not (Test-Path -LiteralPath $prismaCli)) {
    throw 'Prisma is not installed. Run pnpm install first.'
}

$securePassword = Read-Host -Prompt 'PostgreSQL password for ai_copywriting_dev' -AsSecureString
$escapedPassword = [Uri]::EscapeDataString(
    [System.Net.NetworkCredential]::new('', $securePassword).Password
)
Remove-Variable securePassword

# 仅为本次迁移设置数据库地址；密码不写入项目文件或命令历史。
$previousDatabaseUrl = [Environment]::GetEnvironmentVariable('DATABASE_URL', 'Process')
$exitCode = 1
try {
    $env:DATABASE_URL = "postgresql://postgres:${escapedPassword}@localhost:5432/ai_copywriting_dev?schema=public"
    Remove-Variable escapedPassword
    & node $prismaCli migrate deploy
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
