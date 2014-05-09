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

function getDirectoryEntries(dir, func)
{
	var rv = [];

	var entries = dir.directoryEntries;
	while (entries.hasMoreElements())
	{
		var entry = entries.getNext().QueryInterface(Components.interfaces.nsIFile);
		if (func(entry))
			rv.push(entry);
	}

	return rv;
}

function getSortedDirectoryEntries(dir, func)
{
	return getDirectoryEntries(dir, func).sort(function(a, b)
	{
		return stringCompare(a.leafName.toLowerCase(), b.leafName.toLowerCase());
	});
}

function TrackerLogChecker()
{
	var basePath = plugin.fileCwd.clone();
	basePath = basePath.parent.parent;
	basePath.append("logs");
	this.basePath = basePath;
	if (!this.basePath.exists() || !this.basePath.isDirectory())
		message(0, "Couldn't find log directory. path used: '" + this.basePath.path + "'", MT_ERROR);
}

TrackerLogChecker.prototype.addError =
function()
{
	this.numErrors++;
	if (this.numErrors >= 20)
		throw "Too many errors found. Stopping.";
}

TrackerLogChecker.prototype.verifyAllTrackers =
function()
{
	for (var trackerType in plugin.trackers)
	{
		this.verifyTracker(trackerType);
	}
}

TrackerLogChecker.prototype.verifyTracker =
function(trackerType)
{
	this.numErrors = 0;
	this.numAnnounceLines = 0;

	var tracker = plugin.trackers[trackerType];
	if (!tracker)
	{
		message(0, "Could not find tracker with type: " + trackerType, MT_ERROR);
		return;
	}

	message(3, "Verifying tracker " + tracker.longName + " (" + tracker.type + ")", MT_STATUS);

	try
	{
		// Gets a little slow if this function is called so disable it
		var oldExtractReleaseNameInfo = extractReleaseNameInfo;
		extractReleaseNameInfo = function() {}

		for (var i = 0; i < tracker.servers.length; i++)
		{
			var server = tracker.servers[i];

			this.verifyChannel(tracker, server);
		}
	}
	catch (ex)
	{
		message(0, "Tracker: " + tracker.longName + ": Got an exception: " + formatException(ex), MT_ERROR);
	}
	finally
	{
		if (oldExtractReleaseNameInfo)
			extractReleaseNameInfo = oldExtractReleaseNameInfo;
	}

	if (this.numErrors > 0)
		message(0, "Done; ERRORS: " + this.numErrors + "; Checked " + this.numAnnounceLines + " lines; tracker " + tracker.longName + " (" + tracker.type + ")", MT_ERROR);
	else
		message(3, "Done; No errors; Checked " + this.numAnnounceLines + " lines; tracker " + tracker.longName + " (" + tracker.type + ")", MT_STATUS);

	newDate = newDate_orig;	// Restore func
}

TrackerLogChecker.prototype.verifyChannel =
function(tracker, server)
{
	function isChannelFileName(filename)
	{
		filename = filename.toLowerCase();

		var channelNames = server.channelNames.split(",");
		for (var i = 0; i < channelNames.length; i++)
		{
			var name = stringTrim(channelNames[i]).toLowerCase();
			if (name.length === 0)
				continue;
			if (filename.indexOf(name + ".") === 0)
				return true;
		}
		return false;
	}

	var entries = getSortedDirectoryEntries(this.basePath, function(entry)
	{
		return entry.isDirectory() && entry.leafName.toLowerCase().indexOf(server.serverName.toLowerCase()) === 0;
	});
	for (var i = 0; i < entries.length; i++)
	{
		var dir = entries[i];
		message(4, "Checking directory " + dir.path, MT_STATUS);

		dir.append("channels");

		if (!dir.exists() || !dir.isDirectory())
		{
			message(3, "No channels directory: " + dir.path, MT_STATUS);
			continue;
		}

		var entries2 = getSortedDirectoryEntries(dir, function(entry)
		{
			return entry.isFile() && isChannelFileName(entry.leafName);
		});
		for (var j = 0; j < entries2.length; j++)
		{
			var file = entries2[j];
			message(4, "Checking file " + file.path, MT_STATUS);
			this.verifyFile(tracker, server, file);
		}
	}
}

TrackerLogChecker.prototype.verifyFile =
function(tracker, server, file)
{
	localFile = new LocalFile(file, "<");
	var str = localFile.read(0x7FFFFFFF);
	localFile.close();
//	str = toUtf8(str);

	for (var start = 0; start < str.length; start = eol)
	{
		var eol = str.indexOf("\n", start);
		if (eol === -1)
			eol = str.length + 1;
		else
			eol++;
		var length = eol - start - 1;
		if (length === 0)
			continue;

		if (str[start + length - 1] === "\r")
			length--;
		var line = str.substr(start, length);

		var ary = line.match(/^\[([^\]]*)\] <([^>]*)> (.*)/);
		if (!ary)
			continue;

		var date = ary[1];
		var user = ary[2];
		if (!checkFilterStrings(user, server.announcerNames))
			continue;
		var userLine = stripMircColorCodes(ary[3]);

		var ary = date.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/)
		if (!ary)
			throw "Could not parse date: '" + date + "'";
		var year = parseInt(ary[1], 10);
		var month = parseInt(ary[2], 10);
		var day = parseInt(ary[3], 10);
		var hours = parseInt(ary[4], 10);
		var minutes = parseInt(ary[5], 10);
		var seconds = parseInt(ary[6], 10);
		newDate = function(arg)
		{
			return new Date(year, month, day, hours, minutes, seconds, 0);
		};

		this.numAnnounceLines++;
		var ti = parseAnnounceLine(tracker, userLine);
		newDate = newDate_orig;
		if (ti === false)
			this.addError();
	}
}

// Should be the last statement in the file to indicate it loaded successfully
true;
