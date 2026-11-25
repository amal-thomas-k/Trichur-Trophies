param([switch]$CheckOnly)

# Work1 is a deliberately separate local instance. Do not load .env here.
$ErrorActionPreference = 'Stop'
$projectRoot = [System.IO.Path]::GetFullPath((Split-Path $PSScriptRoot))
$work1Data = Join-Path $projectRoot 'data\work1'
$savedLocation = Get-Location
$environmentNames = @('DATA_DIR','HOST','PORT','BASE_URL','NODE_ENV','TT_WORK1_SETUP_PASSWORD','TT_OFFLINE_RENDERING')
$previousEnvironment = @{}
foreach ($name in $environmentNames) { $previousEnvironment[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }
$workerProcess = $null
$portProbe = $null

function Resolve-Work1Node {
    $command = Get-Command node -ErrorAction SilentlyContinue
    if ($command -and $command.Source) { return $command.Source }
    foreach ($candidate in @($env:CODEX_PRIMARY_RUNTIME_NODE, 'C:\Program Files\nodejs\node.exe')) {
        if ($candidate -and (Test-Path -LiteralPath $candidate -PathType Leaf)) { return $candidate }
    }
    # A desktop shortcut need not inherit Codex's injected PATH.
    if (Get-Command Get-AppxPackage -ErrorAction SilentlyContinue) {
        $runtimes = Get-AppxPackage -Name 'OpenAI.CodexPrimaryRuntime*' -ErrorAction SilentlyContinue | Sort-Object Version -Descending
        foreach ($runtime in $runtimes) {
            $candidate = Join-Path $runtime.InstallLocation 'dependencies\node\bin\node.exe'
            if (Test-Path -LiteralPath $candidate -PathType Leaf) { return $candidate }
        }
    }
    throw 'Node.js was not found. Install Node.js 24 LTS or run this script from the existing Codex terminal.'
}

function Assert-Work1Stopped {
    if (Test-Path -LiteralPath (Join-Path $work1Data 'maintenance.lock')) { throw 'Work1 backup/retention maintenance is active. Finish it before starting this instance.' }
    foreach ($name in @('server.lock','worker.lock')) {
        $file = Join-Path $work1Data $name
        if (-not (Test-Path -LiteralPath $file)) { continue }
        try { $lock = Get-Content -Raw -LiteralPath $file | ConvertFrom-Json }
        catch { throw "Cannot read Work1 $name. Inspect this lock before starting; it has not been removed." }
        $lockedPid = 0
        if (-not [int]::TryParse([string]$lock.pid, [ref]$lockedPid) -or $lockedPid -lt 1) { throw "Invalid Work1 $name. Inspect it before starting." }
        if (Get-Process -Id $lockedPid -ErrorAction SilentlyContinue) { throw "Work1 $name belongs to running process $lockedPid. Use the existing instance or stop it first." }
        # Server/worker startup already handles stale locks. Never kill a PID here.
    }
}

function Convert-Work1SecureText([Security.SecureString]$value) {
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($value)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
}

try {
    Set-Location -LiteralPath $projectRoot
    $env:DATA_DIR = $work1Data
    $env:HOST = '127.0.0.1'
    $env:PORT = '3000'
    $env:BASE_URL = 'http://localhost:3000'
    $env:NODE_ENV = 'development'
    $env:TT_OFFLINE_RENDERING = '1'
    Remove-Item Env:TT_WORK1_SETUP_PASSWORD -ErrorAction SilentlyContinue
    $nodeExe = Resolve-Work1Node
    $nodeVersionText = (& $nodeExe --version).Trim().TrimStart('v')
    if ($LASTEXITCODE -ne 0) { throw 'Node.js did not start.' }
    $nodeVersion = [Version]$nodeVersionText
    if ($nodeVersion.Major -ne 24 -or $nodeVersion -lt [Version]'24.22.3') { throw "Node.js 24.22.3 or later in the 24 LTS line is required; found $nodeVersionText." }
    & $nodeExe --input-type=module -e "await import('./src/deps.js'); console.log('Local application dependencies are available.');"
    if ($LASTEXITCODE -ne 0) { throw 'Local dependencies are missing. Follow README.md before starting Work1; this launcher does not download packages.' }
    Assert-Work1Stopped
    # A temporary exclusive bind detects an occupied port without sending requests
    # to another application or starting a second server. It is released immediately.
    $portProbe = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 3000)
    $portProbe.Server.ExclusiveAddressUse = $true
    try { $portProbe.Start() }
    catch { throw 'Port 3000 is occupied or local listening is blocked. Stop the existing application, or resolve the host restriction; no Work1 service was started.' }
    finally { $portProbe.Stop(); $portProbe = $null }
    Write-Host "Work1 data: $work1Data"
    Write-Host 'Staff page: http://localhost:3000/staff'
    Write-Host 'Only this computer can connect. The main application data and .env are not used.'
    if ($CheckOnly) { Write-Host 'Checks passed. No account, database, order, worker or web server was created.'; return }

    New-Item -ItemType Directory -Path $work1Data -Force | Out-Null
    & $nodeExe scripts/migrate.js
    if ($LASTEXITCODE -ne 0) { throw 'Work1 database initialization failed.' }
    $userCountText = & $nodeExe --input-type=module -e "import { DatabaseSync } from 'node:sqlite'; import path from 'node:path'; const db = new DatabaseSync(path.join(process.env.DATA_DIR,'app.sqlite'),{readOnly:true}); console.log(db.prepare('SELECT count(*) AS n FROM users').get().n); db.close();"
    if ($LASTEXITCODE -ne 0) { throw 'Could not inspect the Work1 staff accounts.' }
    $userCount = 0
    if (-not [int]::TryParse(([string]$userCountText).Trim(), [ref]$userCount)) { throw 'Unexpected Work1 account count; startup stopped.' }
    if ($userCount -eq 0) {
        Write-Host 'First Work1 startup: create your own staff account. No default password is supplied.'
        $username = (Read-Host 'Work1 staff username [owner]').Trim()
        if (-not $username) { $username = 'owner' }
        if ($username -notmatch '^[A-Za-z0-9._-]{3,40}$') { throw 'Use 3-40 letters, numbers, dots, underscores or hyphens for the username.' }
        $password = $null; $confirmation = $null
        try {
            $password = Convert-Work1SecureText (Read-Host 'Choose a password (at least 12 characters)' -AsSecureString)
            $confirmation = Convert-Work1SecureText (Read-Host 'Repeat the password' -AsSecureString)
            if ($password.Length -lt 12) { throw 'The password must contain at least 12 characters.' }
            if ($password -cne $confirmation) { throw 'The passwords did not match. No account was created.' }
            $env:TT_WORK1_SETUP_PASSWORD = $password
            & $nodeExe scripts/admin.js --username $username --password-env TT_WORK1_SETUP_PASSWORD
            if ($LASTEXITCODE -ne 0) { throw 'Work1 account creation failed.' }
        } finally {
            Remove-Item Env:TT_WORK1_SETUP_PASSWORD -ErrorAction SilentlyContinue
            $password = $null; $confirmation = $null
        }
    }

    $logDirectory = Join-Path $work1Data 'logs'
    New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
    $runStamp = '{0}-{1}' -f (Get-Date -Format 'yyyyMMdd-HHmmss'), $PID
    $workerLog = Join-Path $logDirectory "worker-$runStamp.log"
    $workerErrorLog = Join-Path $logDirectory "worker-$runStamp.error.log"
    $workerProcess = Start-Process -FilePath $nodeExe -ArgumentList 'src/worker.js' -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput $workerLog -RedirectStandardError $workerErrorLog -PassThru
    Start-Sleep -Milliseconds 300
    $workerProcess.Refresh()
    if ($workerProcess.HasExited) { throw "The Work1 worker stopped during startup. Inspect $workerErrorLog" }
    Write-Host 'Work1 is starting. Open http://localhost:3000/staff and keep this window open.'
    Write-Host "Worker log: $workerLog"
    Write-Host 'Press Ctrl+C here to stop the local test. Saved work stays in data\work1.'
    & $nodeExe src/server.js
    if ($LASTEXITCODE -ne 0) { throw "The Work1 web server exited with code $LASTEXITCODE." }
} finally {
    if ($portProbe) { $portProbe.Stop() }
    if ($workerProcess) {
        $workerProcess.Refresh()
        if (-not $workerProcess.HasExited) { Stop-Process -Id $workerProcess.Id -ErrorAction SilentlyContinue }
        $workerProcess.Dispose()
    }
    foreach ($name in $environmentNames) { [Environment]::SetEnvironmentVariable($name, $previousEnvironment[$name], 'Process') }
    Set-Location -LiteralPath $savedLocation
}
