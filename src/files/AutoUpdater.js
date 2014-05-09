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

const updateXmlUrl = "http://autodl.sourceforge.net/update.xml";

function AutoUpdater()
{
	this.handler = null;
	this.request = null;
	this.requestStart = null;
}

// Returns true if we're checking for updates, or downloading something else
AutoUpdater.prototype.verifyCheckHasBeenCalled =
function()
{
	if (!this.autodl)
		throw "check() hasn't been called!\n";
}

AutoUpdater.prototype._isChecking =
function()
{
	return !!this.request;
}

// Called before starting a new HTTP request
AutoUpdater.prototype._requestStart =
function()
{
	this.startTime = newDate();
}

// Called after a HTTP request has completed
AutoUpdater.prototype._requestStop =
function()
{
	delete this.startTime;
}

// Returns number of seconds since start of request
AutoUpdater.prototype.getRequestTimeInSecs =
function()
{
	if (this.startTime === undefined)
		return 0;
	return (newDate() - this.startTime) / 1000;
}

// Notifies the handler, catching any exceptions. this.handler will be set to null.
AutoUpdater.prototype._notifyHandler =
function(errorMessage)
{
	try
	{
		var handler = this.handler;
		this._requestStop();
	
		// Clean up before calling the handler
		this.handler = null;
		this.request = null;

		if (handler !== undefined)
			handler(errorMessage);
		else
			message(0, "AutoUpdater::_notifyHandler: No handler!", MT_ERROR);
	}
	catch (ex)
	{
		message(0, "AutoUpdater::_notifyHandler: ex: " + formatException(ex), MT_ERROR);
	}
}

// Called when an error occurs. The handler is called with the error message.
AutoUpdater.prototype._error =
function(errorMessage)
{
	this._notifyHandler(errorMessage || "Unknown error");
}

// Cancel any downloads, and call the handler with an error message.
AutoUpdater.prototype.cancel =
function(errorMessage)
{
	errorMessage = errorMessage || "Cancelled!";
	if (!this._isChecking())
		return;

	if (this.request)
		this.request.cancel();

	this._error(errorMessage);
}

// Check for updates. handler(errorMessage) will be notified.
AutoUpdater.prototype.check =
function(handler)
{
	if (this._isChecking())
		throw "Already checking for updates\n";

	this.handler = handler || function() {};
	this.request = new HttpRequest();
	this.request.setFollowNewLocation();
	this._requestStart();
	var this_ = this;
	this.request.sendGetRequest(updateXmlUrl, {}, function(httpRequest, errorMessage)
	{
		this_._onRequestReceived(errorMessage);
	});
}

AutoUpdater.prototype._onRequestReceived =
function(errorMessage)
{
	try
	{
		if (errorMessage)
			return this._error("Error getting update info: " + errorMessage);

		var statusCode = this.request.getResponseStatusCode();
		if (statusCode !== 200)
			return this._error("Error getting update info: " + this.request.getResponseStatusText());

		var xmlData = this.request.getResponseData();
		var updateParser = new UpdaterXmlParser();
		updateParser.parse(xmlData);
		this.autodl = updateParser.autodl;
		this.trackers = updateParser.trackers;

		this._notifyHandler("");
	}
	catch (ex)
	{
		this._error("Could not parse update.xml: " + formatException(ex));
	}
}

// Download the trackers file and extract it to destDir. check() must've been called successfully.
AutoUpdater.prototype.updateTrackers =
function(destDir, handler)
{
	this.verifyCheckHasBeenCalled();
	if (this._isChecking())
		throw "Already checking for updates\n";

	this.handler = handler || function() {};
	this.request = new HttpRequest();
	this.request.setFollowNewLocation();
	this._requestStart();
	var this_ = this;
	this.request.sendGetRequest(this.trackers.url, {}, function(httpRequest, errorMessage)
	{
		this_._onDownloadedTrackersFile(errorMessage, destDir);
	});
}

AutoUpdater.prototype._onDownloadedTrackersFile =
function(errorMessage, destDir)
{
	try
	{
		if (errorMessage)
			return this._error("Error getting trackers file: " + errorMessage);

		var statusCode = this.request.getResponseStatusCode();
		if (statusCode !== 200)
			return this._error("Error getting trackers file: " + this.request.getResponseStatusText());

		this._extractZipFile(this.request.getResponseData(), destDir);

		this._notifyHandler("");
	}
	catch (ex)
	{
		this._error("Error downloading trackers file: " + formatException(ex));
	}
}

// Download the autodl file and extract it to destDir. check() must've been called successfully.
AutoUpdater.prototype.updateAutodl =
function(destDir, handler)
{
	this.verifyCheckHasBeenCalled();
	if (this._isChecking())
		throw "Already checking for updates\n";

	this.handler = handler || function() {};
	this.request = new HttpRequest();
	this.request.setFollowNewLocation();
	this._requestStart();
	var this_ = this;
	this.request.sendGetRequest(this.autodl.url, {}, function(httpRequest, errorMessage)
	{
		this_._onDownloadedAutodlFile(errorMessage, destDir);
	});
}

