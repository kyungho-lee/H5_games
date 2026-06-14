<#
.SYNOPSIS
    Scaffold a new H5 puzzle game by seed-copying the template, then detach it
    into its own independent GitHub repo registered as a submodule of H5-games.

.DESCRIPTION
    Embodies the puzzle-group rule: the template is a REFERENCE SEED only.
    The game is copied ONCE from h5-puzzle-template, then fully detached —
    no shared modules, no dependency back to the template. Each game must run
    standalone.

    Steps:
      1. Copy h5-puzzle-template -> <Name>  (excluding .claude and any .git)
      2. Ensure a .gitignore exists in the new game
      3. git init + first commit
      4. Create private GitHub repo via gh and push
      5. Register <Name> as a submodule of the parent H5-games repo and commit

    NOTE: This script does NOT push the parent repo (pushing parent 'main' is
    left to you). It prints the exact command to run at the end.

.PARAMETER Name
    Game / repo folder name, e.g. H5-PUZZLE-Flood.

.PARAMETER Public
    Create the GitHub repo as public instead of private.

.PARAMETER Description
    GitHub repo description. Defaults to "H5 Puzzle - <Name>".

.EXAMPLE
    .\scripts\new-game.ps1 H5-PUZZLE-Flood
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$Name,

    [switch]$Public,

    [string]$Description
)

$ErrorActionPreference = 'Stop'

# --- Resolve paths ---------------------------------------------------------
$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot   = Split-Path -Parent $ScriptRoot          # parent H5-games root
$Template   = Join-Path $RepoRoot 'h5-puzzle-template'
$Dest       = Join-Path $RepoRoot $Name

# --- Locate gh -------------------------------------------------------------
$gh = Get-Command gh -ErrorAction SilentlyContinue
if (-not $gh) {
    $ghDefault = Join-Path $env:ProgramFiles 'GitHub CLI\gh.exe'
    if (Test-Path $ghDefault) { $gh = $ghDefault } else {
        throw "gh CLI not found. Install with: winget install GitHub.cli"
    }
} else { $gh = $gh.Source }

# --- Sanity checks ---------------------------------------------------------
if (-not (Test-Path $Template)) { throw "Template not found at $Template" }
if (Test-Path $Dest)            { throw "Destination already exists: $Dest" }

$ghUser = & $gh api user --jq .login
if (-not $ghUser) { throw "gh is not authenticated. Run: gh auth login" }

Write-Host "==> Scaffolding '$Name' as $ghUser/$Name" -ForegroundColor Cyan

# --- 1. Seed-copy template (exclude .claude and .git) ----------------------
Write-Host "==> Copying template (excluding .claude, .git)..." -ForegroundColor Cyan
Copy-Item -Path $Template -Destination $Dest -Recurse
foreach ($junk in @('.git', '.claude')) {
    $p = Join-Path $Dest $junk
    if (Test-Path $p) { Remove-Item -Recurse -Force $p }
}

# --- 2. Ensure .gitignore --------------------------------------------------
$gitignore = Join-Path $Dest '.gitignore'
if (-not (Test-Path $gitignore)) {
@'
# Dependencies
node_modules/

# Build output
dist/

# Local Claude Code config
.claude/

# OS / editor
.DS_Store
Thumbs.db
*.log
'@ | Out-File -FilePath $gitignore -Encoding utf8
}

# --- 3. git init + first commit -------------------------------------------
Push-Location $Dest
try {
    Write-Host "==> git init + first commit..." -ForegroundColor Cyan
    git init -b main | Out-Null
    git add -A | Out-Null
    git -c core.autocrlf=true commit -q -m "feat: initial commit from h5-puzzle-template"

    # --- 4. Create GitHub repo + push -------------------------------------
    if (-not $Description) { $Description = "H5 Puzzle - $Name" }
    $vis = if ($Public) { '--public' } else { '--private' }
    Write-Host "==> Creating GitHub repo ($vis) and pushing..." -ForegroundColor Cyan
    & $gh repo create $Name $vis --source . --remote origin --description $Description --push
}
finally {
    Pop-Location
}

# --- 5. Register as submodule of parent -----------------------------------
Push-Location $RepoRoot
try {
    Write-Host "==> Registering '$Name' as submodule of H5-games..." -ForegroundColor Cyan
    $url = "https://github.com/$ghUser/$Name.git"
    git submodule add $url $Name | Out-Null
    git -c core.autocrlf=true commit -q -m "feat: add $Name as submodule"
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "==> Done. '$Name' is an independent repo + submodule." -ForegroundColor Green
Write-Host "    Game repo : https://github.com/$ghUser/$Name" -ForegroundColor Green
Write-Host ""
Write-Host "    Parent commit is local only. To publish the submodule pointer, run:" -ForegroundColor Yellow
Write-Host "        cd `"$RepoRoot`"; git push origin main" -ForegroundColor Yellow
Write-Host ""
Write-Host "    Verify it is fully standalone:" -ForegroundColor Yellow
Write-Host "        .\scripts\verify-standalone.ps1 $Name" -ForegroundColor Yellow
