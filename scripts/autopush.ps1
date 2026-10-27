# Commits and pushes data/Macro.xlsx (and the infomax DBs built from it) when it has changed, after pulling any GitHub-side commits.
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

    # The dashboard reads the infomax_*.db files, not the xlsx, so rebuild them from the Info sheets.
    $dbs = @('data/infomax_daily.db', 'data/infomax_monthly.db', 'data/infomax_quarterly.db')
    python (Join-Path $repo 'scripts\excel\build_infomax_db.py') | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "build_infomax_db.py failed" }

    git -C $repo add -- data/Macro.xlsx @dbs
    git -C $repo commit -q -m "Update data (auto)" -- data/Macro.xlsx @dbs
    if ($LASTEXITCODE -ne 0) { throw "git commit failed" }
    Log 'committed data/Macro.xlsx + infomax DBs'
  }

  # Push any local commits not yet on GitHub (also retries a push that failed last time).
  git -C $repo fetch -q origin main
  # GitHub Actions commits data/fred.json daily, so bring those in first.
  $behind = [int](git -C $repo rev-list --count main..origin/main)
  if ($behind -gt 0) {
    git -C $repo pull -q --rebase --autostash origin main
    if ($LASTEXITCODE -ne 0) { throw "git pull --rebase failed" }
    Log "pulled $behind commit(s)"
  }
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