AutoUpdater.prototype._onDownloadedAutodlFile =
function(errorMessage, destDir)
{
	try
	{
		if (errorMessage)
			return this._error("Error getting autodl file: " + errorMessage);

		var statusCode = this.request.getResponseStatusCode();
		if (statusCode !== 200)
			return this._error("Error getting autodl file: " + this.request.getResponseStatusText());

		this._extractZipFile(this.request.getResponseData(), destDir);

		this._notifyHandler("");
	}
	catch (ex)
	{
		this._error("Error downloading autodl file: " + formatException(ex));
	}
}

AutoUpdater.prototype._extractZipFile =
function(zipData, destDir)
{
	try
	{
		var newFile = saveFileInternal(plugin.options.tempdir, "autodl-update.zip", zipData);
		var zipReader = Components.classes["@mozilla.org/libjar/zip-reader;1"].createInstance(Components.interfaces.nsIZipReader);
		message(5, "Opening downloaded ZIP file: " + newFile.path, MT_STATUS);
		zipReader.open(newFile);
		zipReader.test(null);

		var zipEnumerator = zipReader.findEntries("*");
		var zipFiles = [];
		while (zipEnumerator.hasMore())
			zipFiles.push(zipEnumerator.getNext());

		message(5, "Making sure we can create all files", MT_STATUS);
		this.verifyCanCreateFiles(destDir, zipFiles);
		message(5, "Extracting all files to disk", MT_STATUS);
		this.writeFiles(zipReader, destDir, zipFiles);
		message(5, "All updated files successfully extracted to disk", MT_STATUS);
	}
	finally
	{
		if (zipReader)
			zipReader.close();
		if (newFile && newFile.exists())
			newFile.remove(false);
	}
}

AutoUpdater.prototype.getFile =
function(baseFile, relPathName)
{
	var file = baseFile.clone();
	var ary = relPathName.split("/");
	for (var i = 0; i < ary.length; i++)
		file.append(ary[i]);
	return file;
}

AutoUpdater.prototype.verifyCanCreateFiles =
function(baseFile, zipFiles)
{
	for (var i = 0; i < zipFiles.length; i++)
	{
		var relPathName = zipFiles[i];
		var file = this.getFile(baseFile, relPathName);
		dmessage(5, "Verifying that '" + file.path + "' is writable", MT_INFO);
		if (relPathName[relPathName.length-1] === "/")
		{
			if (!createDirectory(file.path))
				throw "Could not create directory '" + file.path + "'";
		}
		else
		{
			if (!createDirectory(file.parent.path))
				throw "Could not create directory '" + file.parent.path + "'";
			try
			{
				var localFile = new LocalFile(file, MODE_WRONLY | MODE_CREATE);
				localFile.close();
			}
			catch (ex)
			{
				throw "File " + file.path + " is not writable!";
			}
		}
	}
}

function zipReaderExtractFile(zipReader, zipEntry, destFile)
{
	if (destFile.exists())
	{
		// For some unknown reason, extract() will set permissions to 0400!
		var oldPermissions = destFile.permissions;
		zipReader.extract(zipEntry, destFile);
		if (destFile.permissions !== oldPermissions)
			destFile.permissions = oldPermissions;
	}
	else
	{
		zipReader.extract(zipEntry, destFile);
		destFile.permissions = 0664;	// extract() sets perms to 0400!
	}
}

AutoUpdater.prototype.writeFiles =
function(zipReader, baseFile, zipFiles)
{
	for (var i = 0; i < zipFiles.length; i++)
	{
		var relPathName = zipFiles[i];
		var file = this.getFile(baseFile, relPathName);
		if (relPathName[relPathName.length-1] !== "/")
		{
			dmessage(5, "Extracting file '" + file.path + "'", MT_INFO);
			zipReaderExtractFile(zipReader, relPathName, file);
		}
	}
}

// Returns true if there's an autodl update available
AutoUpdater.prototype.hasAutodlUpdate =
function(version)
{
	this.verifyCheckHasBeenCalled();
	return this.autodl.version > version;
}

// Returns true if there's a trackers update available
AutoUpdater.prototype.hasTrackersUpdate =
function(version)
{
	this.verifyCheckHasBeenCalled();
	return this.getTrackersVersion() > version;
}

AutoUpdater.prototype.getTrackersVersion =
function()
{
	this.verifyCheckHasBeenCalled();
	return this.trackers.version;
}

// Returns true if we're sending a request
AutoUpdater.prototype.isSendingRequest =
function()
{
	return this._isChecking();
}

// Should be the last statement in the file to indicate it loaded successfully
true;
