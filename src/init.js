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

// ChatZilla plugin variables
plugin.id = "autodl";
plugin.major = 2;
plugin.minor = 12;//NB: DON'T FORGET VERSION NUMBER IN setup/setup.iss
plugin.description = "Auto downloads torrents from IRC";

// Needed by message() which is used by the init code
plugin.options = { level: 3 };

function intToVersion(i)
{
	var major = Math.floor(i / 100);
	var minor = Math.floor(i % 100);
	return major + "." + ("0" + minor).slice(-2)
}

// Called by ChatZilla to initialize the plugin
plugin.init =
function(glob)
{
	this.version = intToVersion(this.major * 100 + this.minor);

	var ioService = Components.classes['@mozilla.org/network/io-service;1'].getService(Components.interfaces.nsIIOService);
	var fileHandler = ioService.getProtocolHandler("file").QueryInterface(Components.interfaces.nsIFileProtocolHandler);
	this.fileCwd = fileHandler.getFileFromURLSpec(this.cwd).QueryInterface(Components.interfaces.nsILocalFile);

	message(3, "Initializing \x02\x0304" + this.id + "\x03 \x0302v" + this.version + "\x03\x02", MT_STATUS);
	message(3, "Get latest version from http://sourceforge.net/projects/autodl/", MT_STATUS);
	message(3, "\x0304\x02Help forum\x02\x03 http://sourceforge.net/apps/phpbb/autodl/", MT_STATUS);

	var files =
	[
		"files/Constants.js",
		"files/init2.js",
		"files/announcerParsers.js",
		"files/DownloadHistory.js",
		"files/Bencoding.js",
		"files/MySocket.js",
		"files/HttpRequest.js",
		"files/Utils.js",
		"files/Settings.js",
		"files/IrcHandler.js",
		"files/Webui.js",
		"files/TorrentDownloader.js",
		"files/BitTorrent.js",
		"files/FtpUploader.js",
		"files/Exec.js",
		"files/MacroReplacer.js",
		"files/TrackerXmlReader.js",
		"files/TrackerLogChecker.js",
		"files/AutoUpdater.js",
		"files/OpenDialog.js",
		"files/FilterConstants.js",
		"files/ScriptParser.js",
		"files/ScriptExec.js",
		"files/DiskIoQueue.js",
		"files/ScriptExecQueue.js",
		"files/UserTorrents.js",
		"files/DownloadedScriptExecQueue.js",
		"files/UtorrentTorrentManager.js",
		"files/UpdaterXmlParser.js",
	];
	for (var i = 0; i < files.length; i++)
	{
		if (!this.load(files[i], this.scope))
		{
			var msg = "Could not load JavaScript file '" + files[i] + "'";
			message(0, msg, MT_ERROR);
			throw msg;
		}
	}

	return true;
}

// level:
// 0 = errors
// 1 = warnings
// 3 = normal status messages
// 4 = debug/status messages
// 5 = more detailed debug messages
function message(level, msg, type)
{
	if (level <= plugin.options.level)
		client.display(msg, type);
}

function dmessage(level, msg, type)
{
	if (plugin.options.debug)
		message(level, msg, type);
}

// Load a JavaScript file relative to the current directory. filename is a file:// relative
// path, usually just a filename.
plugin.load =
function(filename, scope)
{
	try
	{
		var rv = client.load(this.cwd + filename, scope);
	}
	catch (ex)
	{
		message(0, "Could not load JavaScript files, exception: " + formatException(ex), MT_ERROR);
		return false;
	}

	return rv === true;
}

// Will get overwritten by init2.js. They're here so ChatZilla won't complain.
plugin.enable = function() {}
plugin.disable = function() {}
