# Uploads the current app code to the VPS and rebuilds it. Your data (Docker volume) is not touched.
# Run from PowerShell in this folder:   .\deploy.ps1
param(
    [string]$Server = 'opsmind@72.167.149.101',
    [string]$Folder = '~/trikosh'
)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

$files = 'Dockerfile', '.dockerignore', 'compose.yaml', 'Caddyfile', '.env.example',
         'server.py', 'accounts.py', 'workspace_features.py', 'business_expenses.py', 'backup_db.py'

Write-Host "1/3  Uploading code to ${Server}:$Folder ..." -ForegroundColor Cyan
scp @files "${Server}:$Folder/"
if ($LASTEXITCODE -ne 0) { throw 'Upload failed (code files). Check the server address and your SSH key.' }
# The static folder goes up as one archive (folder copies with Windows scp can fail, e.g. on ownership).
$archive = Join-Path $env:TEMP 'trikosh-static.tgz'
tar -czf $archive -C static .
if ($LASTEXITCODE -ne 0) { throw 'Could not pack the static folder.' }
scp $archive "${Server}:$Folder/static.tgz"
if ($LASTEXITCODE -ne 0) { throw 'Upload failed (static folder archive).' }
Remove-Item $archive

Write-Host '2/3  Unpacking, backing up the database, then rebuilding (about a minute) ...' -ForegroundColor Cyan
ssh -t $Server "cd $Folder && sudo rm -rf static && mkdir static && tar -xzf static.tgz -C static && rm static.tgz && ls static && (sudo docker compose exec -T app python backup_db.py --keep 14 || true) && sudo docker compose up -d --build && sudo docker compose ps"
if ($LASTEXITCODE -ne 0) { throw 'Rebuild failed. Run: ssh $Server  then  cd ' + $Folder + ' && sudo docker compose logs app --tail 50' }

Write-Host '3/3  Checking the live site ...' -ForegroundColor Cyan
$page = (Invoke-WebRequest -UseBasicParsing 'https://trikosh.com/app.js' -Headers @{ 'Cache-Control' = 'no-cache' }).Content
if ($page -match 'acceptPendingInvite') { Write-Host 'Live site is running the new code. Press Ctrl+F5 in your browser.' -ForegroundColor Green }
else { Write-Host 'Live site still serves old code. Send the output above to Claude.' -ForegroundColor Yellow }
