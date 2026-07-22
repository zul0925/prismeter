param(
  [string]$Repository = "zul0925/prismeter",
  [string]$Version = ""
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Net.Http

$ProjectRoot = Split-Path -Parent $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($Version)) {
  $Config = Get-Content -Raw -LiteralPath (Join-Path $ProjectRoot "src-tauri\tauri.conf.json") -Encoding UTF8 | ConvertFrom-Json
  $Version = $Config.version
}
if ($Version -notmatch '^\d+\.\d+\.\d+$') { throw "Invalid version: $Version" }

$Tag = "v$Version"
$NotesPath = Join-Path $ProjectRoot "release-notes\$Tag.md"
$OutputDirectory = Join-Path $ProjectRoot "outputs"
$AssetNames = @("Prismeter_${Version}_x64-setup.exe", "Prismeter_${Version}_x64-setup.exe.sig", "latest.json")
if (-not (Test-Path -LiteralPath $NotesPath)) { throw "Release notes not found: $NotesPath" }
foreach ($AssetName in $AssetNames) {
  if (-not (Test-Path -LiteralPath (Join-Path $OutputDirectory $AssetName))) { throw "Release asset not found: $AssetName" }
}

$CredentialOutput = @("protocol=https", "host=github.com", "") | git credential fill
$PasswordLine = $CredentialOutput | Where-Object { $_ -like "password=*" } | Select-Object -First 1
if (-not $PasswordLine) { throw "GitHub credential is unavailable." }
$Token = $PasswordLine.Substring("password=".Length)
$Client = New-Object System.Net.Http.HttpClient
$Client.DefaultRequestHeaders.Authorization = New-Object System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", $Token)
$Client.DefaultRequestHeaders.Accept.ParseAdd("application/vnd.github+json")
$Client.DefaultRequestHeaders.UserAgent.ParseAdd("Prismeter-Release-Publisher")

function Send-GitHubJson {
  param([string]$Method, [string]$Url, $Payload = $null, [switch]$AllowNotFound)
  $Request = New-Object System.Net.Http.HttpRequestMessage
  $Request.Method = New-Object System.Net.Http.HttpMethod($Method)
  $Request.RequestUri = [Uri]$Url
  if ($null -ne $Payload) {
    $Json = $Payload | ConvertTo-Json -Depth 5
    $Request.Content = New-Object System.Net.Http.StringContent($Json, [Text.Encoding]::UTF8, "application/json")
  }
  $Response = $Client.SendAsync($Request).GetAwaiter().GetResult()
  $Content = $Response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
  $Request.Dispose()
  if ($AllowNotFound -and [int]$Response.StatusCode -eq 404) { $Response.Dispose(); return $null }
  if (-not $Response.IsSuccessStatusCode) {
    $Status = $Response.StatusCode
    $Response.Dispose()
    throw "GitHub request failed: $Status $Content"
  }
  $Response.Dispose()
  if ([string]::IsNullOrWhiteSpace($Content)) { return $null }
  return $Content | ConvertFrom-Json
}

function Send-GitHubAsset {
  param([long]$ReleaseId, [string]$Path)
  $Name = Split-Path -Leaf $Path
  $Url = "https://uploads.github.com/repos/$Repository/releases/$ReleaseId/assets?name=$([Uri]::EscapeDataString($Name))"
  $Request = New-Object System.Net.Http.HttpRequestMessage
  $Request.Method = [System.Net.Http.HttpMethod]::Post
  $Request.RequestUri = [Uri]$Url
  $Bytes = [IO.File]::ReadAllBytes($Path)
  $Request.Content = [System.Net.Http.ByteArrayContent]::new($Bytes)
  $Request.Content.Headers.ContentType = New-Object System.Net.Http.Headers.MediaTypeHeaderValue("application/octet-stream")
  $Response = $Client.SendAsync($Request).GetAwaiter().GetResult()
  $Content = $Response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
  $Request.Dispose()
  if (-not $Response.IsSuccessStatusCode) {
    $Status = $Response.StatusCode
    $Response.Dispose()
    throw "GitHub asset upload failed for ${Name}: $Status $Content"
  }
  $Response.Dispose()
  return $Content | ConvertFrom-Json
}

$Notes = (Get-Content -LiteralPath $NotesPath -Raw -Encoding UTF8).TrimEnd()
$ReleaseUrl = "https://api.github.com/repos/$Repository/releases/tags/$Tag"
$Release = Send-GitHubJson -Method "GET" -Url $ReleaseUrl -AllowNotFound
if ($null -eq $Release) {
  $Release = Send-GitHubJson -Method "POST" -Url "https://api.github.com/repos/$Repository/releases" -Payload @{
    tag_name = $Tag
    name = "Prismeter $Tag"
    body = $Notes
    draft = $false
    prerelease = $false
  }
} else {
  $Release = Send-GitHubJson -Method "PATCH" -Url "https://api.github.com/repos/$Repository/releases/$($Release.id)" -Payload @{
    name = "Prismeter $Tag"
    body = $Notes
    draft = $false
    prerelease = $false
  }
}

foreach ($Asset in @($Release.assets)) {
  if ($AssetNames -contains $Asset.name) {
    Send-GitHubJson -Method "DELETE" -Url "https://api.github.com/repos/$Repository/releases/assets/$($Asset.id)" | Out-Null
  }
}
foreach ($AssetName in $AssetNames) {
  Send-GitHubAsset -ReleaseId $Release.id -Path (Join-Path $OutputDirectory $AssetName) | Out-Null
  Write-Output "$AssetName uploaded"
}

$Verified = Send-GitHubJson -Method "GET" -Url $ReleaseUrl
if ($Verified.body -ne $Notes) { throw "Release notes verification failed for $Tag" }
foreach ($AssetName in $AssetNames) {
  $RemoteAsset = @($Verified.assets | Where-Object { $_.name -eq $AssetName }) | Select-Object -First 1
  if ($null -eq $RemoteAsset) { throw "Release asset verification failed: $AssetName" }
  $LocalSize = (Get-Item -LiteralPath (Join-Path $OutputDirectory $AssetName)).Length
  if ([long]$RemoteAsset.size -ne $LocalSize) { throw "Release asset size mismatch: $AssetName" }
}

$Client.Dispose()
Remove-Variable Token
Write-Output "$Tag published and verified: $($Verified.html_url)"
