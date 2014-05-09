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
var myListbox;
var allTrackers = {};
var deck;

// Called right before the dialog is displayed. Initialize stuff!
function onDlgLoad()
{
	try
	{
		plugin = window.arguments[0];
		allTrackers = plugin.trackers;

		initializeListBox();
		initializeDeck();
	}
	catch (ex)
	{
		alert("Got an exception in onDlgLoad(): " + ex);
	}

	return true;
}

function deckIndexFromTracker(tracker)
{
	if (!tracker)
		return -1;

	var deckChildren = getChildElements(deck);
	var value = readAttribute(myListbox.getListitem(tracker), "value");
	for (var i = 0; i < deckChildren.length; i++)
	{
		if (value === readAttribute(deckChildren[i], "id"))
			return i;
	}

	return -1;
}

function typeToId(type)
{
	return "tracker-" + type;
}

function settingIdFromName(tracker, name)
{
	return typeToId(tracker.type) + "-" + name;
}

function getTrackerTypes()
{
	var aryTrackers = [];
	for (var type in allTrackers)
	{
		var tracker = allTrackers[type];
		aryTrackers.push(
		{
			label:	tracker.longName,
			id:		typeToId(tracker.type),
		});
	}

	return aryTrackers;
}

function initializeListBox()
{
	var aryTrackers = getTrackerTypes();
	aryTrackers.sort(function(a, b)
	{
		return stringCompare(a.label.toLowerCase(), b.label.toLowerCase());
	});

	myListbox = new MyListBox("trackers-listbox");
	myListbox.userObjSelected = function(newTracker, oldTracker) { onTrackerSelected(newTracker, oldTracker); };

	for (var i = 0; i < aryTrackers.length; i++)
	{
		var tracker = myListbox.appendUserObj(aryTrackers[i], aryTrackers[i].label);
		var listitem = myListbox.getListitem(tracker);
		listitem.setAttribute("value", tracker.id);
	}
}

function onTrackerSelected(newTracker, oldTracker)
{
	deck.selectedIndex = deckIndexFromTracker(newTracker);
}

function initializeDeck()
{
	deck = document.getElementById("trackers-settings-deck");
	for (var type in allTrackers)
	{
		var tracker = allTrackers[type];
		var elem = createDeckElem(tracker);
		deck.appendChild(elem);
	}
}

function createDeckElem(tracker)
{
	var vbox = document.createElement("vbox");
	vbox.setAttribute("id", typeToId(tracker.type));
		var grid = document.createElement("grid");
		vbox.appendChild(grid);
			var columns = document.createElement("columns");
			grid.appendChild(columns);
				var column = document.createElement("column");
				columns.appendChild(column);
				var column = document.createElement("column");
				column.setAttribute("flex", "1");
				columns.appendChild(column);
			var rows = document.createElement("rows");
			grid.appendChild(rows);

	if (tracker.forceDisabled === true)
	{
		var description = document.createElement("description");
		var textnode = document.createTextNode(tracker.longName + " has been disabled until the announce channel has been fixed.");
		description.appendChild(textnode);
		rows.appendChild(description);
	}
	else for (var i = 0; i < tracker.settings.length; i++)
	{
		var elem = createTrackerSettingsElem(tracker, tracker.settings[i]);
		rows.appendChild(elem);
	}

	return vbox;
}

function createTrackerSettingsElem(tracker, setting)
{
	var id = settingIdFromName(tracker, setting.name);
	switch (setting.type)
	{
	case "bool":
		var checkbox = document.createElement("checkbox");
		checkbox.setAttribute("id", id);
		checkbox.setAttribute("label", setting.text);
		checkbox.setAttribute("accesskey", setting.accesskey);
		checkbox.setAttribute("tooltiptext", setting.tooltiptext);
		checkbox.setAttribute("checked", !!readTrackerOption(tracker, setting.name));
		return checkbox;

	case "textbox":
		var row = document.createElement("row");
		var label = document.createElement("label");
		var textbox = document.createElement("textbox");
		row.appendChild(label);
		row.appendChild(textbox);
		label.setAttribute("control", id);
		label.setAttribute("value", setting.text);
		label.setAttribute("accesskey", setting.accesskey);
		textbox.setAttribute("id", id);
		textbox.setAttribute("emptytext", setting.emptytext);
		textbox.setAttribute("tooltiptext", setting.tooltiptext);
		textbox.setAttribute("value", readTrackerOption(tracker, setting.name));
		if (setting.pasteRegex && setting.pasteGroup)
		{
			textbox.addEventListener("input", function(e) { onPaste(tracker, setting.pasteGroup, this); }, true);
		}
		return row;

	case "integer":
		var row = document.createElement("row");
		var label = document.createElement("label");
		var textbox = document.createElement("textbox");
		row.appendChild(label);
		row.appendChild(textbox);
		label.setAttribute("control", id);
		label.setAttribute("value", setting.text);
		label.setAttribute("accesskey", setting.accesskey);
		textbox.setAttribute("id", id);
		textbox.setAttribute("emptytext", setting.emptytext);
		textbox.setAttribute("tooltiptext", setting.tooltiptext);
		textbox.setAttribute("value", readTrackerOption(tracker, setting.name));
		textbox.setAttribute("type", "number");
		if (setting.minValue !== undefined)
			textbox.setAttribute("min", setting.minValue);
		if (setting.maxValue !== undefined)
			textbox.setAttribute("max", setting.maxValue);
		return row;

	case "description":
		var description = document.createElement("description");
		var textnode = document.createTextNode(setting.text)
		description.appendChild(textnode);
		return description;

	default:
		throw "Unknown tracker setting: " + setting.type;
	}
}

// Called when the textbox is modified by the user (eg. paste) and the setting has a pasteRegex prop
function onPaste(tracker, pasteGroup, textboxElem)
{
	var s = textboxElem.value;	// Save it because it could get overwritten
	var names = pasteGroup.split(",");
	for (var i = 0; i < names.length; i++)
	{
		var name = stringTrim(names[i]);
		var setting = getTrackerSetting(tracker, name);
		if (!setting)
			continue;

		var textbox = document.getElementById(settingIdFromName(tracker, name));
		var ary = s.match(setting.pasteRegex);
		if (textbox && ary && ary.length > 1)
			textbox.value = ary[1];
	}
}

function saveSettings()
{
	for (var type in allTrackers)
	{
		var tracker = allTrackers[type];
		if (tracker.forceDisabled === true)
			continue;

		var settings = tracker.settings;
		for (var i = 0; i < settings.length; i++)
		{
			var setting = settings[i];
			var elem = document.getElementById(settingIdFromName(tracker, setting.name));
			switch (setting.type)
			{
			case "bool":
				writeTrackerOption(tracker, setting.name, !!elem.checked);
				break;

			case "textbox":
			case "integer":
			case "delta":
				writeTrackerOption(tracker, setting.name, elem.value);
				break;

			case "description":
				break;

			default:
				throw "Unknown tracker setting: " + setting.type;
			}
		}
	}
}

// Called when the user clicks OK or presses the Enter key
function onDialogAccept()
{
	try
	{
		saveSettings();
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
	plugin.scope.dialogTrackers = null;
}

// Should be the last statement in the file to indicate it loaded successfully
true;
