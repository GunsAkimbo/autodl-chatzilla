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
var listbox;
var listboxInfo;

// Called right before the dialog is displayed. Initialize stuff!
function onDlgLoad()
{
	try
	{
		plugin = window.arguments[0];
		listboxInfo = window.arguments[1];
		initializeListBox();
	}
	catch (ex)
	{
		alert("Got an exception in onDlgLoad(): " + ex);
	}

	return true;
}

function initializeListBox()
{
	listbox = document.getElementById("listbox");
	if (listboxInfo.multiSelect)
		listbox.setAttribute("seltype", "multiple");

	var description = document.getElementById("description");
	description.appendChild(document.createTextNode(listboxInfo.title));

	listboxInfo.listboxData.sort(function(a, b)
	{
		return stringCompare(a.displayName.toLowerCase(), b.displayName.toLowerCase());
	});

	function isSelected(validNames)
	{
		for (var i = 0; i < validNames.length; i++)
		{
			if (validNames[i].length === 0)
				continue;
			if (checkFilterStrings(validNames[i], listboxInfo.selectedText))
				return true;
		}
		return false;
	}

	// XUL listboxes are buggy. It's not possible to dynamically create listitems and select them
	// in JavaScript. The listitems simply won't be selected ("blue") and it's not possible to
	// de-select them using the mouse/spacebar. The workaround is to create a listitem in XUL and
	// clone it.
	var listitem = document.getElementById("listitem");

	for (var i = 0; i < listboxInfo.listboxData.length; i++)
	{
		var item = listitem.cloneNode(false);
		item.setAttribute("label", listboxInfo.listboxData[i].displayName);
		item.setAttribute("value", i);
		if (!listboxInfo.multiSelect)
			item.addEventListener("dblclick", onDblClick, true);
		listbox.appendChild(item);

		if (isSelected(listboxInfo.listboxData[i].validNames))
			listbox.addItemToSelection(item);
	}
	listbox.removeChild(listitem);
}

// Called when the user double-clicks a listitem and !listboxInfo.multiSelect
function onDblClick(e)
{
	onDialogAccept();
	window.close();
}

function getSelectedString()
{
	var rv = "";

	for (var i = 0; i < listbox.selectedItems.length; i++)
	{
		var item = listbox.selectedItems[i];
		var index = parseInt(item.value, 10);
		var validNames = listboxInfo.listboxData[index].validNames;
		for (var j = 0; j < validNames.length; j++)
		{
			if (validNames[j].length === 0)
				continue;
			if (rv)
				rv += ", ";
			rv += validNames[j];
			break;
		}
	}

	return rv;
}

// Called when the user clicks OK or presses the Enter key
function onDialogAccept()
{
	try
	{
		listboxInfo.selectedText = getSelectedString();
	}
	catch (ex)
	{
		alert("Got an exception in onDialogAccept(): " + ex);
	}

	return true;
}

// Called when the user clicks Cancel or presses the ESC key
function onDialogCancel()
{
	return true;
}

// Should be the last statement in the file to indicate it loaded successfully
true;
