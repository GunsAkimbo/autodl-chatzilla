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

// There should be a 1-1 relationship of ids & values.
function Menulist(id, idToValue)
{
	this.menulist = document.getElementById(id);
	this.idToValue = idToValue;
}

Menulist.prototype.getSelectedItem =
function()
{
	return this.menulist.selectedItem;
}

// Returns the value of the selected item using the idToValue object. undefined is returned
// if there's no item selected.
Menulist.prototype.getSelectedValue =
function()
{
	var menuitem = this.menulist.selectedItem;
	if (!menuitem)
		return undefined;
	return this.idToValue[menuitem.id];
}

Menulist.prototype.selectItemWithValue =
function(value)
{
	for (var id in this.idToValue)
	{
		if (this.idToValue[id] === value)
		{
			var menuitem = document.getElementById(id);
			this.menulist.selectedItem = menuitem;
			return;
		}
	}
}

Menulist.prototype.addCommandListener =
function(callback)
{
	this.menulist.addEventListener("command", callback, true);
}

Menulist.prototype.getSelectedIndex =
function()
{
	return this.menulist.selectedIndex;
}

// Should be the last statement in the file to indicate it loaded successfully
true;
