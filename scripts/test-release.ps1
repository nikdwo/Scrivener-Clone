$ErrorActionPreference = 'Stop'
$workspace = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$version = (Get-Content -LiteralPath (Join-Path $workspace 'package.json') -Raw | ConvertFrom-Json).version
$packages = Join-Path $workspace "artifacts/releases/$version"
$testRoot = Join-Path $workspace ('.work/release-check/' + [guid]::NewGuid().ToString('N'))
$registration = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\{9E0349A6-29C2-4594-937C-131560CBF1AB}_is1'
if (Test-Path -LiteralPath $registration) { throw 'Schreibatelier ist bereits installiert. Die Paketprüfung benötigt ein Benutzerkonto ohne vorhandene Schreibatelier-Installation.' }
New-Item -ItemType Directory -Path $testRoot -Force | Out-Null
function Check([bool]$Condition, [string]$Label) {
    if (!$Condition) { throw "FAILED: $Label" }
    Write-Output "PASS $Label"
}
function Run([string]$Executable, [string[]]$Arguments, [string]$WorkingDirectory) {
    $process = Start-Process -FilePath $Executable -ArgumentList $Arguments -WorkingDirectory $WorkingDirectory -WindowStyle Hidden -PassThru
    if (!$process.WaitForExit(60000)) { Stop-Process -Id $process.Id; throw "Zeitüberschreitung: $Executable" }
    Check ($process.ExitCode -eq 0) ([IO.Path]::GetFileName($Executable) + ' Exit 0')
}
function NativeCheck([string]$AppDirectory, [string]$WorkingDirectory, [string]$DataDirectory) {
    New-Item -ItemType Directory -Force -Path $WorkingDirectory | Out-Null
    $project = Join-Path $AppDirectory 'pakettest.schreibprojekt'
    $resultFile = Join-Path $DataDirectory 'result.json'
    if (Test-Path -LiteralPath $resultFile) { throw 'Ergebnisdatei muss vor diesem Testlauf fehlen.' }
    Run (Join-Path $AppDirectory 'Schreibatelier.exe') @('--integration-test', ('"' + $project + '"')) $WorkingDirectory
    $result = Get-Content -LiteralPath $resultFile -Raw | ConvertFrom-Json
    Check ($result.ok -eq $true) 'Native Editor-Bridge speichert Text und Fußnote in SQLite'
    Check ($result.checks -contains 'Lokale Sprachprüfung → Markierung → Korrektur → SQLite → Undo') 'Paket prüft und korrigiert mit der echten lokalen Sprachprüfung'
    Check ($result.checks -contains 'Orts- und Gegenstandskarten → Namenserkennung → SQLite → Wiederöffnen') 'Paket speichert und erkennt Orts- und Gegenstandskarten mit Szenenzuordnungen'
    Check ($result.checks -contains 'Lokale Stilanalyse → drei Kategorien → Navigation → unveränderter Text → SQLite-Einstellungen → Wiederöffnen') 'Paket analysiert lokal und speichert Stileinstellungen'
    Check ($result.checks -contains 'Zeitstrahl → drei Szenen → zwei Handlungen → Figurenfilter → Zeitbearbeitung → SQLite → Wiederöffnen ohne Text- oder Strukturänderung') 'Paket speichert Szenenzeiten und Handlungen bei unverändertem Manuskript'
    Check (Test-Path -LiteralPath (Join-Path $AppDirectory 'Proofreading/sources.json')) 'Paket enthält die Herkunftsnachweise der lokalen Sprachprüfung'
    Check ([IO.Path]::GetFullPath($result.storageDirectory) -eq [IO.Path]::GetFullPath($DataDirectory)) 'Benutzerdaten liegen im erwarteten Ordner'
    Check ($result.backupDirectory.StartsWith((Join-Path $DataDirectory 'Backups') + '\', [StringComparison]::OrdinalIgnoreCase)) 'Sicherungen verwenden den ausgewählten Datenordner'
    Check (@(Get-ChildItem -LiteralPath $result.backupDirectory -Filter '*.schreibprojekt').Count -gt 0) 'Sicherung wurde geschrieben'
    Check (Test-Path -LiteralPath (Join-Path $DataDirectory 'preferences.json')) 'Einstellungen wurden gespeichert'
    Check (Test-Path -LiteralPath (Join-Path $DataDirectory 'WebView')) 'WebView verwendet den ausgewählten Datenordner'
}
foreach ($line in Get-Content -LiteralPath (Join-Path $packages 'SHA256SUMS.txt')) {
    $expected, $name = $line -split '  ', 2
    Check ((Get-FileHash -LiteralPath (Join-Path $packages $name) -Algorithm SHA256).Hash -eq $expected) "SHA-256 $name"
}
$portable = Join-Path $testRoot 'portable'
Expand-Archive -LiteralPath (Join-Path $packages "Schreibatelier-$version-Portable-win-x64.zip") -DestinationPath $portable
Check (Test-Path -LiteralPath (Join-Path $portable 'portable.txt')) 'ZIP enthält den portablen Modus'
Check (!(Test-Path -LiteralPath (Join-Path $portable 'Data'))) 'ZIP enthält keine Benutzerdaten'
Check ((Get-Item -LiteralPath (Join-Path $portable 'Schreibatelier.exe')).VersionInfo.ProductVersion -like "$version*") 'EXE trägt die Alpha-Version'
NativeCheck $portable (Join-Path $testRoot 'portable-working') (Join-Path $portable 'Data')
'{"theme":"dark","inspectorWidth":360}' | Set-Content -LiteralPath (Join-Path $portable 'Data/preferences.json') -Encoding utf8
$resultBeforeMove = Join-Path $portable 'Data/result.json'
Move-Item -LiteralPath $resultBeforeMove -Destination (Join-Path $portable 'Data/first-result.json')
$moved = Join-Path $testRoot 'portable-moved'
foreach ($path in @($portable, $moved)) {
    if (![IO.Path]::GetFullPath($path).StartsWith($testRoot + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Umzug außerhalb des Testordners abgelehnt.' }
}
Move-Item -LiteralPath $portable -Destination $moved -Force
NativeCheck $moved (Join-Path $testRoot 'moved-working') (Join-Path $moved 'Data')
$restarted = Get-Content -LiteralPath (Join-Path $moved 'Data/result.json') -Raw | ConvertFrom-Json
Check ($restarted.checks -contains 'Stileinstellungen aus vorherigem Programmstart geladen') 'Programmneustart erhält Stileinstellungen'
Check ($restarted.checks -contains 'Zeitstrahl aus vorherigem Programmstart geladen') 'Programmneustart erhält Zeitstrahl und Handlungsstränge'
$preferences = Get-Content -LiteralPath (Join-Path $moved 'Data/preferences.json') -Raw | ConvertFrom-Json
Check ($preferences.theme -eq 'dark' -and $preferences.inspectorWidth -eq 360) 'Portabler Umzug erhält die Einstellungen'
$installed = Join-Path $testRoot 'installed'
try {
    Run (Join-Path $packages "Schreibatelier-$version-Setup-win-x64.exe") @('/VERYSILENT','/SUPPRESSMSGBOXES','/NORESTART','/SP-','/NOICONS',('/DIR="' + $installed + '"'),('/LOG="' + (Join-Path $testRoot 'install.log') + '"')) $testRoot
    Check (Test-Path -LiteralPath $registration) 'Installer registriert einen Deinstaller'
    Check (!(Test-Path -LiteralPath (Join-Path $installed 'portable.txt'))) 'Installation aktiviert keinen portablen Modus'
    $working = Join-Path $testRoot 'installed-working'
    NativeCheck $installed $working (Join-Path $working '.work/app-test')
}
finally {
    $uninstaller = Join-Path $installed 'unins000.exe'
    if (Test-Path -LiteralPath $uninstaller) {
        Run $uninstaller @('/VERYSILENT','/SUPPRESSMSGBOXES','/NORESTART',('/LOG="' + (Join-Path $testRoot 'uninstall.log') + '"')) $testRoot
    }
}
Check (!(Test-Path -LiteralPath (Join-Path $installed 'Schreibatelier.exe'))) 'Deinstallation entfernt die Anwendung'
Check (Test-Path -LiteralPath (Join-Path $installed 'pakettest.schreibprojekt')) 'Deinstallation erhält selbst angelegte Projektdateien'
Check (Test-Path -LiteralPath (Join-Path $testRoot 'installed-working/.work/app-test/preferences.json')) 'Deinstallation erhält Benutzerdaten'
Check (!(Test-Path -LiteralPath $registration)) 'Deinstallation entfernt den Registrierungseintrag'
Write-Output "Paketprüfung bestanden. Nachweise: $testRoot"
