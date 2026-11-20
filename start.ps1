param([int]$Port = 8000)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$localPython = Join-Path $env:LOCALAPPDATA 'Programs\Python\Python313\python.exe'
if (Test-Path -LiteralPath $localPython) {
    & $localPython server.py --port $Port
} elseif (Get-Command py -ErrorAction SilentlyContinue) {
    & py -3 server.py --port $Port
} else {
    & python server.py --port $Port
}
