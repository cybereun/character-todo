$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$builderRoot = "C:\tmp\character-todo-builder"
$stagingRoot = "C:\tmp\character-todo-package"
$builder = Join-Path $builderRoot "node_modules\.bin\electron-builder.cmd"

if (-not (Test-Path $builder)) {
  npm install --prefix $builderRoot electron-builder@24.13.3 electron@31.7.7 --no-audit --no-fund
}

if (Test-Path $stagingRoot) {
  Remove-Item -LiteralPath $stagingRoot -Recurse -Force
}

New-Item -ItemType Directory -Force -Path $stagingRoot | Out-Null
$items = @(
  "assets",
  "build",
  "src",
  "README.md",
  "package.json"
)

foreach ($item in $items) {
  Copy-Item -LiteralPath (Join-Path $root $item) -Destination $stagingRoot -Recurse -Force
}

& $builder --projectDir $stagingRoot --win nsis --x64

New-Item -ItemType Directory -Force -Path (Join-Path $root "dist") | Out-Null
Get-ChildItem -LiteralPath (Join-Path $stagingRoot "dist") | ForEach-Object {
  Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $root "dist") -Recurse -Force
}
exit $LASTEXITCODE
