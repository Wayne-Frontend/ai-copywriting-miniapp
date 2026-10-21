$ErrorActionPreference = 'Stop'

$baseUrl = 'http://127.0.0.1:3000/api/admin/v1/auth'
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$username = Read-Host -Prompt 'Admin username'
$securePassword = Read-Host -Prompt 'Admin password' -AsSecureString
$password = [System.Net.NetworkCredential]::new('', $securePassword).Password
Remove-Variable securePassword
$totp = Read-Host -Prompt 'Current 6-digit authenticator code'
$loginBody = @{ username = $username; password = $password; totp = $totp } | ConvertTo-Json -Compress
Remove-Variable password, totp

$loggedIn = $false
try {
    $csrf = Invoke-RestMethod -Uri "$baseUrl/csrf" -WebSession $session
    $headers = @{ 'x-csrf-token' = $csrf.data.csrfToken }
    $login = Invoke-RestMethod -Uri "$baseUrl/login" -Method Post -WebSession $session `
        -Headers $headers -ContentType 'application/json' -Body $loginBody
    $loggedIn = $true
    Remove-Variable loginBody

    $me = Invoke-RestMethod -Uri "$baseUrl/me" -WebSession $session
    if ($login.code -ne 'OK' -or $me.code -ne 'OK' -or $me.data.admin.id -ne $login.data.admin.id) {
        throw 'Login or session response did not match the expected contract.'
    }
    Write-Host "登录和会话查询通过：$($me.data.admin.username) ($($me.data.admin.role))"
}
catch {
    if ($_.ErrorDetails.Message) {
        Write-Error $_.ErrorDetails.Message
    }
    else {
        Write-Error $_.Exception.Message
    }
    exit 1
}
finally {
    if ($loggedIn) {
        $logout = Invoke-RestMethod -Uri "$baseUrl/logout" -Method Post -WebSession $session -Headers $headers
        if ($logout.code -eq 'OK') {
            Write-Host '退出登录通过。'
        }
    }
}
