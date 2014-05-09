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

function cloneObj(obj)
{
	var rv = {};
	for (var prop in obj)
		rv[prop] = obj[prop];
	return rv;
}

// In order to work around a XUL listbox bug, the XUL listbox must contain an empty listitem.
function MyListBox(listboxId)
{
	var this_ = this;

	this.listbox = document.getElementById(listboxId);
	this.listitem = this.listbox.firstChild;
	if (!this.listitem || this.listitem.nodeType !== 1 || this.listitem.nodeName !== "listitem")
		throw "MyListBox(): first child must be a listitem";
	this.listbox.removeChild(this.listitem);

	this.userObjAry = [];
	this.currentUserObj = null;

	this.listbox.addEventListener("select", function(e) { this_.onSelect(); }, true);
}

// Called whenever a new listitem is selected
MyListBox.prototype.onSelect =
function()
{
	var oldUserObj = this.currentUserObj;
	this.currentUserObj = this.getActiveUserObj();
	this.userObjSelected(this.currentUserObj, oldUserObj);
}

MyListBox.prototype.userObjSelected =
function(newUserObj, oldUserObj)
{
	// Nothing. You override this method
}

MyListBox.prototype.createListitem =
function(label, value)
{
	var listitem = this.listitem.cloneNode(false);
	listitem.setAttribute("label", label);
	listitem.setAttribute("value", value);
	return listitem;
}

// Appends a new item to the listbox and associates it with userObj
MyListBox.prototype.appendUserObj =
function(userObj, name)
{
	userObj = cloneObj(userObj);

	var listitem = this.createListitem("", "");
	userObj.$obj = { listitem: listitem, name: "" };
	this.listbox.appendChild(listitem);
	this.userObjAry.push(userObj);
	this.setUserObjName(userObj, name);

	if (this.userObjAry.length === 1)
		this.makeUserObjActive(userObj);

	return userObj;
}

MyListBox.prototype.removeUserObj =
function(userObj)
{
	if (!userObj)
		return null;

	var listitem = userObj.$obj.listitem;
	var index = this.listbox.getIndexOfItem(listitem);
	this.listbox.removeChild(listitem);
	this.userObjAry.splice(index, 1);

	// Make another one active
	if (this.userObjAry.length > 0)
	{
		var newActiveIndex = Math.min(index, this.userObjAry.length-1);
		this.makeUserObjActive(this.userObjAry[newActiveIndex])
	}

	return userObj;
}

// Set a new name for this userObj
MyListBox.prototype.setUserObjName =
function(userObj, name)
{
	if (!userObj)
		return;

	userObj.$obj.name = name;
	var listitem = userObj.$obj.listitem;
	listitem.setAttribute("label", name || "<no-name>");
}

// Make this userObj active
MyListBox.prototype.makeUserObjActive =
function(userObj)
{
	if (!userObj)
		return;

	var listitem = userObj.$obj.listitem;
	this.listbox.ensureElementIsVisible(listitem);
	this.listbox.selectItem(listitem);
}

// Returns the active userObj or null if none is selected
MyListBox.prototype.getActiveUserObj =
function()
{
	var index = this.listbox.selectedIndex;
	return this.userObjAry[index] || null;
}

// Returns the userObj array without any extra properties used by us. This method should only
// be called when the dialog box is closing since the userObjArray we return is used internally
// by this class.
MyListBox.prototype.getCleanUserObjArray =
function()
{
	this.listbox.selectedIndex = -1;
	for (var i = 0; i < this.userObjAry.length; i++)
	{
		delete this.userObjAry[i].$obj;
	}
	return this.userObjAry;
}

MyListBox.prototype.getListitem =
function(userObj)
{
	if (!userObj)
		return null;

	return userObj.$obj.listitem;
}

// Should be the last statement in the file to indicate it loaded successfully
true;
