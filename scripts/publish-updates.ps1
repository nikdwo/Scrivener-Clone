param([Parameter(Mandatory)][ValidatePattern('^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?$')][string]$Version)
$ErrorActionPreference = 'Stop'
$source = 'https://api.github.com/repos/nikdwo/Scrivener-Clone'
$target = 'https://api.github.com/repos/nikdwo/Schreibatelier-Releases'
$tag = 'v' + $Version
$staging = Join-Path $PSScriptRoot "../.work/public-updates/$Version"
New-Item -ItemType Directory -Force -Path $staging | Out-Null
$credentialResponse = "protocol=https`nhost=github.com`n`n" | git credential fill
if ($LASTEXITCODE) { throw 'Vorhandene GitHub-Anmeldung nicht verfügbar.' }
$secretLine = $credentialResponse | Where-Object { $_.StartsWith('password=') } | Select-Object -First 1
if (!$secretLine) { throw 'Keine GitHub-Anmeldung verfügbar.' }
$headers = @{Authorization = 'Bearer ' + $secretLine.Substring(9); Accept = 'application/vnd.github+json'; 'X-GitHub-Api-Version' = '2026-03-10'}
function Write-GitHubJson([string]$Uri, [string]$Method, [hashtable]$Value) {
    Invoke-RestMethod $Uri -Headers $headers -Method $Method -Body ([Text.Encoding]::UTF8.GetBytes(($Value | ConvertTo-Json -Depth 8))) -ContentType 'application/json; charset=utf-8'
}
try {
    $sourceRepository = Invoke-RestMethod $source -Headers $headers
    if (!$sourceRepository.private) { throw 'Das Quellrepository ist nicht privat. Bitte die Veröffentlichungskonfiguration prüfen.' }
    $release = Invoke-RestMethod "$source/releases/tags/$tag" -Headers $headers
    if ($release.draft) { throw 'Erst das geprüfte Quellrelease veröffentlichen; Entwürfe werden nicht gespiegelt.' }
    $names = @("Schreibatelier-$Version-Setup-win-x64.exe", "Schreibatelier-$Version-Portable-win-x64.zip", 'SHA256SUMS.txt')
    foreach ($name in $names) {
        $asset = @($release.assets | Where-Object name -eq $name)
        if ($asset.Count -ne 1 -or $asset[0].digest -notmatch '^sha256:[a-f0-9]{64}$') { throw "Asset oder SHA-256 fehlt: $name" }
        $asset = $asset[0]; $file = Join-Path $staging $name
        if (!(Test-Path -LiteralPath $file) -or ('sha256:' + (Get-FileHash -LiteralPath $file).Hash.ToLowerInvariant()) -ne $asset.digest) {
            $downloadHeaders = $headers.Clone(); $downloadHeaders.Accept = 'application/octet-stream'
            Invoke-WebRequest "$source/releases/assets/$($asset.id)" -Headers $downloadHeaders -OutFile $file -TimeoutSec 1800
            $downloadHeaders.Clear()
        }
        if ((Get-Item -LiteralPath $file).Length -ne $asset.size -or ('sha256:' + (Get-FileHash -LiteralPath $file).Hash.ToLowerInvariant()) -ne $asset.digest) { throw "Download-Prüfung fehlgeschlagen: $name" }
        Write-Output "Originalpaket bestätigt: $name"
    }
    $repo = $null
    try { $repo = Invoke-RestMethod $target -Headers $headers } catch { if ([int]$_.Exception.Response.StatusCode -ne 404) { throw } }
    if (!$repo) {
        $repo = Write-GitHubJson 'https://api.github.com/user/repos' Post @{name='Schreibatelier-Releases'; description='Öffentliche Windows-Downloads und Updates für Schreibatelier. Der Anwendungscode wird separat verwaltet.'; private=$false; auto_init=$true; has_issues=$false; has_wiki=$false; has_projects=$false}
    }
    if ($repo.private -or $repo.full_name -ne 'nikdwo/Schreibatelier-Releases') { throw 'Das Download-Repository muss öffentlich sein und zur Update-Quelle passen.' }
    $mirror = $null
    try { $mirror = Invoke-RestMethod "$target/releases/tags/$tag" -Headers $headers } catch { if ([int]$_.Exception.Response.StatusCode -ne 404) { throw } }
    if (!$mirror) {
        $notes = "Windows-Downloads für Schreibatelier $Version. Installer und portables ZIP sind bytegleich mit den bereits geprüften Originalpaketen. Lizenztexte und Anleitung liegen in den Paketen. SHA256SUMS.txt enthält die Prüfsummen. Diese Pakete sind nicht digital signiert und benötigen Microsoft Edge WebView2 Runtime."
        if ($release.prerelease) { $notes = "Vorabversion zum Testen. Wichtige Manuskripte zusätzlich sichern.`n`n" + $notes }
        $mirror = Write-GitHubJson "$target/releases" Post @{tag_name=$tag; target_commitish=$repo.default_branch; name="Schreibatelier $Version"; body=$notes; draft=$true; prerelease=[bool]$release.prerelease}
    }
    foreach ($name in $names) {
        $file = Get-Item -LiteralPath (Join-Path $staging $name)
        $digest = 'sha256:' + (Get-FileHash -LiteralPath $file.FullName).Hash.ToLowerInvariant()
        $existing = $mirror.assets | Where-Object name -eq $name
        if ($existing) {
            if ($existing.digest -ne $digest -or $existing.size -ne $file.Length) { throw "Vorhandenes öffentliches Asset weicht ab; keine Überschreibung: $name" }
            continue
        }
        if (!$mirror.draft) { throw 'Das öffentliche Release ist bereits veröffentlicht und unvollständig. Keine Änderung.' }
        $upload = $mirror.upload_url.Split('{')[0] + '?name=' + [Uri]::EscapeDataString($name)
        $uploaded = Invoke-RestMethod $upload -Headers $headers -Method Post -InFile $file.FullName -ContentType 'application/octet-stream' -TimeoutSec 1800
        if ($uploaded.digest -ne $digest -or $uploaded.size -ne $file.Length -or $uploaded.state -ne 'uploaded') { throw "Upload-Prüfung fehlgeschlagen: $name" }
        Write-Output "Öffentliches Asset vorbereitet: $name"
    }
    $complete = Invoke-RestMethod "$target/releases/$($mirror.id)" -Headers $headers
    if ($complete.assets.Count -ne 3) { throw 'Erwartet werden genau drei öffentliche Assets.' }
    if ($complete.draft) { $null = Write-GitHubJson "$target/releases/$($mirror.id)" Patch @{draft=$false; prerelease=[bool]$release.prerelease; make_latest= $(if ($release.prerelease) {'false'} else {'true'})} }
    $public = Invoke-RestMethod "$target/releases/tags/$tag" -Headers @{Accept='application/vnd.github+json'}
    if ($public.draft -or $public.assets.Count -ne 3) { throw 'Anonyme Prüfung des öffentlichen Releases fehlgeschlagen.' }
    foreach ($name in $names) {
        $asset = $public.assets | Where-Object name -eq $name
        if (!$asset -or $asset.digest -ne ('sha256:' + (Get-FileHash -LiteralPath (Join-Path $staging $name)).Hash.ToLowerInvariant())) { throw "Öffentliche Prüfsumme stimmt nicht: $name" }
    }
    Write-Output ('Öffentlich geprüft: ' + $public.html_url)
    Write-Output ('Quellcode weiterhin privat: ' + $sourceRepository.full_name)
}
finally { $headers.Clear(); $credentialResponse=$null; $secretLine=$null }
