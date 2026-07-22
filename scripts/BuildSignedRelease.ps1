param(
  [string]$Notes = "",
  [string]$Repository = "zul0925/prismeter"
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$ConfigPath = Join-Path $ProjectRoot "src-tauri\tauri.conf.json"
$KeyPath = Join-Path $ProjectRoot ".tauri-keys\prismeter.key"
$PasswordPath = Join-Path $ProjectRoot ".tauri-keys\prismeter.password"
$OutputDirectory = Join-Path $ProjectRoot "outputs"
$BundleDirectory = Join-Path $ProjectRoot "src-tauri\target\release\bundle\nsis"

if (-not (Test-Path -LiteralPath $KeyPath)) {
  throw "Missing updater private key: $KeyPath. Restore the original key from a secure backup."
}
$KeyPassword = $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD
if ([string]::IsNullOrEmpty($KeyPassword) -and (Test-Path -LiteralPath $PasswordPath)) {
  $KeyPassword = (Get-Content -Raw -LiteralPath $PasswordPath -Encoding ASCII).Trim()
}
if ([string]::IsNullOrEmpty($KeyPassword)) {
  throw "Missing updater key password. Restore $PasswordPath or set TAURI_SIGNING_PRIVATE_KEY_PASSWORD."
}

$Config = Get-Content -Raw -LiteralPath $ConfigPath -Encoding UTF8 | ConvertFrom-Json
$Version = $Config.version
$NotesPath = Join-Path $ProjectRoot "release-notes\v$Version.md"
if ([string]::IsNullOrWhiteSpace($Notes)) {
  if (-not (Test-Path -LiteralPath $NotesPath)) {
    throw "Release notes not found: $NotesPath"
  }
  $Notes = (Get-Content -Raw -LiteralPath $NotesPath -Encoding UTF8).Trim()
}
$InstallerName = "Prismeter_${Version}_x64-setup.exe"
$InstallerPath = Join-Path $BundleDirectory $InstallerName
$SignaturePath = "$InstallerPath.sig"

$env:TAURI_SIGNING_PRIVATE_KEY = $KeyPath
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = $KeyPassword
Push-Location $ProjectRoot
try {
  & npm.cmd run build
  if ($LASTEXITCODE -ne 0) { throw "Tauri build failed." }
} finally {
  Pop-Location
  Remove-Item Env:\TAURI_SIGNING_PRIVATE_KEY -ErrorAction SilentlyContinue
  Remove-Item Env:\TAURI_SIGNING_PRIVATE_KEY_PASSWORD -ErrorAction SilentlyContinue
}

if (-not (Test-Path -LiteralPath $InstallerPath) -or -not (Test-Path -LiteralPath $SignaturePath)) {
  throw "The installer or updater signature was not generated."
}

New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
Copy-Item -LiteralPath $InstallerPath -Destination (Join-Path $OutputDirectory $InstallerName) -Force
Copy-Item -LiteralPath $SignaturePath -Destination (Join-Path $OutputDirectory "$InstallerName.sig") -Force

$Signature = (Get-Content -Raw -LiteralPath $SignaturePath -Encoding UTF8).Trim()
$Manifest = [ordered]@{
  version = $Version
  notes = $Notes
  pub_date = [DateTime]::UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ")
  platforms = [ordered]@{
    "windows-x86_64" = [ordered]@{
      signature = $Signature
      url = "https://github.com/$Repository/releases/download/v$Version/$InstallerName"
    }
  }
}
$ManifestJson = $Manifest | ConvertTo-Json -Depth 5
# Windows PowerShell's `Set-Content -Encoding UTF8` writes a BOM. Tauri's
# updater expects strict JSON, so write UTF-8 explicitly without a BOM.
$Utf8WithoutBom = New-Object System.Text.UTF8Encoding($false)
[IO.File]::WriteAllText((Join-Path $OutputDirectory "latest.json"), $ManifestJson, $Utf8WithoutBom)

Write-Host "Release artifacts ready in $OutputDirectory"
Write-Host "Upload $InstallerName, $InstallerName.sig and latest.json to GitHub Release v$Version"
