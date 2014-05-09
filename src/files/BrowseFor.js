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

// Returns the new value or null if none selected
function doBrowseForFolder(id, title)
{
	return doBrowseFor("modeGetFolder", id, title);
}

// Returns the new value or null if none selected
function doBrowseForFile(id, title)
{
	return doBrowseFor("modeOpen", id, title);
}

function doBrowseFor(typeName, id, title)
{
	try
	{
		netscape.security.PrivilegeManager.enablePrivilege("UniversalXPConnect");

		var textbox = document.getElementById(id);

		var picker = Components.classes["@mozilla.org/filepicker;1"].createInstance(Components.interfaces.nsIFilePicker);
		picker.init(window, title, picker[typeName]);

		try
		{
			var localFile = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
			localFile.initWithPath(textbox.value);

			if (localFile.isFile())
				localFile = localFile.parent;

			picker.displayDirectory = localFile;
		}
		catch (ex)
		{
			// Ignore NS_ERROR_FILE_UNRECOGNIZED_PATH errors
		}

		var rv = picker.show();
		if (rv === picker.returnOK)
			return textbox.value = picker.file.path;
	}
	catch (ex)
	{
		alert("Could not browse for file/folder. Error: " + ex);
	}

	return null;
}

// Should be the last statement in the file to indicate it loaded successfully
true;
