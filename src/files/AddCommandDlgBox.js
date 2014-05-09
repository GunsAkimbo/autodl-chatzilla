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
var data = {};
var cmd = {};
var menulist;
var sourcePathTextBox;
var destPathTextBox;
var destPathButton;
var excludeFilesTextBox;
var checkbox1;
var checkbox2;

var idToValue =
{
	"dest-folder":			EXTRACT_DEST_FOLDER,
	"dest-folder-root":		EXTRACT_DEST_FOLDER_ROOT,
	"dest-folder-parent":	EXTRACT_DEST_FOLDER_PARENT,
	"source-folder":		EXTRACT_SOURCE_FOLDER,
	"source-folder-root":	EXTRACT_SOURCE_FOLDER_ROOT,
	"source-folder-parent":	EXTRACT_SOURCE_FOLDER_PARENT,
};

function onDlgLoad()
{
	try
	{
		plugin = window.arguments[0];
		data = window.arguments[1];
		cmd = data.cmd;

		document.getElementById("source-path-button").addEventListener("command", function(e) { doBrowseForFolder("source-path", "Browse for source folder") }, true);
		document.getElementById("dest-path-button").addEventListener("command", function(e) { doBrowseForFolder("dest-path", "Browse for destination folder") }, true);
		menulist = new Menulist("dest-path-menulist", idToValue);
		menulist.addCommandListener(function(e) { onMenulistCommand(); });
		sourcePathTextBox = document.getElementById("source-path");
		destPathTextBox = document.getElementById("dest-path");
		destPathButton = document.getElementById("dest-path-button");
		excludeFilesTextBox = document.getElementById("exclude-files");
		checkbox1 = document.getElementById("checkbox1");
		checkbox2 = document.getElementById("checkbox2");

		initializeDialogBox(cmd);
		initializeXul(cmd);
		onMenulistCommand();
	}
	catch (ex)
	{
		alert("Got an exception in onDlgLoad(): " + ex);
	}

	return true;
}

function onCommandDontCopyCheckbox()
{
	excludeFilesTextBox.disabled = !checkbox1.checked;
}

function initializeXul(cmd)
{
	var parent = document.getElementById("vbox");
	var excludeFilesLabel = document.getElementById("exclude-files-label");
	var autodl = document.getElementById("autodl");
	autodl.setAttribute("title", "Add " + cmd.type + " command");

	switch (cmd.type)
	{
	case "extract":
		destPathTextBox.tooltipText = "Destination base folder of extracted files.";
		excludeFilesLabel.accessKey = "n";
		excludeFilesLabel.value = "Don't copy";
		excludeFilesTextBox.emptyText = "These files aren't copied";
		excludeFilesTextBox.tooltipText = "These files aren't copied. Wildcard are allowed, eg. *.nfo, *.sfv";
		checkbox1.label = "Copy non-archive files to destination";
		checkbox1.accessKey = "C";
		checkbox1.tooltipText = "Check it if non-archive files should be copied to destination folder.";
		checkbox2.label = "Delete all archive files";
		checkbox2.accessKey = "e";
		checkbox2.tooltipText = "Check it if all archive files should be deleted after extracting them.";
		checkbox1.addEventListener("command", onCommandDontCopyCheckbox, true);
		onCommandDontCopyCheckbox();
		break;

	case "copy":
		destPathTextBox.tooltipText = "Destination base folder of copied files.";
		excludeFilesLabel.accessKey = "n";
		excludeFilesLabel.value = "Don't copy";
		excludeFilesTextBox.emptyText = "These files aren't copied";
		excludeFilesTextBox.tooltipText = "These files aren't copied. Wildcard are allowed, eg. *.nfo, *.sfv";
		parent.removeChild(checkbox1);
		parent.removeChild(checkbox2);
		break;

	case "move":
		destPathTextBox.tooltipText = "Destination base folder of moved files.";
		excludeFilesLabel.accessKey = "n";
		excludeFilesLabel.value = "Don't move";
		excludeFilesTextBox.emptyText = "These files aren't moved";
		excludeFilesTextBox.tooltipText = "These files aren't moved. Wildcard are allowed, eg. *.nfo, *.sfv";
		parent.removeChild(checkbox1);
		parent.removeChild(checkbox2);
		break;

	case "delete":
		excludeFilesLabel.accessKey = "n";
		excludeFilesLabel.value = "Don't delete";
		excludeFilesTextBox.emptyText = "These files aren't deleted";
		excludeFilesTextBox.tooltipText = "These files aren't deleted. Wildcard are allowed, eg. *.nfo, *.sfv";
		parent.removeChild(document.getElementById("dest-path-hbox1"));
		parent.removeChild(document.getElementById("dest-path-hbox2"));
		parent.removeChild(checkbox1);
		parent.removeChild(checkbox2);
		break;

	default:
		alert("Invalid type: " + cmd.type);
		break;
	}
}

function isDestFolderNeeded()
{
	switch (menulist.getSelectedValue())
	{
	case EXTRACT_DEST_FOLDER:
	case EXTRACT_DEST_FOLDER_ROOT:
	case EXTRACT_DEST_FOLDER_PARENT:
		return true;

	default:
		return false;
	}
}

function onMenulistCommand()
{
	var isUserDefined = isDestFolderNeeded();
	destPathTextBox.disabled = !isUserDefined;
	destPathButton.disabled = !isUserDefined;
}

function initializeDialogBox(cmd)
{
	sourcePathTextBox.value = cmd.sourcePath || "";
	destPathTextBox.value = cmd.destPath || "";
	excludeFilesTextBox.value = cmd.excludeFiles || "";
	checkbox1.checked = !!cmd.checkbox1;
	checkbox2.checked = !!cmd.checkbox2;
	menulist.selectItemWithValue(cmd.destPathValue);
}

function saveDialogBox(cmd)
{
	cmd.sourcePath = sourcePathTextBox.value;
	cmd.destPath = destPathTextBox.value;
	cmd.excludeFiles = excludeFilesTextBox.value;
	cmd.checkbox1 = !!checkbox1.checked;
	cmd.checkbox2 = !!checkbox2.checked;
	cmd.destPathValue = menulist.getSelectedValue();
}

function onDialogAccept()
{
	try
	{
		saveDialogBox(cmd);
	}
	catch (ex)
	{
		alert("Got an exception in onDialogAccept(): " + ex);
	}

	data.pressedOk = true;
	return true;
}

function onDialogCancel()
{
	data.pressedOk = false;
	return true;
}

// Should be the last statement in the file to indicate it loaded successfully
true;
