$ErrorActionPreference = 'Stop'
Push-Location (Join-Path $PSScriptRoot '..')
try {
    npm.cmd test
    if ($LASTEXITCODE) { throw 'Editor-Logiktests fehlgeschlagen' }
    dotnet restore tests/Schreibatelier.Checks/Schreibatelier.Checks.csproj --configfile NuGet.Config --packages .work/nuget
    if ($LASTEXITCODE) { throw 'Test-Restore fehlgeschlagen' }
    dotnet run --project tests/Schreibatelier.Checks/Schreibatelier.Checks.csproj --no-restore -- (Get-Location).Path
    if ($LASTEXITCODE) { throw 'Speicher-/Exporttests fehlgeschlagen' }
    dotnet restore tests/Schreibatelier.ProofChecks/Schreibatelier.ProofChecks.csproj --configfile NuGet.Config --packages .work/nuget
    if ($LASTEXITCODE) { throw 'Sprachprüfung-Restore fehlgeschlagen' }
    dotnet run --project tests/Schreibatelier.ProofChecks/Schreibatelier.ProofChecks.csproj --no-restore -- (Get-Location).Path
    if ($LASTEXITCODE) { throw 'Lokale Sprachprüfung fehlgeschlagen' }
}
finally { Pop-Location }
