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
var textboxCommands;
var textboxScriptName;
var myListbox;

// Called right before the dialog is displayed. Initialize stuff!
function onDlgLoad()
{
	try
	{
		plugin = window.arguments[0];

		textboxCommands = document.getElementById("textbox-commands");
		textboxScriptName = document.getElementById("script-name");
		textboxScriptName.addEventListener("input", onTextboxInput_scriptName, true);
		document.getElementById("button-new").addEventListener("command", onCommandButton_new, true);
		document.getElementById("button-remove").addEventListener("command", onCommandButton_remove, true);
		document.getElementById("button-extract").addEventListener("command", onCommandButton_extract, true);
		document.getElementById("button-copy").addEventListener("command", onCommandButton_copy, true);
		document.getElementById("button-move").addEventListener("command", onCommandButton_move, true);
		document.getElementById("button-delete").addEventListener("command", onCommandButton_delete, true);
		document.getElementById("button-webui").addEventListener("command", onCommandButton_webui, true);
		document.getElementById("button-exec").addEventListener("command", onCommandButton_exec, true);

		initializeListbox(plugin.scripts);
	}
	catch (ex)
	{
		alert("Got an exception in onDlgLoad(): " + ex);
	}

	return true;
}

function initializeListbox(scripts)
{
	myListbox = new MyListBox("listbox");
	myListbox.userObjSelected = function(newScript, oldScript) { onScriptSelected(newScript, oldScript); };

	if (scripts.length === 0)
		setScript(null);
	else for (var i = 0; i < scripts.length; i++)
	{
		var script = scripts[i];
		myListbox.appendUserObj(script, script.name);
	}
}

// Called when a new script is selected in the listbox
function onScriptSelected(newScript, oldScript)
{
	saveScript(oldScript);
	setScript(newScript);
}

// Save dialog values in this script
function saveScript(script)
{
	if (!script)
		return;

	script.name = textboxScriptName.value;
	script.contents = textboxCommands.value;
}

// Initialize dialog from this script
function setScript(script)
{
	var enabled = !!script;

	textboxScriptName.value = enabled ? script.name : "";
	textboxCommands.value = enabled ? script.contents : "";

	var elemIds = [ "button-extract", "button-copy", "button-move", "button-delete", "button-webui",
					"button-exec", "script-name", "textbox-commands", "button-remove" ];
	for (var i = 0; i < elemIds.length; i++)
	{
		var button = document.getElementById(elemIds[i]);
		button.disabled = !enabled;
	}
}

// Called when the script-name textbox is changed. Time to update the name in the listbox.
function onTextboxInput_scriptName(e)
{
	var script = myListbox.getActiveUserObj();
	if (!script)
		return;
	myListbox.setUserObjName(script, textboxScriptName.value);
}

// Called when the New button is clicked
function onCommandButton_new(e)
{
	var script =
	{
		name: "",
		contents: "",
	};
	script = myListbox.appendUserObj(script, script.name);
	myListbox.makeUserObjActive(script);
	textboxScriptName.focus();
}

// Called when the Remove button is clicked
function onCommandButton_remove(e)
{
	if (!confirm("Do you really want to remove the selected script?", "Remove script"))
		return;

	var script = myListbox.getActiveUserObj();
	myListbox.removeUserObj(script);
}

function BuildCommandLine(commandName)
{
	this.out = commandName;
}

BuildCommandLine.prototype.addString =
function(flag, value)
{
	if (typeof value === "string")
		value = value.replace(/"/g, "\\\"");

	if (value !== "")
		this.out += " " + flag + " \"" + value + "\"";
}

BuildCommandLine.prototype.addBoolean =
function(flag, value)
{
	if (value)
		this.out += " " + flag;
}

BuildCommandLine.prototype.result =
function()
{
	return this.out;
}

function getDestPath(cmd)
{
	switch (cmd.destPathValue)
	{
	case EXTRACT_DEST_FOLDER:			return "[]" + cmd.destPath;
	case EXTRACT_DEST_FOLDER_ROOT:		return "[root]" + cmd.destPath;
	case EXTRACT_DEST_FOLDER_PARENT:	return "[parent]" + cmd.destPath;
	case EXTRACT_SOURCE_FOLDER:			return "[]$source";
	case EXTRACT_SOURCE_FOLDER_ROOT:	return "[root]$source";
	case EXTRACT_SOURCE_FOLDER_PARENT:	return "[parent]$source";
	default:
		alert("Unknown destPathValue: " + cmd.destPathValue);
		return "";
	}
}

