/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is IRC Auto Downloader.
 *
 * The Initial Developer of the Original Code is
 * David Nilsson.
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * ***** END LICENSE BLOCK ***** */

function UploadMethod()
{
}

UploadMethod.prototype.idToValue =
{
	"um-menuitem-watch-folder":	UPLOAD_WATCH_FOLDER,
	"um-menuitem-webui":		UPLOAD_WEBUI,
	"um-menuitem-ftp":			UPLOAD_FTP,
	"um-menuitem-tool":			UPLOAD_TOOL,
	"um-menuitem-dyndir":		UPLOAD_UTORRENT_DIR,
	"um-sonarr":				UPLOAD_SONARR,
	"um-radarr":				UPLOAD_RADARR,
};

UploadMethod.prototype.onDlgLoad =
function()
{
	var this_ = this;
	this.menulist = new Menulist("um-menulist", this.idToValue);
	this.deck = document.getElementById("um-deck");

	this.menulist.addCommandListener(function(e) { this_.deck.selectedIndex = this_.menulist.getSelectedIndex(); });
	document.getElementById("um-watch-folder-button").addEventListener("command", function(e) { doBrowseForFolder("um-watch-folder", "Torrent client watch folder"); }, true);
	document.getElementById("um-tool-command-button").addEventListener("command", function(e) { doBrowseForFile("um-tool-command", "Browse for program"); }, true);
	document.getElementById("um-dyndir-basedir-button").addEventListener("command", function(e) { doBrowseForFolder("um-dyndir-basedir", "Base folder"); }, true);
}

UploadMethod.prototype.initializeGui =
function(uploadMethod, useOverrideGlobalCheckbox)
{
	var setElem = new SetElemOptions2(uploadMethod);

	setElem.setValue("um-watch-folder", "watchFolder", "dir");
	setElem.setValue("um-ftp-path", "ftp", "path");
	setElem.setValue("um-tool-command", "tool", "command");
	setElem.setValue("um-tool-args", "tool", "args");
	setElem.setValue("um-dyndir-basedir", "dynamicDir", "basedir");
	setElem.setValue("um-dyndir-dyndir", "dynamicDir", "dyndir");
	setElem.setCheck("sonarr-alt-rn", "sonarr", "altRn");
	setElem.setCheck("radarr-alt-rn", "radarr", "altRn");

	if (useOverrideGlobalCheckbox)
		setElem.setCheck("um-override-global", "overrideGlobal");

	this.menulist.selectItemWithValue(uploadMethod ? uploadMethod.type : UPLOAD_WATCH_FOLDER);
	this.deck.selectedIndex = this.menulist.getSelectedIndex();

	var allDisabled = !uploadMethod;
	document.getElementById("um-menulist").disabled = allDisabled;
	document.getElementById("um-watch-folder-button").disabled = allDisabled;
	document.getElementById("um-tool-command-button").disabled = allDisabled;
	document.getElementById("um-dyndir-basedir-button").disabled = allDisabled;
}

UploadMethod.prototype.saveValues =
function(uploadMethod, useOverrideGlobalCheckbox)
{
	uploadMethod.watchFolder.dir = document.getElementById("um-watch-folder").value;
	uploadMethod.ftp.path = document.getElementById("um-ftp-path").value;
	uploadMethod.tool.command = document.getElementById("um-tool-command").value;
	uploadMethod.tool.args = document.getElementById("um-tool-args").value;
	uploadMethod.dynamicDir.basedir = document.getElementById("um-dyndir-basedir").value;
	uploadMethod.dynamicDir.dyndir = document.getElementById("um-dyndir-dyndir").value;
	uploadMethod.sonarr.altRn = document.getElementById("sonarr-alt-rn").checked;
	uploadMethod.radarr.altRn = document.getElementById("radarr-alt-rn").checked;
	
	if (useOverrideGlobalCheckbox)
		uploadMethod.overrideGlobal = !!document.getElementById("um-override-global").checked;

	uploadMethod.type = this.menulist.getSelectedValue();
}

// Should be the last statement in the file to indicate it loaded successfully
true;
