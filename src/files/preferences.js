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

window.addEventListener("dialogaccept", onDialogAccept, true);
window.addEventListener("dialogcancel", onDialogCancel, true);

var plugin = {};

var uploadMethod;
var scriptExecDialog;
var updateMenulist;

var updateMenulist_idToValue =
{
	"update-auto":		UPDATE_AUTO,
	"update-ask":		UPDATE_ASK,
	"update-disabled":	UPDATE_DISABLED,
};

// Called right before the dialog is displayed. Initialize stuff!
function onDlgLoad()
{
	try
	{
		plugin = window.arguments[0];

		uploadMethod = new UploadMethod();
		scriptExecDialog = new ScriptExecDialog();

		document.getElementById("temp-download-folder-button").addEventListener("command", tempDownloadFolder_onCommand, true);
		document.getElementById("path-rar-button").addEventListener("command", pathRarButton_onCommand, true);
		document.getElementById("path-utorrent-button").addEventListener("command", function(e) { doBrowseForFile("path-utorrent", "Find uTorrent.exe"); }, true);
		updateMenulist = new Menulist("update-menulist", updateMenulist_idToValue);

		uploadMethod.onDlgLoad();
		scriptExecDialog.onDlgLoad();

		initializeOptions(plugin.options);
	}
	catch (ex)
	{
		alert("Got an exception in onDlgLoad(): " + ex);
	}

	return true;
}

// Initialize the dialog box from the current options
function initializeOptions(options)
{
	if (!options)
		return;

	function setValue(id, value)
	{
		var elem = document.getElementById(id);
		elem.value = value.toString();
	}
	function setCheck(id, isChecked)
	{
		var elem = document.getElementById(id);
		elem.checked = !!isChecked;
	}

	setValue("temp-download-folder", options.tempdir);
	setValue("download-user-agent", options.userAgent);
	setValue("max-saved-releases", options.maxSavedReleases);
	setValue("max-download-retry-time", options.maxDownloadRetryTimeSeconds);
	setValue("debug-output-level", options.level);
	setCheck("debug-debug", options.debug);
	setCheck("save-download-history", options.saveDownloadHistory);
	setCheck("download-dupe-releases", options.downloadDupeReleases);
	setValue("path-rar", options.pathToUnrar);
	setValue("path-utorrent", options.pathToUtorrent);
	updateMenulist.selectItemWithValue(options.updateCheck);

	setValue("webui-user", options.webui.user);
	setValue("webui-password", options.webui.password);
	setValue("webui-hostname", options.webui.hostname);
	setValue("webui-port", options.webui.port);
	setCheck("webui-https", options.webui.https);

	setValue("ftp-user", options.ftp.user);
	setValue("ftp-password", options.ftp.password);
	setValue("ftp-hostname", options.ftp.hostname);
	setValue("ftp-port", options.ftp.port);

	uploadMethod.initializeGui(options.uploadMethod);
	scriptExecDialog.initializeGui(options.scriptExecOptions);
}

// Copy dialog box options to our options
function saveOptions(options)
{
	if (!options)
		return;

	function removeProtocol(s)
	{
		var ary = s.match(/^(?:\w*):\/\/(.*)/);
		if (ary)
			return ary[1];
		return s;
	}

	options.tempdir = document.getElementById("temp-download-folder").value;
	options.userAgent = document.getElementById("download-user-agent").value;
	options.maxSavedReleases = parseInt(document.getElementById("max-saved-releases").value, 10);
	options.maxDownloadRetryTimeSeconds = parseInt(document.getElementById("max-download-retry-time").value, 10);
	options.level = parseInt(document.getElementById("debug-output-level").value, 10);
	options.debug = !!document.getElementById("debug-debug").checked;
	options.saveDownloadHistory = !!document.getElementById("save-download-history").checked;
	options.downloadDupeReleases = !!document.getElementById("download-dupe-releases").checked;
	options.pathToUnrar = document.getElementById("path-rar").value;
	options.pathToUtorrent = document.getElementById("path-utorrent").value;
	options.updateCheck = updateMenulist.getSelectedValue();

	options.webui.user = document.getElementById("webui-user").value;
	options.webui.password = document.getElementById("webui-password").value;
	options.webui.hostname = removeProtocol(document.getElementById("webui-hostname").value);
	options.webui.port = parseInt(document.getElementById("webui-port").value, 10);
	options.webui.https = !!document.getElementById("webui-https").checked;

	options.ftp.user = document.getElementById("ftp-user").value;
	options.ftp.password = document.getElementById("ftp-password").value;
	options.ftp.hostname = removeProtocol(document.getElementById("ftp-hostname").value);
	options.ftp.port = parseInt(document.getElementById("ftp-port").value, 10);

	uploadMethod.saveValues(options.uploadMethod);
	scriptExecDialog.saveValues(options.scriptExecOptions);
}

// Called when the user clicks the "temp-download-folder" Browse button
function tempDownloadFolder_onCommand(e)
{
	doBrowseForFolder("temp-download-folder", "Temporary download folder");
}

function pathRarButton_onCommand(e)
{
	var path = doBrowseForFile("path-rar", "Find rar.exe or unrar");
	if (path && !path.match(/[\/\\](?:rar\.exe|unrar(?:\.exe)?)/i))
		alert("Does not appear to be the path to rar.exe or unrar.");
}

// Called when the user clicks OK or presses the Enter key
function onDialogAccept()
{
	try
	{
		saveOptions(plugin.options);
	}
	catch (ex)
	{
		alert("Got an exception in onDialogAccept(): " + ex);
	}

	plugin.optionsModified = true;
	dialogClosed();
	return true;
}

// Called when the user clicks Cancel or presses the ESC key
function onDialogCancel()
{
	dialogClosed();
	return true;
}

function dialogClosed()
{
	plugin.scope.dialogPreferences = null;
}

// Should be the last statement in the file to indicate it loaded successfully
true;
