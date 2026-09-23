# Deploy ALL edge functions to your own Supabase project (Windows PowerShell).
#
# One-time setup (in PowerShell):
#   npm i -g supabase
#   supabase login
#   supabase link --project-ref rdmrxeplasttewtlfetc
#
# Then run:  powershell -ExecutionPolicy Bypass -File scripts/deploy-functions.ps1

$ErrorActionPreference = "Continue"
$ProjectRef = if ($env:PROJECT_REF) { $env:PROJECT_REF } else { "rdmrxeplasttewtlfetc" }

Set-Location (Join-Path $PSScriptRoot "..")

$Failed = @()
Get-ChildItem -Directory "supabase/functions" | ForEach-Object {
    $name = $_.Name
    if ($name.StartsWith("_")) { return }            # skip _shared
    if (-not (Test-Path (Join-Path $_.FullName "index.ts"))) { return }

    Write-Host "==> deploying $name"
    supabase functions deploy $name --project-ref $ProjectRef --no-verify-jwt
    if ($LASTEXITCODE -ne 0) { $Failed += $name }
}

Write-Host ""
if ($Failed.Count -eq 0) {
    Write-Host "All functions deployed."
} else {
    Write-Host "Failed ($($Failed.Count)): $($Failed -join ', ')"
    Write-Host "Re-run this script to retry just those."
}
