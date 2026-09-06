$ErrorActionPreference='Stop'
$destination = Join-Path $PSScriptRoot '../docs/licenses'
New-Item -ItemType Directory -Force -Path $destination | Out-Null
Invoke-WebRequest 'https://raw.githubusercontent.com/ericsink/SQLitePCL.raw/v2.1.12/LICENSE.TXT' -OutFile (Join-Path $destination 'SQLitePCL.raw-LICENSE.TXT')
Invoke-WebRequest 'https://raw.githubusercontent.com/ericsink/SQLitePCL.raw/v2.1.12/NOTICE.TXT' -OutFile (Join-Path $destination 'SQLitePCL.raw-NOTICE.TXT')
Invoke-WebRequest 'https://raw.githubusercontent.com/dotnet/runtime/v10.0.11/LICENSE.TXT' -OutFile (Join-Path $destination 'dotnet-MIT.txt')
