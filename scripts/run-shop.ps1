param(
    [switch]$Work1,
    [string]$DataDirectory,
    [string]$Address,
    [ValidateRange(1024,65535)][int]$Port = 3000,
    [switch]$CheckOnly
)

# Explicit process settings; never load .env or silently expose every adapter.
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Split-Path $PSScriptRoot))
$savedLocation = Get-Location
$environmentNames = @('DATA_DIR','HOST','PORT','BASE_URL','NODE_ENV','TT_SHOP_SETUP_PASSWORD','TT_OFFLINE_RENDERING')
$previousEnvironment = @{}
foreach ($name in $environmentNames) { $previousEnvironment[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }
$workerProcess = $null
$portProbe = $null

function Resolve-ShopNode {
    $command = Get-Command node -ErrorAction SilentlyContinue
    if ($command -and $command.Source) { return $command.Source }
    foreach ($candidate in @($env:CODEX_PRIMARY_RUNTIME_NODE, 'C:\Program Files\nodejs\node.exe')) {
        if ($candidate -and (Test-Path -LiteralPath $candidate -PathType Leaf)) { return $candidate }
    }
    if (Get-Command Get-AppxPackage -ErrorAction SilentlyContinue) {
        foreach ($runtime in (Get-AppxPackage -Name 'OpenAI.CodexPrimaryRuntime*' -ErrorAction SilentlyContinue | Sort-Object Version -Descending)) {
            $candidate = Join-Path $runtime.InstallLocation 'dependencies\node\bin\node.exe'
            if (Test-Path -LiteralPath $candidate -PathType Leaf) { return $candidate }
        }
    }
    throw 'Node.js was not found. Install Node.js 24 LTS and application dependencies using README.md, or open this script from the existing Codex terminal.'
}

function Test-PrivateIPv4([Net.IPAddress]$ip) {
    if ($ip.AddressFamily -ne [Net.Sockets.AddressFamily]::InterNetwork) { return $false }
    $bytes = $ip.GetAddressBytes()
    return ($bytes[0] -eq 10 -or ($bytes[0] -eq 172 -and $bytes[1] -ge 16 -and $bytes[1] -le 31) -or ($bytes[0] -eq 192 -and $bytes[1] -eq 168))
}

function Get-ShopAddresses {
    foreach ($adapter in [Net.NetworkInformation.NetworkInterface]::GetAllNetworkInterfaces()) {
        if ($adapter.OperationalStatus -ne [Net.NetworkInformation.OperationalStatus]::Up) { continue }
        foreach ($unicast in $adapter.GetIPProperties().UnicastAddresses) {
            if (Test-PrivateIPv4 $unicast.Address) {
                [pscustomobject]@{ Address = $unicast.Address.ToString(); Adapter = $adapter.Name; Type = [string]$adapter.NetworkInterfaceType }
            }
        }
    }
}

function Assert-ShopStopped([string]$directory) {
    if (Test-Path -LiteralPath (Join-Path $directory 'maintenance.lock')) { throw 'Backup/retention maintenance is active for this data directory. Finish it before starting.' }
    foreach ($name in @('server.lock','worker.lock')) {
        $file = Join-Path $directory $name
        if (-not (Test-Path -LiteralPath $file)) { continue }
        try { $lock = Get-Content -Raw -LiteralPath $file | ConvertFrom-Json }
        catch { throw "Cannot read $name in $directory. Inspect it before starting; no lock was removed." }
        $lockedPid = 0
        if (-not [int]::TryParse([string]$lock.pid, [ref]$lockedPid) -or $lockedPid -lt 1) { throw "Invalid $name in $directory. Inspect it before starting." }
        if (Get-Process -Id $lockedPid -ErrorAction SilentlyContinue) { throw "$name belongs to running process $lockedPid. Use the existing instance or stop it first." }
    }
}

function Convert-ShopSecureText([Security.SecureString]$value) {
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($value)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
}

try {
    Set-Location -LiteralPath $projectRoot
    if ($Work1 -and $DataDirectory) { throw 'Choose -Work1 or -DataDirectory, not both.' }
    $storeLabel = 'Shop'
    if ($Work1) { $shopData = Join-Path $projectRoot 'data\work1'; $storeLabel = 'Work1 sample' }
    elseif ($DataDirectory) { $shopData = [IO.Path]::GetFullPath($DataDirectory); $storeLabel = 'Explicit data directory' }
    else { $shopData = Join-Path $projectRoot 'data\shop' }

    $availableAddresses = @(Get-ShopAddresses | Sort-Object Address -Unique)
    if ($Address) {
        if (-not ($availableAddresses | Where-Object Address -eq $Address)) { throw 'The selected address is not an active private IPv4 address on this computer. Use ipconfig to inspect the shop Wi-Fi address.' }
    } elseif ($availableAddresses.Count -eq 1) { $Address = $availableAddresses[0].Address }
    elseif ($availableAddresses.Count -eq 0) { throw 'No active private IPv4 address was found. Connect this computer to the shop Wi-Fi or wired LAN first.' }
    else {
        $availableAddresses | Format-Table Address,Adapter,Type | Out-Host
        if ($CheckOnly) { throw 'Multiple private addresses were found. Repeat with -Address and the shop Wi-Fi IPv4 address.' }
        $Address = (Read-Host 'Enter the shop LAN IPv4 address from this list').Trim()
        if (-not ($availableAddresses | Where-Object Address -eq $Address)) { throw 'Choose an address from the displayed list.' }
    }
    $env:DATA_DIR = $shopData
    $env:HOST = $Address
    $env:PORT = [string]$Port
    $env:BASE_URL = 'http://{0}:{1}' -f $Address,$Port
    $env:NODE_ENV = 'development'
    $env:TT_OFFLINE_RENDERING = '1'
    Remove-Item Env:TT_SHOP_SETUP_PASSWORD -ErrorAction SilentlyContinue
    $nodeExe = Resolve-ShopNode
    $nodeVersionText = (& $nodeExe --version).Trim().TrimStart('v')
    if ($LASTEXITCODE -ne 0) { throw 'Node.js did not start.' }
    $nodeVersion = [Version]$nodeVersionText
    if ($nodeVersion.Major -ne 24 -or $nodeVersion -lt [Version]'24.22.3') { throw "Node.js 24.22.3 or later in the 24 LTS line is required; found $nodeVersionText." }
    & $nodeExe --input-type=module -e "await import('./src/deps.js'); console.log('Local application dependencies are available.');"
    if ($LASTEXITCODE -ne 0) { throw 'Local dependencies are missing. Complete README.md setup; this launcher never downloads packages.' }
    Assert-ShopStopped $shopData
    $portProbe = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Parse($Address), $Port)
    $portProbe.Server.ExclusiveAddressUse = $true
    try { $portProbe.Start() }
    catch { throw "Cannot listen on ${Address}:$Port. A service already uses it, or this host blocks listening. No Shop service was started." }
    finally { $portProbe.Stop(); $portProbe = $null }

    Write-Host "Data set: $storeLabel"
    Write-Host "Private data: $shopData"
    Write-Host "Staff page: $($env:BASE_URL)/staff"
    Write-Host 'Use this exact address on the PC and phones. Customer links come from the staff order screen.'
    Write-Host 'LAN HTTP is a local test mode. HTTPS is required for secure customer deployment and PWA offline navigation; see docs/SHOP_HOSTING.md.'
    if ($CheckOnly) { Write-Host 'Checks passed. No account, database, order, worker or web server was created.'; return }

    New-Item -ItemType Directory -Path $shopData -Force | Out-Null
    & $nodeExe scripts/migrate.js
    if ($LASTEXITCODE -ne 0) { throw 'Shop database initialization failed.' }
    $userCountText = & $nodeExe --input-type=module -e "import { DatabaseSync } from 'node:sqlite'; import path from 'node:path'; const db = new DatabaseSync(path.join(process.env.DATA_DIR,'app.sqlite'),{readOnly:true}); console.log(db.prepare('SELECT count(*) AS n FROM users').get().n); db.close();"
    if ($LASTEXITCODE -ne 0) { throw 'Could not inspect the staff accounts.' }
    $userCount = 0
    if (-not [int]::TryParse(([string]$userCountText).Trim(), [ref]$userCount)) { throw 'Unexpected account count; startup stopped.' }
    if ($userCount -eq 0) {
        Write-Host 'First startup: create your own staff account. No default password is supplied.'
        $username = (Read-Host 'Staff username [owner]').Trim()
        if (-not $username) { $username = 'owner' }
        if ($username -notmatch '^[A-Za-z0-9._-]{3,40}$') { throw 'Use 3-40 letters, numbers, dots, underscores or hyphens for the username.' }
        $password = $null; $confirmation = $null
        try {
            $password = Convert-ShopSecureText (Read-Host 'Choose a password (at least 12 characters)' -AsSecureString)
            $confirmation = Convert-ShopSecureText (Read-Host 'Repeat the password' -AsSecureString)
            if ($password.Length -lt 12) { throw 'The password must contain at least 12 characters.' }
            if ($password -cne $confirmation) { throw 'The passwords did not match. No account was created.' }
            $env:TT_SHOP_SETUP_PASSWORD = $password
            & $nodeExe scripts/admin.js --username $username --password-env TT_SHOP_SETUP_PASSWORD
            if ($LASTEXITCODE -ne 0) { throw 'Staff account creation failed.' }
        } finally {
            Remove-Item Env:TT_SHOP_SETUP_PASSWORD -ErrorAction SilentlyContinue
            $password = $null; $confirmation = $null
        }
    }
    $logDirectory = Join-Path $shopData 'logs'
    New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
    $runStamp = '{0}-{1}' -f (Get-Date -Format 'yyyyMMdd-HHmmss'),$PID
    $workerLog = Join-Path $logDirectory "worker-$runStamp.log"
    $workerErrorLog = Join-Path $logDirectory "worker-$runStamp.error.log"
    $workerProcess = Start-Process -FilePath $nodeExe -ArgumentList 'src/worker.js' -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput $workerLog -RedirectStandardError $workerErrorLog -PassThru
    Start-Sleep -Milliseconds 300
    $workerProcess.Refresh()
    if ($workerProcess.HasExited) { throw "The rendering worker stopped during startup. Inspect $workerErrorLog" }
    Write-Host "Shop is starting. Open $($env:BASE_URL)/staff and keep this window open."
    Write-Host "Worker log: $workerLog"
    Write-Host 'Press Ctrl+C here to stop. Saved work remains in the displayed private data directory.'
    & $nodeExe src/server.js
    if ($LASTEXITCODE -ne 0) { throw "The web server exited with code $LASTEXITCODE." }
} finally {
    if ($portProbe) { $portProbe.Stop() }
    if ($workerProcess) {
        $workerProcess.Refresh()
        if (-not $workerProcess.HasExited) { Stop-Process -Id $workerProcess.Id -ErrorAction SilentlyContinue }
        $workerProcess.Dispose()
    }
    foreach ($name in $environmentNames) {
        if ($null -eq $previousEnvironment[$name]) { Remove-Item -LiteralPath "Env:$name" -ErrorAction SilentlyContinue }
        else { [Environment]::SetEnvironmentVariable($name, $previousEnvironment[$name], 'Process') }
    }
    Set-Location -LiteralPath $savedLocation
}
