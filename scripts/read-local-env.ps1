function Read-ProjectLocalEnv {
    param([Parameter(Mandatory = $true)][string]$ProjectRoot)

    $path = Join-Path $ProjectRoot '.env.local'
    $settings = @{}
    if (-not (Test-Path -LiteralPath $path)) {
        return $settings
    }

    $allowedNames = @('POSTGRES_PASSWORD', 'ADMIN_MFA_KEY', 'DASHSCOPE_API_KEY', 'DASHSCOPE_BASE_URL', 'DASHSCOPE_MODEL')
    $lineNumber = 0
    foreach ($line in [System.IO.File]::ReadAllLines($path, [System.Text.UTF8Encoding]::new($false, $true))) {
        $lineNumber++
        if ($line -match '^\s*(#.*)?$') {
            continue
        }
        if ($line -notmatch '^([A-Z][A-Z0-9_]*)=(.*)$') {
            throw "Invalid .env.local line ${lineNumber}: use KEY=value without spaces around =."
        }
        $name = $Matches[1]
        $value = $Matches[2]
        if ($name -notin $allowedNames) {
            throw "Unsupported .env.local key on line ${lineNumber}: $name"
        }
        if ($settings.ContainsKey($name)) {
            throw "Duplicate .env.local key on line ${lineNumber}: $name"
        }
        # 兼容常见 dotenv 写法；只去掉成对的外层引号，不解释密钥中的特殊字符。
        if ($value.StartsWith('"') -or $value.StartsWith("'")) {
            $quote = $value.Substring(0, 1)
            if ($value.Length -lt 2 -or -not $value.EndsWith($quote)) {
                throw "Invalid .env.local line ${lineNumber}: the value has an unmatched quote."
            }
            $value = $value.Substring(1, $value.Length - 2)
        }
        $settings[$name] = $value
    }
    return $settings
}

function Get-ProjectLocalSecret {
    param(
        [Parameter(Mandatory = $true)][hashtable]$Settings,
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string]$Prompt,
        [switch]$AllowEmpty
    )

    if ($Settings.ContainsKey($Name) -and ($Settings[$Name].Length -gt 0 -or $AllowEmpty)) {
        return $Settings[$Name]
    }
    $secureValue = Read-Host -Prompt $Prompt -AsSecureString
    $value = [System.Net.NetworkCredential]::new('', $secureValue).Password
    Remove-Variable secureValue
    return $value
}
