param([switch]$Release)
$ErrorActionPreference = 'Stop'
Push-Location (Join-Path $PSScriptRoot '..')
try {
    $version = (Get-Content -LiteralPath package.json -Raw | ConvertFrom-Json).version
    $publishDirectory = "artifacts/Schreibatelier-$version/app"
    $env:NODE_OPTIONS = '--use-system-ca'
    $env:DOTNET_CLI_TELEMETRY_OPTOUT = '1'
    $env:DOTNET_ADD_GLOBAL_TOOLS_TO_PATH = '0'
    npm.cmd ci --ignore-scripts --cache .work/npm-cache
    if ($LASTEXITCODE) { throw 'npm ci fehlgeschlagen' }
    node node_modules/typescript/bin/tsc --noEmit
    if ($LASTEXITCODE) { throw 'TypeScript-Prüfung fehlgeschlagen' }
    npm.cmd run build
    if ($LASTEXITCODE) { throw 'Editor-Build fehlgeschlagen' }
    dotnet restore src/Schreibatelier.App/Schreibatelier.App.csproj --configfile NuGet.Config --packages .work/nuget --locked-mode
    if ($LASTEXITCODE) { throw 'NuGet-Restore fehlgeschlagen' }
    if ($Release) { dotnet publish src/Schreibatelier.App/Schreibatelier.App.csproj -c Release -r win-x64 --self-contained true --no-restore -o $publishDirectory }
    else { dotnet build src/Schreibatelier.App/Schreibatelier.App.csproj --no-restore }
    if ($LASTEXITCODE) { throw 'Windows-Build fehlgeschlagen' }
    node scripts/licenses.mjs
    if ($LASTEXITCODE) { throw 'Lizenzinventar fehlgeschlagen' }
    if ($Release) {
        foreach ($name in @('java','languagetool')) {
            $folder = Join-Path '.tools' $name
            if (!(Test-Path -LiteralPath $folder)) { throw 'Bitte scripts/install-proofreading.ps1 ausführen, bevor das Release erstellt wird.' }
            New-Item -ItemType Directory -Force -Path "$publishDirectory/Proofreading" | Out-Null
            Copy-Item -LiteralPath $folder -Destination "$publishDirectory/Proofreading" -Recurse -Force
        }
        Copy-Item -LiteralPath .tools/proofreading-sources.json -Destination "$publishDirectory/Proofreading/sources.json"
        & (Join-Path $PSScriptRoot 'create-shortcut.ps1')
        Copy-Item -LiteralPath THIRD_PARTY_NOTICES.txt,README.md,LICENSE -Destination $publishDirectory
        New-Item -ItemType Directory -Force -Path "$publishDirectory/docs","$publishDirectory/scripts" | Out-Null
        Copy-Item -Path docs/* -Destination "$publishDirectory/docs" -Recurse -Force
        Copy-Item -LiteralPath scripts/install-tools.ps1,scripts/install-proofreading.ps1 -Destination "$publishDirectory/scripts"
        & (Join-Path $PSScriptRoot 'package.ps1') -ApplicationDirectory $publishDirectory
    }
}
finally { Pop-Location }
