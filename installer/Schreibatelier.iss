#ifndef AppSource
  #error AppSource must point to the published application.
#endif
#ifndef ReleaseVersion
  #error ReleaseVersion is required.
#endif

[Setup]
AppId={{9E0349A6-29C2-4594-937C-131560CBF1AB}
AppName=Schreibatelier
AppVersion={#ReleaseVersion}
AppVerName=Schreibatelier Alpha 6 ({#ReleaseVersion})
VersionInfoVersion=0.1.0.6
VersionInfoDescription=Schreibatelier Alpha 6 Setup
AppPublisher=nikdwo
AppPublisherURL=https://github.com/nikdwo/Scrivener-Clone
DefaultDirName={localappdata}\Programs\Schreibatelier
DefaultGroupName=Schreibatelier
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
WizardStyle=modern
Compression=lzma2
SolidCompression=yes
OutputDir=..\artifacts\releases\{#ReleaseVersion}
OutputBaseFilename=Schreibatelier-{#ReleaseVersion}-Setup-win-x64
SetupIconFile=..\src\Schreibatelier.App\Assets\Schreibatelier.ico
UninstallDisplayIcon={app}\Schreibatelier.exe
InfoBeforeFile=alpha-info.txt
CloseApplications=no
RestartApplications=no

[Languages]
Name: "german"; MessagesFile: "compiler:Languages\German.isl"

[Tasks]
Name: "desktopicon"; Description: "Desktop-Verknüpfung erstellen"; Flags: unchecked

[Files]
Source: "{#AppSource}\*"; DestDir: "{app}"; Excludes: "*.pdb,portable.txt,Data\*,.tools\*"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\Schreibatelier Alpha 6"; Filename: "{app}\Schreibatelier.exe"; WorkingDir: "{app}"
Name: "{autodesktop}\Schreibatelier Alpha 6"; Filename: "{app}\Schreibatelier.exe"; WorkingDir: "{app}"; Tasks: desktopicon

[Run]
Filename: "{app}\Schreibatelier.exe"; Description: "Schreibatelier Alpha 6 starten"; Flags: nowait postinstall skipifsilent
