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

// directoryName is empty for single-file torrents (no files dictionary) but non-empty for
// multi-file torrents.
function TorrentFiles(directoryName)
{
	this.directoryName = directoryName;
	this.files = [];
	this.totalSize = 0;
}

TorrentFiles.prototype.addFile =
function(torrentFile)
{
	if (this.directoryName)
		torrentFile.relativePath = this.directoryName + "/" + torrentFile.relativePath;

	this.files.push(torrentFile);
	this.totalSize += torrentFile.fileSize;
}

function TorrentFile(relativePath, fileSize)
{
	this.relativePath = relativePath;
	this.fileSize = fileSize;
}

function getTorrentFiles(root)
{
	try
	{
		return tryGetTorrentFiles(root);
	}
	catch (ex)
	{
		message(0, "Caught an exception in getTorrentFiles(): " + formatException(ex), MT_ERROR);
		return null;
	}
}

function tryGetTorrentFiles(root)
{
	if (!root.isDictionary())
		return null;

	var info = root.readDictionary("info");
	if (!info || !info.isDictionary())
		return null;

	function getInteger(benc)
	{
		var size;
		if (!benc || !benc.isInteger() || isNaN(size = parseInt(benc.integer, 10)))
			throw "Invalid torrent file: expected an integer";
		return size;
	}
	function getString(benc)
	{
		if (!benc || !benc.isString())
			throw "Invalid torrent file: expected a string";
		return benc.string;
	}

	var files = info.readDictionary("files");
	if (files)
	{
		// multiple files torrent

		if (!files.isList())
			return null;

		var torrentFiles = new TorrentFiles(getString(info.readDictionary("name")));

		for (var i = 0; i < files.list.length; i++)
		{
			var dict = files.list[i];
			if (!dict.isDictionary())
				return null;

			var fileSize = getInteger(dict.readDictionary("length"));
			var bencPath = dict.readDictionary("path");
			if (!bencPath || !bencPath.isList())
				return null;
			var fileName = "";
			for (var j = 0; j < bencPath.list.length; j++)
			{
				if (fileName)
					fileName += "/";
				fileName += getString(bencPath.list[j]);
			}
			torrentFiles.addFile(new TorrentFile(fileName, fileSize));
		}
	}
	else
	{
		// single file torrent

		var torrentFiles = new TorrentFiles("");
		var fileName = getString(info.readDictionary("name"));
		var fileSize = getInteger(info.readDictionary("length"));
		torrentFiles.addFile(new TorrentFile(fileName, fileSize));
	}

	return torrentFiles;
}

// Should be the last statement in the file to indicate it loaded successfully
true;
