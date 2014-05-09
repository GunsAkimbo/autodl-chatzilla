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

function plugin_openDialog(dialogInfo)
{
	if (!dialogInfo.window)
		dialogInfo.window = window;

	if (!dialogInfo.isModal && plugin.scope[dialogInfo.varName] && !plugin.scope[dialogInfo.varName].closed)
		plugin.scope[dialogInfo.varName].focus();
	else
	{
		var windowArgs = "dialog,dependent,resizable";
		if (dialogInfo.isModal)
			windowArgs += ",modal";
		windowArgs += ",screenx=" + dialogInfo.window.screenX + ",screeny=" + dialogInfo.window.screenY;

		var ww = Components.classes["@mozilla.org/embedcomp/window-watcher;1"].getService(Components.interfaces.nsIWindowWatcher);

		// We need to do this in case the window we're opening is modal. We can't add an onload
		// handler to a modal window since openDialog() doesn't return until the window is closed.
		ww.registerNotification(
		{
			observe: function(subject, topic, data)
			{
				if (topic === "domwindowopened")
				{
					ww.unregisterNotification(this);
					var win = subject.QueryInterface(Components.interfaces.nsIDOMWindow);

					win.addEventListener("DOMContentLoaded", function() { plugin_onDialogLoad(win, dialogInfo); }, false);
					if (!dialogInfo.isModal)
						plugin.scope[dialogInfo.varName] = win;
				}
			},
		});

		// Hijack one of ChatZilla's dialog boxes so we also get chrome:// privileges. Choose one
		// that has both an OK and a Cancel button.
		var src = "chrome://chatzilla/content/install-plugin/install-plugin.xul";
		dialogInfo.window.openDialog(src, "_blank", windowArgs);
	}
}

function plugin_onDialogLoad(dlg, dialogInfo)
{
	try
	{
		// Overwrite ChatZilla's doOK() function with one that always returns true so our code
		// can return true to close the dialog box.
		dlg.doOK = function() { return true; };
		dlg.doCancel = function() { return true; };
		// Make sure ChatZilla's code isn't called.
		dlg.onLoad = function() {};

		// Define some common funcs
		dlg.alert = function(msg, title) { return alert(msg, dlg, title || "IRC Auto Downloader") };
		dlg.confirm = function(msg, title) { return confirm(msg, dlg, title || "IRC Auto Downloader") };

		// Seems like we don't get the real dimensions of the new dialog box until it's completely
		// visible. Wait for the first resize event.
		dlg.addEventListener("resize", function()
		{
			dlg.removeEventListener("resize", arguments.callee, false);

			var win = dialogInfo.window;
			var newX = Math.max(0, win.screenX + (win.outerWidth - dlg.outerWidth)/2);
			var newY = Math.max(0, win.screenY + (win.outerHeight - dlg.outerHeight)/2);
			dlg.moveTo(newX, newY);
		}, false);

		// Find the <dialog> tag
		for (var i = 0; i < dlg.document.childNodes.length; i++)
		{
			var elem = dlg.document.childNodes[i];
			if (elem.nodeType === 1 && elem.nodeName === "dialog")
			{
				var dlgElem = elem;
				break;
			}
		}
		if (!dlgElem)
			throw "Could not find the <dialog> tag";

		// Remove all of its child nodes
		while (dlgElem.childNodes.length > 0)
		{
			var elem = dlgElem.childNodes[0];
			dlgElem.removeChild(elem);
		}

		// Open our XUL dialog file
		var file = plugin.fileCwd.clone();
		var ary = dialogInfo.xulFile.split("/");
		for (var i = 0; i < ary.length; i++)
			file.append(ary[i]);
		var doc = readXmlFile(file.path);
		if (!doc)
			throw "Could not parse XUL file " + file.path;

		var xulDialogElem = doc.getElementById("autodl");

		function copyAttrib(attrName)
		{
			var value = readAttribute(xulDialogElem, attrName) || "";
			dlgElem.setAttribute(attrName, value);
		}
		copyAttrib("id");
		copyAttrib("title");
		copyAttrib("width");
		copyAttrib("height");

		var loadThese = [];
		for (var i = 0; i < xulDialogElem.childNodes.length; i++)
		{
			var elem = xulDialogElem.childNodes[i];
			if (elem.nodeType !== 1)
				continue;
			if (elem.nodeName === "script")
			{
				var scriptName = readAttribute(elem, "src");
				if (scriptName)
					loadThese.push("files/" + scriptName);
				continue;
			}
			elem = plugin_cleanNode(elem);
			if (!elem)
				continue;
			dlgElem.appendChild(elem);
		}

		var scope = dlg;
		for (var i = 0; i < loadThese.length; i++)
		{
			if (!plugin.load(loadThese[i], scope))
				throw "Could not load '" + loadThese[i] + "'";
		}

		dlg.arguments = [ plugin, dialogInfo.arg1, dialogInfo.arg2 ];
		scope.onDlgLoad();
	}
	catch (ex)
	{
		window.alert("Could not open dialog box: " + ex, window, "ERROR");
	}
}

function plugin_cleanNode(node)
{
	switch (node.nodeType)
	{
	case 1:	// ELEMENT_NODE
		break;

	case 3:	// TEXT_NODE
		// Ignore empty text nodes because the <tabbox>, <button> (and more?) elements won't work
		// as expected otherwise
		if (!node.nodeValue.match(/[^\s\r\n]/m))
			node = null;
		break;

	case 8:	// COMMENT_NODE
	default:
		node = null;
		break;
	}
	if (!node)
		return null;

	for (var i = 0; i < node.childNodes.length; i++)
	{
		if (!plugin_cleanNode(node.childNodes[i]))
		{
			node.removeChild(node.childNodes[i]);
			i--;
		}
	}

	return node;
}

// Should be the last statement in the file to indicate it loaded successfully
true;
