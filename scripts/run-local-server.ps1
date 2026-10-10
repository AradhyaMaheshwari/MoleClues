param(
    [int]$Port = 3000
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$projectDir = Split-Path -Parent $scriptDir
$serverFile = Join-Path $projectDir "backend\server.js"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error "Node.js was not found. Install Node.js LTS or run: node backend/server.js"
    exit 1
}
if (-not (Test-Path $serverFile)) {
    Write-Error "Local server not found at $serverFile"
    exit 1
}

$env:PORT = [string]$Port
if (-not $env:ADMIN_PASSWORD) {
    $env:ADMIN_PASSWORD = "moleclues-local-admin"
}

Write-Host "Starting MoleClues local server on http://localhost:$Port" -ForegroundColor Green
Write-Host "Admin dashboard: http://localhost:$Port/admin.html" -ForegroundColor Cyan
Write-Host "Local-only admin password: $env:ADMIN_PASSWORD" -ForegroundColor Yellow
Write-Host "Press Ctrl+C to stop the server." -ForegroundColor DarkGray
node $serverFile
