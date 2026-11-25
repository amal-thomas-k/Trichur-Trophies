param([switch]$UseBundledRuntime)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Split-Path $PSScriptRoot)
$nodeExe = (Get-Command node -ErrorAction Stop).Source
& $nodeExe -e "if(Number(process.versions.node.split('.')[0])!==24)throw new Error('Install Node.js 24 LTS first')"
if ($LASTEXITCODE -ne 0) { throw 'Node.js 24 is required.' }
if ($UseBundledRuntime) {
    $candidate = Join-Path (Split-Path (Split-Path $nodeExe)) 'node_modules'
    if (-not (Test-Path -LiteralPath (Join-Path $candidate 'sharp\package.json'))) { throw 'No compatible bundled runtime was found. Install pnpm dependencies normally.' }
    Write-Host 'The application dependency loader will use the existing runtime packages on this computer. The source lockfile is used for regular installations.'
} else {
    if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) { throw 'Install pnpm: npm install --global pnpm@11.25.0' }
    pnpm install --frozen-lockfile
    if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' }
    pnpm exec playwright install chromium
    if ($LASTEXITCODE -ne 0) { throw 'Chromium installation failed.' }
}
if (-not (Test-Path -LiteralPath '.env')) { Copy-Item -LiteralPath '.env.example' -Destination '.env' }
& $nodeExe --env-file-if-exists=.env scripts/migrate.js
if ($LASTEXITCODE -ne 0) { throw 'Database migration failed.' }
Write-Host 'Next: create an administrator, seed a demo order if desired, then run scripts/run.ps1.'
