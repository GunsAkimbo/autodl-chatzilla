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

function SetElemOptions2(options)
{
	this.options = options;
	this.allDisabled = !options;
}

SetElemOptions2.prototype.getValue =
function(name1, name2, defaultValue)
{
	if (this.options && name1 && name2)
		var val = this.options[name1][name2];
	else if (this.options && name1)
		var val = this.options[name1];
	else
		var val = defaultValue;
	return val;
}

SetElemOptions2.prototype.setValue =
function(id, name1, name2)
{
	var val = this.getValue(name1, name2);
	var elem = document.getElementById(id);
	elem.value = val;
	elem.disabled = this.allDisabled;
}

SetElemOptions2.prototype.setCheck =
function(id, name1, name2)
{
	var val = !!this.getValue(name1, name2);
	var elem = document.getElementById(id);
	elem.checked = val;
	elem.disabled = this.allDisabled;
}

// Should be the last statement in the file to indicate it loaded successfully
true;
