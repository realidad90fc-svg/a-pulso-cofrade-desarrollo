$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$path = Join-Path $PSScriptRoot 'version.json'
$scriptPath = Join-Path $PSScriptRoot 'web-version.js'
$data = Get-Content -Raw -Encoding UTF8 $path | ConvertFrom-Json
$old = [string]$data.version
$new = 'dev-' + (Get-Date -Format 'yyyy.MM.dd.HHmmss')
$js = [System.IO.File]::ReadAllText($scriptPath)
$needle = "const INSTALLED_VERSION = '" + $old + "';"
if (-not $js.Contains($needle)) { throw 'La version en web-version.js y version.json no coincide. No se ha modificado nada.' }
$js = $js.Replace($needle, "const INSTALLED_VERSION = '" + $new + "';")
$data.version = $new
$data | ConvertTo-Json -Depth 5 | Set-Content -Encoding UTF8 $path
[System.IO.File]::WriteAllText($scriptPath, $js, (New-Object System.Text.UTF8Encoding($false)))
Write-Host "Nueva version lista: $new" -ForegroundColor Green
