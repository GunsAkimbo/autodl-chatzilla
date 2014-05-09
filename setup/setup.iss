; ***** BEGIN LICENSE BLOCK *****
; Version: MPL 1.1
;
; The contents of this file are subject to the Mozilla Public License Version
; 1.1 (the "License"); you may not use this file except in compliance with
; the License. You may obtain a copy of the License at
; http://www.mozilla.org/MPL/
;
; Software distributed under the License is distributed on an "AS IS" basis,
; WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
; for the specific language governing rights and limitations under the
; License.
;
; The Original Code is IRC Auto Downloader.
;
; The Initial Developer of the Original Code is
; David Nilsson.
; Portions created by the Initial Developer are Copyright (C) 2010
; the Initial Developer. All Rights Reserved.
;
; Contributor(s):
;
; ***** END LICENSE BLOCK ***** */

#define MyVersion "2.12"
#define MyAppName "IRC Auto Downloader"
#define MyAppPublisher "David Nilsson"
#define MyAppURL "http://sourceforge.net/projects/autodl/"

[Setup]
AppId={{BA87DEE5-7879-4ACD-9542-A144D1029A23}
AppName={#MyAppName}
AppVerName={#MyAppName} {#MyVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
OutputDir=out
SourceDir=.
OutputBaseFilename=setup-v{#MyVersion}
Compression=lzma
SolidCompression=yes
PrivilegesRequired=lowest
CreateAppDir=yes
Uninstallable=yes
DisableDirPage=yes
DefaultDirName=if you can read this it's a bug
UsePreviousAppDir=no
InfoAfterFile=infoafter.txt

[Languages]
Name: english; MessagesFile: compiler:Default.isl

[Files]
Source: ..\src\*; DestDir: {app}; Excludes: .svn; Flags: ignoreversion recursesubdirs

[Code]
type
	TLocation = record
		programName: String;	// FireFox or XUL Runner
		profileName: String;	// Name of profile as found in profiles.ini
		profilePath: String;	// Absolute path to profile
	end;

	TLocations = array of TLocation;

var
	Locations: TLocations;
	InstallPage: TWizardPage;
	ListBox: TListBox;

procedure UpdateAppDir();
	var i: Integer;
begin
	i := ListBox.ItemIndex;
	if i < 0 then begin i := 0 end;
	WizardForm.DirEdit.Text := AddBackslash(Locations[i].profilePath) + 'chatzilla\scripts\autodl';
end;

function ShouldSkipPage(PageID: Integer): Boolean;
begin
	Result := False;
	if (GetArrayLength(Locations) <= 1) and (PageID = InstallPage.ID) then begin
		Result := True;
	end;
	UpdateAppDir();
end;

procedure ScanForChatZilla(const path, programName: String);
	var i: Integer;
		j: LongInt;
		isRelative: Boolean;
		profileSection, profilesIni, profileName, profilePath: String;
begin
	if not DirExists(path) then begin
		exit;
	end;

	path := AddBackslash(path);
	profilesIni := path + 'profiles.ini';
	for i := 0 to 9 do begin
		profileSection := 'Profile' + IntToStr(i);
		profileName := GetIniString(profileSection, 'Name', '', profilesIni);
		isRelative := GetIniBool(profileSection, 'IsRelative', True, profilesIni);
		profilePath := GetIniString(profileSection, 'Path', '', profilesIni);
		if (profileName <> '') and (profilePath <> '') then begin
			if isRelative = True then begin
				profilePath := path + profilePath;
			end;
			StringChangeEx(profilePath, '/', '\', True);

			if DirExists(AddBackslash(profilePath) + 'chatzilla') then begin
				j := GetArrayLength(Locations);
				SetArrayLength(Locations, j + 1);
				Locations[j].programName := programName;
				Locations[j].profileName := profileName;
				Locations[j].profilePath := profilePath;
			end;
		end;
	end;
end;

function UpdateReadyMemo(Space, NewLine, MemoUserInfoInfo, MemoDirInfo, MemoTypeInfo, MemoComponentsInfo, MemoGroupInfo, MemoTasksInfo: String): String;
begin
	UpdateAppDir();
	(* {app} constant is not updated immediately after writing to WizardForm.DirEdit.Text! *)
	Result := 'Installation folder' + NewLine +
				Space + WizardForm.DirEdit.Text + NewLine;
end;

procedure InitializeWizard();
	var i: Integer;
begin
	ScanForChatZilla(AddBackslash(GetEnv('APPDATA')) + 'Mozilla\FireFox', 'FireFox');
	ScanForChatZilla(AddBackslash(GetEnv('APPDATA')) + 'ChatZilla', 'XUL Runner');

	if GetArrayLength(Locations) = 0 then begin
		MsgBox('Could not find the ChatZilla installation folder. Make sure you have the latest version of FireFox or XUL Runner installed, then install ChatZilla. Also make sure ChatZilla has been started at least once after installing it!', mbError, MB_OK);
		Abort();
		exit;
	end;

	InstallPage := CreateCustomPage(wpWelcome, 'Select installation folder', 'More than one ChatZilla installation folder was found');
	ListBox := TNewListBox.Create(InstallPage);
	ListBox.Top := ScaleY(0);
	ListBox.Width := InstallPage.SurfaceWidth;
	ListBox.Height := InstallPage.SurfaceHeight - 20;
	ListBox.Parent := InstallPage.Surface;
	for i := 0 to GetArrayLength(Locations) - 1 do begin
		ListBox.Items.Add(Locations[i].programName + ', Profile: ' + Locations[i].profileName);
	end;
	ListBox.ItemIndex := 0;
end;

