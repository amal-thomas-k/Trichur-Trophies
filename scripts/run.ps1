param([switch]$WorkerOnly, [switch]$WebOnly)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Split-Path $PSScriptRoot)
if ($WorkerOnly -and $WebOnly) { throw 'Choose at most one of WorkerOnly or WebOnly.' }
if ($WorkerOnly) { node --env-file-if-exists=.env src/worker.js; exit $LASTEXITCODE }
if ($WebOnly) { node --env-file-if-exists=.env src/server.js; exit $LASTEXITCODE }
$nodeExe = (Get-Command node).Source
$workerLog = Join-Path (Get-Location) 'worker.log'
$workerErrorLog = Join-Path (Get-Location) 'worker-error.log'
$worker = Start-Process -FilePath $nodeExe -ArgumentList '--env-file-if-exists=.env','src/worker.js' -WorkingDirectory (Get-Location) -WindowStyle Hidden -RedirectStandardOutput $workerLog -RedirectStandardError $workerErrorLog -PassThru
try { & $nodeExe --env-file-if-exists=.env src/server.js }
finally { if (-not $worker.HasExited) { Stop-Process -Id $worker.Id } }
