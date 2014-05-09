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

const SAD_AND = 0;
const SAD_OR = 1;

function ScriptExecDialog()
{
}

ScriptExecDialog.prototype.idToValue =
{
	"sad-and":	SAD_AND,
	"sad-or":	SAD_OR,
};

ScriptExecDialog.prototype.onDlgLoad =
function()
{
	document.getElementById("sau-button").addEventListener("command", function(e) { chooseScript("sau"); }, true);
	document.getElementById("sad-button").addEventListener("command", function(e) { chooseScript("sad"); }, true);

	this.menulist = new Menulist("sad-menulist", this.idToValue);
}

ScriptExecDialog.prototype.initializeGui =
function(scriptExecOptions)
{
	var setElem = new SetElemOptions2(scriptExecOptions);

	document.getElementById("sad-ratio-checkbox").addEventListener("command", function(e) { onCommandCheckbox(); }, true);
	document.getElementById("sad-seeding-time-checkbox").addEventListener("command", function(e) { onCommandCheckbox(); }, true);

	setElem.setValue("sau", "uploaded", "scriptName");
	setElem.setValue("sau-secs", "uploaded", "execAfterSeconds");

	setElem.setValue("sad", "downloadedData", "scriptName");
	setElem.setCheck("sad-ratio-checkbox", "downloadedData", "useRatio");
	setElem.setValue("sad-ratio-textbox", "downloadedData", "ratio");
	setElem.setCheck("sad-seeding-time-checkbox", "downloadedData", "useSeedingTime");
	setElem.setValue("sad-seeding-time-textbox", "downloadedData", "seedingTimeHours");

	var isAnd = scriptExecOptions.downloadedData.isAnd;
	this.menulist.selectItemWithValue(isAnd ? SAD_AND : SAD_OR);

	onCommandCheckbox();
}

function onCommandCheckbox()
{
	var ratioCheckbox = document.getElementById("sad-ratio-checkbox");
	var seedingTimeCheckbox = document.getElementById("sad-seeding-time-checkbox");

	document.getElementById("sad-ratio-textbox").disabled = !ratioCheckbox.checked;
	document.getElementById("sad-seeding-time-textbox").disabled = !seedingTimeCheckbox.checked;
	document.getElementById("sad-menulist").disabled = !ratioCheckbox.checked || !seedingTimeCheckbox.checked;
}

ScriptExecDialog.prototype.saveValues =
function(scriptExecOptions)
{
	scriptExecOptions.uploaded.scriptName = document.getElementById("sau").value;
	scriptExecOptions.uploaded.execAfterSeconds = parseInt(document.getElementById("sau-secs").value, 10);

	scriptExecOptions.downloadedData.scriptName = document.getElementById("sad").value;
	scriptExecOptions.downloadedData.useRatio = !!document.getElementById("sad-ratio-checkbox").checked;
	scriptExecOptions.downloadedData.ratio = parseFloat(document.getElementById("sad-ratio-textbox").value);
	scriptExecOptions.downloadedData.useSeedingTime = !!document.getElementById("sad-seeding-time-checkbox").checked;
	scriptExecOptions.downloadedData.seedingTimeHours = parseFloat(document.getElementById("sad-seeding-time-textbox").value);

	scriptExecOptions.downloadedData.isAnd = this.menulist.getSelectedValue() === SAD_AND;
}

function chooseScript(textboxId)
{
	var scripts = plugin.scripts;
	if (scripts.length === 0)
	{
		alert("There are no scripts. Create a script using the Script Editor.");
		return;
	}

	var textbox = document.getElementById(textboxId);

	var listboxData = [];
	for (var i = 0; i < scripts.length; i++)
	{
		var script = scripts[i];
		listboxData.push(
		{
			displayName: script.name,
			validNames: [ script.name ],
		});
	}

	var data =
	{
		selectedText: textbox.value,
		listboxData: listboxData,
		multiSelect: false,
		title: "Choose a script.",
	};

	plugin_openDialog(
	{
		window: window,
		varName: "scriptexecdialog",
		xulFile: "files/listbox.xul",
		arg1: data,
		isModal: true,
	});

	textbox.value = data.selectedText;
}

// Should be the last statement in the file to indicate it loaded successfully
true;