function openCommandDialogBox(cmd)
{
	return openDialogBox("files/AddCommandDlgBox.xul", { cmd: cmd });
}

// Called when the Extract button is clicked
function onCommandButton_extract(e)
{
	var cmd =
	{
		type: "extract",
		destPathValue: EXTRACT_DEST_FOLDER,
		sourcePath: "",
		destPath: "",
		excludeFiles: "*.nfo, *.sfv",	// don't copy
		checkbox1: true,	// copy non-archives
		checkbox2: false,	// delete archives
	};

	if (!openCommandDialogBox(cmd))
		return;

	var build = new BuildCommandLine(cmd.type);
	build.addString("--source-path", cmd.sourcePath);
	build.addString("--destination-path", getDestPath(cmd));
	build.addString("--dont-copy", cmd.excludeFiles);
	build.addBoolean("--copy-non-archive", cmd.checkbox1);
	build.addBoolean("--delete-archives", cmd.checkbox2);
	addCommandString(build.result());
}

function onCommandButton_copy(e)
{
	var cmd =
	{
		type: "copy",
		destPathValue: EXTRACT_DEST_FOLDER,
		sourcePath: "",
		destPath: "",
		excludeFiles: "",	// don't copy
		checkbox1: false,	// not used
		checkbox2: false,	// not used
	};

	if (!openCommandDialogBox(cmd))
		return;

	var build = new BuildCommandLine(cmd.type);
	build.addString("--source-path", cmd.sourcePath);
	build.addString("--destination-path", getDestPath(cmd));
	build.addString("--dont-copy", cmd.excludeFiles);
	addCommandString(build.result());
}

function onCommandButton_move(e)
{
	var cmd =
	{
		type: "move",
		destPathValue: EXTRACT_DEST_FOLDER,
		sourcePath: "",
		destPath: "",
		excludeFiles: "",	// don't move
		checkbox1: false,	// not used
		checkbox2: false,	// not used
	};

	if (!openCommandDialogBox(cmd))
		return;

	var build = new BuildCommandLine(cmd.type);
	build.addString("--source-path", cmd.sourcePath);
	build.addString("--destination-path", getDestPath(cmd));
	build.addString("--dont-move", cmd.excludeFiles);
	addCommandString(build.result());
}

function onCommandButton_delete(e)
{
	var cmd =
	{
		type: "delete",
		destPathValue: EXTRACT_DEST_FOLDER,
		sourcePath: "",
		destPath: "",		// not used
		excludeFiles: "",	// don't delete
		checkbox1: false,	// not used
		checkbox2: false,	// not used
	};

	if (!openCommandDialogBox(cmd))
		return;

	var build = new BuildCommandLine(cmd.type);
	build.addString("--source-path", cmd.sourcePath);
	build.addString("--dont-delete", cmd.excludeFiles);
	addCommandString(build.result());
}

function onCommandButton_webui(e)
{
	var cmd =
	{
		command: WEBUI_SETMAXUL,
		argument: "",
	};

	if (!openDialogBox("files/AddWebuiCommand.xul", { cmd: cmd }))
		return;

	var build = new BuildCommandLine("webui");
	build.addString("--command", cmd.command);
	build.addString("--argument", cmd.argument);
	addCommandString(build.result());
}

function onCommandButton_exec(e)
{
	var cmd =
	{
		command: "",
		arguments: "",
		ignoreExitCode: false,
	};

	if (!openDialogBox("files/AddExecCommand.xul", { cmd: cmd }))
		return;

	var build = new BuildCommandLine("exec");
	build.addString("--command", cmd.command);
	build.addString("--arguments", cmd.arguments);
	build.addBoolean("--ignore-exit-code", cmd.ignoreExitCode);
	addCommandString(build.result());
}

function addCommandString(cmdString)
{
	var s = textboxCommands.value;
	if (s.length !== 0 && s[s.length-1] !== "\n")
		s += "\n";
	s += cmdString + "\n";
	textboxCommands.value = s;
}

function openDialogBox(xulFile, data)
{
	data.pressedOk = false;

	plugin_openDialog(
	{
		window: window,
		varName: "scripteditor",
		xulFile: xulFile,
		arg1: data,
		isModal: true,
	});

	return data.pressedOk;
}

// Called when the user clicks OK or presses the Enter key
function onDialogAccept()
{
	try
	{
		plugin.scripts = myListbox.getCleanUserObjArray();
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
	plugin.scope.dialogScriptEditor = null;
}

// Should be the last statement in the file to indicate it loaded successfully
true;
