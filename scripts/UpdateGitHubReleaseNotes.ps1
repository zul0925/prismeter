param(
    [string[]]$Tags = @("v0.18.1", "v0.18.2", "v0.18.3", "v0.18.4", "v0.18.5", "v0.18.6", "v0.18.7", "v0.18.8")
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Net.Http

$repository = "zul0925/prismeter"
$credentialOutput = @("protocol=https", "host=github.com", "") | git credential fill
$passwordLine = $credentialOutput | Where-Object { $_ -like "password=*" } | Select-Object -First 1
if (-not $passwordLine) { throw "GitHub credential is unavailable." }
$token = $passwordLine.Substring("password=".Length)
$client = New-Object System.Net.Http.HttpClient
$client.DefaultRequestHeaders.Authorization = New-Object System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", $token)
$client.DefaultRequestHeaders.Accept.ParseAdd("application/vnd.github+json")
$client.DefaultRequestHeaders.UserAgent.ParseAdd("Prismeter-Release-Maintainer")

function Send-GitHubJson {
    param([string]$Method, [string]$Url, $Payload = $null)
    $request = New-Object System.Net.Http.HttpRequestMessage
    $request.Method = New-Object System.Net.Http.HttpMethod($Method)
    $request.RequestUri = [Uri]$Url
    if ($null -ne $Payload) {
        $json = $Payload | ConvertTo-Json -Depth 5
        $request.Content = New-Object System.Net.Http.StringContent($json, [Text.Encoding]::UTF8, "application/json")
    }
    $response = $client.SendAsync($request).GetAwaiter().GetResult()
    $content = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
    $request.Dispose()
    if (-not $response.IsSuccessStatusCode) {
        $status = $response.StatusCode
        $response.Dispose()
        throw "GitHub request failed: $status $content"
    }
    $response.Dispose()
    return $content | ConvertFrom-Json
}

foreach ($tag in $Tags) {
    if ($tag -notmatch '^v\d+\.\d+\.\d+$') { throw "Invalid release tag: $tag" }
    $notesPath = Join-Path $PSScriptRoot "..\release-notes\$tag.md"
    if (-not (Test-Path -LiteralPath $notesPath)) { throw "Release notes not found: $notesPath" }
    $notes = (Get-Content -LiteralPath $notesPath -Raw -Encoding UTF8).TrimEnd()
    $release = Send-GitHubJson -Method "GET" -Url "https://api.github.com/repos/$repository/releases/tags/$tag"
    $updated = Send-GitHubJson -Method "PATCH" -Url "https://api.github.com/repos/$repository/releases/$($release.id)" -Payload @{ body = $notes }
    if ($updated.body -ne $notes) { throw "Release verification failed for $tag" }
    Write-Output "$tag updated and verified"
}

$client.Dispose()
Remove-Variable token
