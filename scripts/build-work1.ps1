$ErrorActionPreference = 'Stop'
if ($env:POWERSHELL_TELEMETRY_OPTOUT -ne '1' -or $env:DOTNET_CLI_TELEMETRY_OPTOUT -ne '1') {
    throw 'Start with Build-Work1.cmd so telemetry is disabled before PowerShell starts.'
}
$work1Root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
Set-Location -LiteralPath $work1Root
$work1Node = $null
$work1NodeCommand = Get-Command node -ErrorAction SilentlyContinue
if ($work1NodeCommand) { $work1Node = $work1NodeCommand.Source }
if (-not $work1Node -and $env:CODEX_PRIMARY_RUNTIME_NODE -and (Test-Path -LiteralPath $env:CODEX_PRIMARY_RUNTIME_NODE)) {
    $work1Node = $env:CODEX_PRIMARY_RUNTIME_NODE
}
if (-not $work1Node -and (Test-Path -LiteralPath 'C:\Program Files\nodejs\node.exe')) {
    $work1Node = 'C:\Program Files\nodejs\node.exe'
}
if (-not $work1Node) {
    $work1Runtimes = Get-AppxPackage -Name 'OpenAI.CodexPrimaryRuntime*' -ErrorAction SilentlyContinue | Sort-Object Version -Descending
    foreach ($work1Runtime in $work1Runtimes) {
        $work1Candidate = Join-Path $work1Runtime.InstallLocation 'dependencies\node\bin\node.exe'
        if (Test-Path -LiteralPath $work1Candidate) { $work1Node = $work1Candidate; break }
    }
}
if (-not $work1Node) { throw 'Installed Node.js 24 or the Codex primary runtime is required. No package or runtime is downloaded by this launcher.' }
$work1RuntimeRoot = Split-Path (Split-Path $work1Node -Parent) -Parent
$work1Data = Join-Path $work1Root 'data\work1'
$work1Output = Join-Path $work1Root 'Work1-Output'
New-Item -ItemType Directory -Path $work1Data,$work1Output -Force | Out-Null
$work1Guard = Join-Path $PSScriptRoot 'work1-offline-guard.cjs'
$work1NodeFlags = @(
    '--permission', '--allow-addons',
    "--allow-fs-read=$work1Root", "--allow-fs-read=$work1RuntimeRoot",
    "--allow-fs-write=$work1Data", "--allow-fs-write=$work1Output",
    '--require', $work1Guard
)
Write-Host 'Checking offline network/process denial before opening the Work1 database...'
& $work1Node @work1NodeFlags (Join-Path $PSScriptRoot 'check-work1-offline-guard.js')
if ($LASTEXITCODE -ne 0) { throw 'Offline guard check failed; import was not started.' }
Write-Host 'Resuming the same Work1 order. Stop Start-Work1 first if it is running.'
Write-Host 'Rendering uses local Sharp/Pango and installed fonts. No browser, network API or package download is used.'
Write-Host 'All 100 native-resolution PNGs and a large lossless A3 review PDF may take about 8-10 minutes.'
$work1Log = Join-Path $work1Data ('offline-build-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.log')
$work1PreviousErrorPreference = $ErrorActionPreference
try {
    # Windows PowerShell wraps ordinary native stderr warnings in ErrorRecords.
    # Preserve them in the log and check Node's actual exit code explicitly.
    $ErrorActionPreference = 'Continue'
    & $work1Node @work1NodeFlags (Join-Path $PSScriptRoot 'work1-batch.js') 2>&1 | Tee-Object -FilePath $work1Log
    $work1Exit = $LASTEXITCODE
} finally { $ErrorActionPreference = $work1PreviousErrorPreference }
if ($work1Exit -ne 0) { throw "Work1 stopped with exit code $work1Exit. Saved IDs, drafts and proofs remain resumable. Log: $work1Log" }
if (-not (Test-Path -LiteralPath (Join-Path $work1Output 'RUN-REPORT.json'))) { throw 'The batch exited without a completion report. Do not assume the 100-design export is complete.' }
Write-Host "Completed. Open $work1Output\index.html. Proofs remain unapproved; physical calibration is still required."
