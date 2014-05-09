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
var deck;

var idToValue =
{
	"webui-set-max-upload-speed":	WEBUI_SETMAXUL,
	"webui-set-max-download-speed":	WEBUI_SETMAXDL,
	"webui-set-label":				WEBUI_SETLABEL,
	"webui-start-torrent":			WEBUI_START,
	"webui-stop-torrent":			WEBUI_STOP,
	"webui-pause-torrent":			WEBUI_PAUSE,
	"webui-unpause-torrent":		WEBUI_UNPAUSE,
	"webui-force-start-torrent":	WEBUI_FORCESTART,
	"webui-recheck-torrent":		WEBUI_RECHECK,
	"webui-remove-torrent":			WEBUI_REMOVE,
	"webui-remove-torrent-and-data":WEBUI_REMOVEDATA,
	"webui-queue-bottom":			WEBUI_QUEUEBOTTOM,
	"webui-queue-top":				WEBUI_QUEUETOP,
	"webui-queue-up":				WEBUI_QUEUEUP,
	"webui-queue-down":				WEBUI_QUEUEDOWN,
};

function onDlgLoad()
{
	try
	{
		plugin = window.arguments[0];
		data = window.arguments[1];
		cmd = data.cmd;

		deck = document.getElementById("deck");
		menulist = new Menulist("menulist", idToValue);
		menulist.selectItemWithValue(cmd.command);
		menulist.addCommandListener(onCommandMenulist);

		initializeDialogBox(cmd);
	}
	catch (ex)
	{
		alert("Got an exception in onDlgLoad(): " + ex);
	}

	return true;
}

function updateArgumentTextbox(argument)
{
	switch (menulist.getSelectedValue())
	{
	case WEBUI_SETMAXUL: document.getElementById("ulspeed").value = argument; break;
	case WEBUI_SETMAXDL: document.getElementById("dlspeed").value = argument; break;
	case WEBUI_SETLABEL: document.getElementById("torrent-label").value = argument; break;
	default: break;
	}
}

function getArgument()
{
	switch (menulist.getSelectedValue())
	{
	case WEBUI_SETMAXUL: return parseInt(document.getElementById("ulspeed").value);
	case WEBUI_SETMAXDL: return parseInt(document.getElementById("dlspeed").value);
	case WEBUI_SETLABEL: return document.getElementById("torrent-label").value;
	default: return "";
	}
}

function onCommandMenulist()
{
	var item = menulist.getSelectedItem() || {};
	var newId = "id-" + item.id;
	deck.selectedPanel = document.getElementById(newId);
}

function initializeDialogBox(cmd)
{
	updateArgumentTextbox(cmd.argument);
	onCommandMenulist();
}

function saveDialogBox(cmd)
{
	cmd.argument = getArgument();
	cmd.command = menulist.getSelectedValue();
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
