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
var commandTextBox;
var argumentsTextBox;
var ignoreExitCodeCheckBox;

function onDlgLoad()
{
	try
	{
		plugin = window.arguments[0];
		data = window.arguments[1];
		cmd = data.cmd;

		document.getElementById("command-button").addEventListener("command", function(e) { doBrowseForFile("command", "Browse for program") }, true);
		commandTextBox = document.getElementById("command");
		argumentsTextBox = document.getElementById("arguments");
		ignoreExitCodeCheckBox = document.getElementById("ignore-exit-code");

		initializeDialogBox(cmd);
	}
	catch (ex)
	{
		alert("Got an exception in onDlgLoad(): " + ex);
	}

	return true;
}

function initializeDialogBox(cmd)
{
	commandTextBox.value = cmd.command;
	argumentsTextBox.value = cmd.arguments;
	ignoreExitCodeCheckBox.checked = !!cmd.ignoreExitCode;
}

function saveDialogBox(cmd)
{
	cmd.command = commandTextBox.value;
	cmd.arguments = argumentsTextBox.value;
	cmd.ignoreExitCode = !!ignoreExitCodeCheckBox.checked;
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
