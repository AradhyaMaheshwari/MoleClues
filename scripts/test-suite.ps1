param(
  [string]$BaseUrl = "http://localhost:3000"
)

$uri = [Uri]$BaseUrl
if ($uri.Host -notin @("localhost", "127.0.0.1")) {
  Write-Error "This smoke test is restricted to localhost so it cannot add test entries to the live event leaderboard."
  exit 1
}

$projectDir = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Definition)
$answersPath = Join-Path $projectDir "backend\answers.json"
if (-not (Test-Path $answersPath)) {
  Write-Error "Missing private local answer file: $answersPath"
  exit 1
}
$secretData = Get-Content -Raw $answersPath | ConvertFrom-Json

try {
  $teamName = "LOCAL TEST $(Get-Random -Maximum 999999)"
  $session = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/session" -ContentType "application/json" -Body (@{
    puzzleId = $secretData.puzzleId
    teamName = $teamName
  } | ConvertTo-Json -Compress)

  $wrongAnswers = @{}
  foreach ($property in $secretData.answers.PSObject.Properties) {
    $wrongAnswers[$property.Name] = $property.Value
  }
  $wrongAnswers["1"] = "INTENTIONALLY-WRONG"
  $wrongPayload = @{
    puzzleId = $secretData.puzzleId
    sessionToken = $session.sessionToken
    answers = $wrongAnswers
  } | ConvertTo-Json -Depth 10 -Compress
  $wrongResult = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/submit" -ContentType "application/json" -Body $wrongPayload
  if ($wrongResult.allCorrect) { throw "An intentionally incorrect check was marked correct." }

  $payload = @{
    puzzleId = $secretData.puzzleId
    sessionToken = $session.sessionToken
    answers = $secretData.answers
  } | ConvertTo-Json -Depth 10 -Compress
  $result = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/submit" -ContentType "application/json" -Body $payload
  if (-not $result.allCorrect) { throw "Expected a fully correct retry to finalize the team attempt." }

  $localAdminPassword = if ($env:ADMIN_PASSWORD) { $env:ADMIN_PASSWORD } else { "moleclues-local-admin" }
  $headers = @{ "X-Admin-Password" = $localAdminPassword }
  $board = Invoke-RestMethod -Method Get -Uri "$BaseUrl/api/leaderboard" -Headers $headers
  $found = @($board.attempts | Where-Object { $_.team_name -eq $teamName }).Count -gt 0
  if (-not $found) { throw "Completed test attempt did not appear in the local admin ledger." }

  Write-Host "PASS: team registration, incorrect-check retry, final scoring, timing, and leaderboard recording." -ForegroundColor Green
  Write-Host "Note: this adds one test record to backend/attempts.json. Delete that file before the real event." -ForegroundColor Yellow
} catch {
  Write-Error "Smoke test failed: $_"
  exit 1
}
