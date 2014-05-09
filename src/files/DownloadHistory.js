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

function Utf8LocalFile(filename, openMode)
{
	this.file = new LocalFile(filename, openMode);

	var encoding = "UTF-8";
	if (this.file.outputStream)
	{
		this.os = Components.classes["@mozilla.org/intl/converter-output-stream;1"].createInstance(Components.interfaces.nsIConverterOutputStream);
		this.os.init(this.file.outputStream, encoding, 0, 0);
	}

	if (this.file.baseInputStream)
	{
		const replacementChar = Components.interfaces.nsIConverterInputStream.DEFAULT_REPLACEMENT_CHARACTER;
		this.is = Components.classes["@mozilla.org/intl/converter-input-stream;1"].createInstance(Components.interfaces.nsIConverterInputStream);
		this.is.init(this.file.baseInputStream, encoding, 0, replacementChar);
	}
}

Utf8LocalFile.prototype.read =
function(size)
{
	var s = "";

	while (size > 0)
	{
		var o = {};
		var num = this.is.readString(size, o);
		if (num == 0)
			break;
		size -= num;
		s += o.value;
	}

	return s;
}

Utf8LocalFile.prototype.write =
function(s)
{
	this.os.writeString(s);
}

Utf8LocalFile.prototype.close =
function()
{
	if (this.os)
		this.os.close();
	if (this.is)
		this.is.close();
	this.file.close();
}

function DownloadHistory()
{
	this.downloaded = {};
}

function canonicalizeReleaseName(releaseName)
{
	var rv = releaseName;
	rv = rv.match(/^(.*?)(?:\.avi|\.mkv|\.mpg|\.mpeg|\.wmv|\.ts)?$/i)[1];
	// Replace all non alpha numerics < 0x80 with spaces
	rv = rv.replace(/[\x00-\x1F\x21-\x2F\x3A-\x40\x5B-\x60\x7B-\x7F]+/g, " ");
	rv = rv.replace(/\s+/g, " ");
	rv = stringTrim(rv).toLowerCase();
	rv = "OTHER-" + rv;
	return rv;
}

DownloadHistory.prototype.hasDownloaded =
function(ti)
{
	return this.downloaded[ti.canonicalizedName];
}

// Returns true if we can download the release
DownloadHistory.prototype.canDownload =
function(ti)
{
	return !this.hasDownloaded(ti) || plugin.options.downloadDupeReleases;
}

DownloadHistory.prototype.addDownload =
function(ti, torrentUrl)
{
	var release =
	{
		releaseName: ti.torrentName,
		time: newDate(),
		torrentUrl: torrentUrl,
		size: ti.torrentSizeInBytes,
		canonicalizedName: ti.canonicalizedName,
	};
	this.downloaded[ti.canonicalizedName] = release;
	this.saveReleaseToHistoryFile(release);
}

DownloadHistory.prototype.saveReleaseToHistoryFile =
function(release)
{
	if (!plugin.options.saveDownloadHistory)
		return;

	var file;
	try
	{
		file = new Utf8LocalFile(this.getHistoryFile(), ">>");
		this.writeReleaseToFile(file, release);
	}
	catch (ex)
	{
		message(0, "Could not write to download history file: " + formatException(ex), MT_ERROR);
	}
	finally
	{
		if (file)
			file.close();
	}
}

// Writes the release to the file
DownloadHistory.prototype.writeReleaseToFile =
function(file, release)
{
	if (plugin.options.saveDownloadHistory)
	{
		var msg = release.releaseName.replace(/\t/g, " ");
		msg += "\t" + release.time.getTime();
		msg += "\t" + release.torrentUrl;
		msg += "\t" + (release.size === null ? "" : release.size);
		msg += "\t" + release.canonicalizedName;
		file.write(msg + "\n");
	}
}

// Read the download history file into this, overwriting any added releases
DownloadHistory.prototype.loadHistoryFile =
function()
{
	if (!plugin.options.saveDownloadHistory)
		return;

	try
	{
		this.tryLoadFromHistoryFile();
	}
	catch (ex)
	{
		if (ex.name !== "NS_ERROR_FILE_NOT_FOUND")
			message(0, "Could not read from download history file: " + formatException(ex), MT_ERROR);
	}
}

DownloadHistory.prototype.tryLoadFromHistoryFile =
function()
{
	var history = {};

	var file = new Utf8LocalFile(this.getHistoryFile(), "<");
	var text = file.read(0x7FFFFFFF);
	file.close();

	if (!text)
		return;

	file = new Utf8LocalFile(this.getHistoryFile(), ">");

	var lines = text.split("\n");
	if (lines[lines.length-1].length === 0)
		lines.length--;
	var numLoaded = 0;
	var startIndex = lines.length <= plugin.options.maxSavedReleases ? 0 : lines.length - plugin.options.maxSavedReleases;
	for (var i = startIndex; i < lines.length; i++)
	{
		if (lines[i].length === 0)
			continue;
		var ary = lines[i].split("\t");
		if (ary.length < 4)
		{
			dmessage(0, "Invalid line in DownloadHistory.txt: '" + lines[i] + "'", MT_ERROR);
			continue;
		}

		var release =
		{
			releaseName: ary[0],
			time: newDate(parseInt(ary[1], 10)),
			torrentUrl: ary[2],
			size: ary[3].length === 0 ? null : parseInt(ary[3], 10),
			canonicalizedName: ary[4] || canonicalizeReleaseName(ary[0]),
		};
		if (USE_OLD_CANONICALIZED_RELEASENAME || !release.canonicalizedName)
			release.canonicalizedName = canonicalizeReleaseName(release.releaseName);

		numLoaded++;
		history[release.canonicalizedName] = release;
		this.writeReleaseToFile(file, release);
	}
	file.close();
	this.downloaded = history;
	message(3, "Loaded \x02" + numLoaded + "\x02 release" + (numLoaded === 1 ? "" : "s") + " from history file.", MT_STATUS);
}

DownloadHistory.prototype.getHistoryFile =
function()
{
	var file = plugin.fileCwd.clone();
	file.append(plugin.settingsDirectory);
	createDirectory(file);
	file.append("DownloadHistory.txt");
	return file;
}

// Should be the last statement in the file to indicate it loaded successfully
true;
