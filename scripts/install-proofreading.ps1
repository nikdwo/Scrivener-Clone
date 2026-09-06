param([string]$Destination = (Join-Path $PSScriptRoot '../.tools'))
$ErrorActionPreference = 'Stop'
$Destination = [IO.Path]::GetFullPath($Destination)
$packages = @(
    @{Name='java'; Url='https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.12.1%2B1/OpenJDK21U-jre_x64_windows_hotspot_21.0.12.1_1.zip'; Hash='d35f31e712f0fcf6ac5a093edc90204fbff22f720ba3950bd09d331d5e621636'},
    @{Name='languagetool'; Url='https://languagetool.org/download/snapshots/LanguageTool-20260905-snapshot.zip'; Hash='e3c8519c66349135f1f6658c700b71ab1c00b39383585a5cdbccdb38b5b4921a'}
)
New-Item -ItemType Directory -Force -Path $Destination | Out-Null
foreach ($package in $packages) {
    $archive = Join-Path $Destination ($package.Name + '.zip')
    if (!(Test-Path -LiteralPath $archive)) { Invoke-WebRequest -Uri $package.Url -OutFile $archive }
    if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant() -ne $package.Hash) { throw "Prüfsumme stimmt nicht: $archive" }
    $folder = Join-Path $Destination $package.Name
    if (!(Test-Path -LiteralPath $folder)) { Expand-Archive -LiteralPath $archive -DestinationPath $folder }
}
$packages | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $Destination 'proofreading-sources.json') -Encoding utf8
Write-Output 'Lokale Sprachprüfung installiert. Keine systemweiten Einstellungen geändert.'
