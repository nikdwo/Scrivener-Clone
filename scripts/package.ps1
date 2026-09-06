param([Parameter(Mandatory)][string]$ApplicationDirectory,
      [string]$Compiler = (Join-Path $PSScriptRoot '../.tools/InnoSetup/ISCC.exe'))
$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$version = (Get-Content -LiteralPath (Join-Path $root 'package.json') -Raw | ConvertFrom-Json).version
$ApplicationDirectory = (Resolve-Path -LiteralPath $ApplicationDirectory).Path
$exe = Join-Path $ApplicationDirectory 'Schreibatelier.exe'
if (!(Test-Path -LiteralPath $Compiler)) { throw 'Inno Setup fehlt. Installiere den offiziellen Compiler und übergib seinen Pfad mit -Compiler.' }
if ((Get-Item -LiteralPath $exe).VersionInfo.ProductVersion -notlike "$version*") { throw 'Anwendung und Paket haben unterschiedliche Versionsnummern.' }
foreach ($unwanted in @('Data','portable.txt','.tools')) {
    if (Test-Path -LiteralPath (Join-Path $ApplicationDirectory $unwanted)) { throw "Der Veröffentlichungsordner enthält Benutzerdaten oder portable Dateien: $unwanted" }
}
$output = Join-Path $root "artifacts/releases/$version"
New-Item -ItemType Directory -Force -Path $output | Out-Null
& $Compiler /Qp "/DAppSource=$ApplicationDirectory" "/DReleaseVersion=$version" (Join-Path $root 'installer/Schreibatelier.iss')
if ($LASTEXITCODE) { throw 'Installer-Build fehlgeschlagen.' }
$zipPath = Join-Path $output "Schreibatelier-$version-Portable-win-x64.zip"
Add-Type -AssemblyName System.IO.Compression
$zip = [IO.Compression.ZipArchive]::new([IO.File]::Create($zipPath), [IO.Compression.ZipArchiveMode]::Create)
try {
    foreach ($file in Get-ChildItem -LiteralPath $ApplicationDirectory -File -Recurse) {
        if ($file.Extension -eq '.pdb') { continue }
        $relative = [IO.Path]::GetRelativePath($ApplicationDirectory, $file.FullName).Replace('\','/')
        [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $file.FullName, $relative, [IO.Compression.CompressionLevel]::Optimal) | Out-Null
    }
    $writer = [IO.StreamWriter]::new($zip.CreateEntry('portable.txt').Open())
    try { $writer.WriteLine('Schreibatelier Alpha 2: Einstellungen, Sicherungen und WebView-Daten liegen im Unterordner Data. Diese Datei aktiviert den portablen Modus.') }
    finally { $writer.Dispose() }
}
finally { $zip.Dispose() }
$assets = @((Join-Path $output "Schreibatelier-$version-Setup-win-x64.exe"), $zipPath)
$assets | ForEach-Object { $hash = Get-FileHash -LiteralPath $_ -Algorithm SHA256; $hash.Hash.ToLowerInvariant() + '  ' + [IO.Path]::GetFileName($_) } | Set-Content -LiteralPath (Join-Path $output 'SHA256SUMS.txt') -Encoding ascii
Get-Item -LiteralPath $assets | Select-Object Name,Length
