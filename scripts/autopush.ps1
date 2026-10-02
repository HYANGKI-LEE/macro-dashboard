# Commits and pushes data/Macro.xlsx when it has changed.
# Run every 10 minutes by Windows Task Scheduler (task: MacroDashboardAutoPush) via autopush.vbs.
$ErrorActionPreference = 'Stop'
$env:GIT_TERMINAL_PROMPT = '0'
$env:GCM_INTERACTIVE = 'Never'

$repo = Split-Path $PSScriptRoot -Parent
$xlsx = Join-Path $repo 'data\Macro.xlsx'
$log = Join-Path $PSScriptRoot 'autopush.log'
function Log($msg) { Add-Content -Path $log -Value ("{0:yyyy-MM-dd HH:mm:ss} {1}" -f (Get-Date), $msg) -Encoding UTF8 }

try {
  $changed = git -C $repo status --porcelain -- data/Macro.xlsx
  if ($changed) {
    # Wait until the last save is at least 2 minutes old, so a save in progress is never pushed.
    if (((Get-Date) - (Get-Item $xlsx).LastWriteTime).TotalMinutes -lt 2) { exit 0 }

    # Make sure the file is a complete xlsx (zip) before committing.
    Add-Type -AssemblyName System.IO.Compression
    $fs = New-Object IO.FileStream($xlsx, 'Open', 'Read', 'ReadWrite')
    try { $zip = New-Object IO.Compression.ZipArchive($fs); [void]$zip.GetEntry('xl/workbook.xml').Length; $zip.Dispose() }
    finally { $fs.Close() }

    git -C $repo add -- data/Macro.xlsx
    git -C $repo commit -q -m "Update data (auto)" -- data/Macro.xlsx
    if ($LASTEXITCODE -ne 0) { throw "git commit failed" }
    Log 'committed data/Macro.xlsx'
  }

  # Push any local commits not yet on GitHub (also retries a push that failed last time).
  git -C $repo fetch -q origin main
  $ahead = [int](git -C $repo rev-list --count origin/main..main)
  if ($ahead -gt 0) {
    git -C $repo push -q origin main
    if ($LASTEXITCODE -ne 0) { throw "git push failed" }
    Log "pushed $ahead commit(s)"
  }
} catch {
  Log "ERROR: $_"
  exit 1
}
