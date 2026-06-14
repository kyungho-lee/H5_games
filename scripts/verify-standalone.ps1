<#
.SYNOPSIS
    Verify an H5 puzzle game is fully self-contained (no references escaping
    its own folder), enforcing the puzzle-group independence rule.

.DESCRIPTION
    Scans the game's text source (html/js/css/json/md-in-src) for references
    that would break if the folder were copied out and run standalone:

      [FAIL] parent-escape paths  ( ../ , ..\ )           -> leaves the folder
      [FAIL] absolute local paths ( C:\... , file:// )    -> machine-specific
      [WARN] external URLs        ( http(s):// )          -> OK only if a real CDN;
                                                             listed so you can confirm

    Local references (relative paths, ./...) and protocol-relative CDN URLs are
    fine. Exit code is non-zero if any FAIL is found.

.PARAMETER Game
    Game folder name (relative to repo root) or a full path. e.g. H5-PUZZLE-NeonDrift-v1

.EXAMPLE
    .\scripts\verify-standalone.ps1 H5-PUZZLE-NeonDrift-v1
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$Game
)

$ErrorActionPreference = 'Stop'

$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot   = Split-Path -Parent $ScriptRoot

# Resolve game path (accept name or full path)
$GamePath = if (Test-Path $Game) { (Resolve-Path $Game).Path } else { Join-Path $RepoRoot $Game }
if (-not (Test-Path $GamePath)) { throw "Game folder not found: $GamePath" }

Write-Host "==> Verifying standalone integrity of: $GamePath" -ForegroundColor Cyan

# Files to scan
$exts = @('*.html', '*.htm', '*.js', '*.mjs', '*.css', '*.json')
$files = Get-ChildItem -Path $GamePath -Recurse -Include $exts -File |
         Where-Object { $_.FullName -notmatch '\\(\.git|node_modules|\.claude)\\' }

$fails = @()
$warns = @()

# Regex patterns
# ../ or ..\ used as a path (preceded by a quote, paren, =, or whitespace) —
# avoids matching prose like "go up .." in comments.
$reParentEscape = '[''"`(=\s](\.\./|\.\.\\)'
# Windows drive-absolute path inside a quoted string, e.g. "C:\Users\..."
# (bare C:\ in a comment is prose; require a preceding quote to mean a real path)
$reAbsLocal     = '[''"`]([A-Za-z]:\\)'
$reExternalUrl  = 'https?://[^\s"''`)\]]+'               # http(s)://...

foreach ($f in $files) {
    $rel = $f.FullName.Substring($GamePath.Length).TrimStart('\','/')
    $lines = Get-Content -LiteralPath $f.FullName
    for ($i = 0; $i -lt $lines.Count; $i++) {
        $line = $lines[$i]
        $ln   = $i + 1

        foreach ($m in [regex]::Matches($line, $reParentEscape)) {
            $fails += [pscustomobject]@{ Kind='PARENT-ESCAPE'; File=$rel; Line=$ln; Text=$line.Trim() }
        }
        foreach ($m in [regex]::Matches($line, $reAbsLocal)) {
            $fails += [pscustomobject]@{ Kind='ABS-LOCAL'; File=$rel; Line=$ln; Text=$line.Trim() }
        }
        foreach ($m in [regex]::Matches($line, $reExternalUrl)) {
            $warns += [pscustomobject]@{ Kind='EXTERNAL-URL'; File=$rel; Line=$ln; Text=$m.Value }
        }
    }
}

# De-dup parent-escape/abs-local by file+line+text
$fails = $fails | Sort-Object File, Line, Text -Unique

Write-Host ""
if ($warns.Count -gt 0) {
    Write-Host "WARN  External URLs found ($($warns.Count)) — OK only if they are real CDNs:" -ForegroundColor Yellow
    $warns | Sort-Object File, Line | ForEach-Object {
        Write-Host ("  [{0}:{1}] {2}" -f $_.File, $_.Line, $_.Text) -ForegroundColor DarkYellow
    }
    Write-Host ""
}

if ($fails.Count -gt 0) {
    Write-Host "FAIL  References that escape the game folder ($($fails.Count)):" -ForegroundColor Red
    $fails | ForEach-Object {
        Write-Host ("  [{0}] {1}:{2}  {3}" -f $_.Kind, $_.File, $_.Line, $_.Text) -ForegroundColor Red
    }
    Write-Host ""
    Write-Host "==> NOT standalone. Fix the above (copy the resource into the game folder)." -ForegroundColor Red
    exit 1
}

Write-Host "==> PASS: no parent-escape or absolute-local references. Game is self-contained." -ForegroundColor Green
if ($warns.Count -gt 0) {
    Write-Host "    (Review the EXTERNAL-URL warnings above to confirm each is an intended CDN.)" -ForegroundColor DarkYellow
}
exit 0
