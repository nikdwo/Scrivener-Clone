param([string]$Destination = (Join-Path $PSScriptRoot '../.tools'))
$ErrorActionPreference = 'Stop'
$Destination = [IO.Path]::GetFullPath($Destination)
$packages = @(
    @{Name='pandoc'; Url='https://github.com/jgm/pandoc/releases/download/3.11/pandoc-3.11-windows-x86_64.zip'; Hash='2ab72baf2399450e148ddf7a2a8689806c42e1bba71862b57e220fd9b8456d3d'},
    @{Name='typst'; Url='https://github.com/typst/typst/releases/download/v0.15.1/typst-x86_64-pc-windows-msvc.zip'; Hash='19ce3551153c2fe7ee9fa2f95208310c8f4d3209fedb699e0333faf8913f6736'}
)
New-Item -ItemType Directory -Force -Path $Destination | Out-Null
foreach ($package in $packages) {
    $archive = Join-Path $Destination ($package.Name + '.zip')
    if (!(Test-Path -LiteralPath $archive)) { Invoke-WebRequest -Uri $package.Url -OutFile $archive }
    if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant() -ne $package.Hash) { throw "Prüfsumme stimmt nicht: $archive" }
    $folder = Join-Path $Destination $package.Name
    if (!(Test-Path -LiteralPath $folder)) { Expand-Archive -LiteralPath $archive -DestinationPath $folder }
    $exe = Get-ChildItem -LiteralPath $folder -Filter ($package.Name + '.exe') -Recurse | Select-Object -First 1
    if (!$exe) { throw "Programm fehlt: $folder" }
    & $exe.FullName --version | Select-Object -First 1
}
$packages | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $Destination 'sources.json') -Encoding utf8
