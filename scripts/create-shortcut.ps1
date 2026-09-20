param([string]$ApplicationDirectory)
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$version = (Get-Content -LiteralPath (Join-Path $projectRoot 'package.json') -Raw | ConvertFrom-Json).version
$application = if ($ApplicationDirectory) { [IO.Path]::GetFullPath((Join-Path $ApplicationDirectory 'Schreibatelier.exe')) } else { Join-Path $projectRoot "artifacts/Schreibatelier-$version/app/Schreibatelier.exe" }
if (!(Test-Path -LiteralPath $application -PathType Leaf)) { throw 'Bitte zuerst den Release-Build erstellen: scripts/build.ps1 -Release' }
$shortcutPath = Join-Path $projectRoot 'Schreibatelier starten.lnk'
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $application
$shortcut.WorkingDirectory = Split-Path -Parent $application
$shortcut.IconLocation = "$application,0"
$shortcut.Description = if ($application.Contains('Schreibatelier-testing-usability')) { 'Schreibatelier – Testversion Schreibansicht & Zeitstrahl' } else { 'Schreibatelier öffnen' }
$shortcut.Save()
if ($application.Contains('Schreibatelier-testing-usability')) {
    Copy-Item -LiteralPath $shortcutPath -Destination (Join-Path $projectRoot 'Testversion Schreibansicht & Zeitstrahl.lnk') -Force
}
$saved = $shell.CreateShortcut($shortcutPath)
if ($saved.TargetPath -ne $application -or !(Test-Path -LiteralPath $saved.TargetPath -PathType Leaf)) { throw 'Die Startverknüpfung konnte nicht geprüft werden.' }
Write-Output 'Schreibatelier starten: Verknüpfung im Projektordner erstellt und geprüft.'
