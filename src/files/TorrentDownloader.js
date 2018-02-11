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

// Returns true if it's Windows
function isWindows()
{
	return client.platform.toLowerCase() === "windows";
}

function getWindowsPath(pathName)
{
	if (isWindows())
		return pathName;
	return _wine_getWindowsPath(pathName);
}

// Converts unixPath to a Windows path
function _wine_getWindowsPath(unixPath)
{
	const WINE_ROOT_DRIVE = "Z:";

	if (unixPath[0] !== "/")
		throw "Not an absolute path: " + unixPath;

	unixPath = unixPath.replace(/\//g, "\\");
	return WINE_ROOT_DRIVE + unixPath;
}

plugin.downloadTorrent =
function(ti, filename, forceHttps)
{
	if (!this.downloadHistory.canDownload(ti))
	{
		this.releaseAlreadyDownloaded(ti);
		return;
	}

	message(3, "Matched " + this.getTorrentInfoString(ti), MT_STATUS);

	var filedownload = new HttpRequest();
	if (ti.tracker.follow302)
		filedownload.setFollowNewLocation();
	filedownload.ti = ti;
	// Add tracker type to the torrent name so it's possible to download the same torrent from
	// different trackers at the same time without overwriting the previous torrent file of the
	// exact same release name.
	filedownload.filename = convertToValidPathName(ti.tracker.type + "-" + filename);
	filedownload.startTime = newDate();
	filedownload.downloadUrl = forceHttps ? filedownload.ti.torrentSslUrl : filedownload.ti.torrentUrl;
	
	if (filedownload.ti.uploadMethod.type == UPLOAD_SONARR || filedownload.ti.uploadMethod.type == UPLOAD_RADARR)
	{
		this.onTorrentUploadWait(filedownload);
	}
	else
	{
		message(3, "Downloading torrent for some reason", MT_STATUS);
		filedownload.sendGetRequest(filedownload.downloadUrl, ti.httpHeaders, this.getHandler_onTorrentDownloaded());
	}
}

plugin.getHandler_onTorrentDownloaded =
function()
{
	var this_ = this;
	return function(filedownload, errorMessage)
	{
		return this_.onTorrentDownloaded(filedownload, errorMessage);
	};
}

// Called when a torrent file has been downloaded
plugin.onTorrentDownloaded =
function(filedownload, errorMessage)
{
	if (!this.downloadHistory.canDownload(filedownload.ti))
	{
		this.releaseAlreadyDownloaded(filedownload.ti);
		return;
	}
	if (errorMessage != null)
	{
		message(0, "Error downloading torrent file " + filedownload.downloadUrl + ", error: " + errorMessage, MT_ERROR);
		return;
	}

	if (filedownload.response.statusCode[0] === "3")
	{
		message(0, "Got HTTP " + filedownload.response.statusCode + ", check your cookie settings! url: " + filedownload.url, MT_ERROR);
		return;
	}
	if (filedownload.response.statusCode !== "200")
	{
		filedownload.retryRequest("HTTP error '" + filedownload.response.status + "'", this.getHandler_onTorrentDownloaded());
		return;
	}

	filedownload.torrentFileData = filedownload.response.content;
	filedownload.bencRoot = parseBencodedString(filedownload.torrentFileData);
	if (!filedownload.bencRoot)
	{
		filedownload.retryRequest("Invalid torrent file, first bytes: '" + filedownload.torrentFileData.substr(0, 50) + "'", this.getHandler_onTorrentDownloaded());
		return;
	}

	var benc_info = filedownload.bencRoot.readDictionary("info");
	if (!benc_info || !benc_info.isDictionary())
	{
		filedownload.retryRequest("Invalid torrent file: missing info dictionary", this.getHandler_onTorrentDownloaded());
		return;
	}

	filedownload.info_hash = getSha1Hash(filedownload.torrentFileData.substr(benc_info.start, benc_info.end - benc_info.start));

	filedownload.torrentFiles = getTorrentFiles(filedownload.bencRoot);
	if (!filedownload.torrentFiles)
	{
		message(0, "Could not parse torrent file '" + filedownload.ti.torrentName + "'", MT_ERROR);
		return;
	}
	filedownload.ti.torrentSizeInBytes = filedownload.torrentFiles.totalSize;

	if (!this.checkFilterSize(filedownload.ti.torrentSizeInBytes, filedownload.ti.filter))
	{
		var msg = "Torrent ";
		msg += this.getTorrentInfoString({
			torrentName: filedownload.ti.torrentName,
			tracker: filedownload.ti.tracker,
		});
		msg += " is too big/small, size: \x02" + convertToByteSizeString(filedownload.ti.torrentSizeInBytes) + "\x02. Not downloaded.";
		message(3, msg, MT_STATUS);
		return;
	}
	filedownload.ti.torrentSize = convertToByteSizeString(filedownload.ti.torrentSizeInBytes);

	this.onTorrentUploadWait(filedownload);
}

plugin.onTorrentUploadWait =
function(filedownload)
{
	var uploadDelaySecs = readTrackerOption(filedownload.ti.tracker, "uploadDelaySecs");
	if (!uploadDelaySecs)
	{
		this.onTorrentFileDownloaded(filedownload);
	}
	else
	{
		var msg = "Waiting " + uploadDelaySecs + " seconds. Torrent ";
		msg += this.getTorrentInfoString({
			torrentName: filedownload.ti.torrentName,
			tracker: filedownload.ti.tracker,
		});
		message(3, msg, MT_STATUS);

		var this_ = this;
		setTimeout(function()
		{
			this_.onTorrentFileDownloaded(filedownload);
		}, uploadDelaySecs * 1000);
	}
}

// Called when the torrent file has been successfully downloaded
plugin.onTorrentFileDownloaded =
function(filedownload)
{
	switch (filedownload.ti.uploadMethod.type)
	{
	case UPLOAD_WATCH_FOLDER:	return this.saveTorrentFile(filedownload); break;
	case UPLOAD_WEBUI:			return this.sendTorrentFileWebui(filedownload); break;
	case UPLOAD_FTP:			return this.sendTorrentFileFtp(filedownload); break;
	case UPLOAD_TOOL:			return this.runProgram(filedownload); break;
	case UPLOAD_UTORRENT_DIR:	return this.runUtorrentDir(filedownload); break;
	case UPLOAD_SONARR:			return this.announceSonarr(filedownload,false);break;
	case UPLOAD_RADARR:			return this.announceSonarr(filedownload,true);break;
	default:					message(0, "Upload type not implemented, type: " + filedownload.ti.uploadMethod.type); break;
	}
}

plugin.getMacroReplacer =
function(ti, torrentPathName, info_hash)
{
	var macroReplacer = new MacroReplacer();
	macroReplacer.addTorrentInfo(ti);
	macroReplacer.addTimes();
	if (torrentPathName)
	{
		macroReplacer.add("TorrentPathName", torrentPathName);
		macroReplacer.add("WinTorrentPathName", getWindowsPath(torrentPathName));
	}
	if (info_hash)
		macroReplacer.add("InfoHash", toHexString(info_hash).toUpperCase());
	return macroReplacer;
}

plugin.addDownload =
function(filedownload)
{
	this.downloadHistory.addDownload(filedownload.ti, filedownload.downloadUrl);
}

plugin.runUtorrentDir =
function(filedownload)
{
	if (!this.downloadHistory.canDownload(filedownload.ti))
	{
		this.releaseAlreadyDownloaded(filedownload.ti);
		return;
	}

	try
	{
		var torrentFile = saveFileInternal(this.options.tempdir, filedownload.filename, filedownload.torrentFileData);
		this.addFileToBeDeleted(torrentFile);
		var macroReplacer = this.getMacroReplacer(filedownload.ti, torrentFile.path, filedownload.info_hash);

		var destDir = filedownload.ti.uploadMethod.dynamicDir.basedir;
		if (isWindows())
			destDir = destDir.replace(/\//g, "\\");
		else
			destDir = _wine_getWindowsPath(destDir);
		if (!destDir.match(/^[a-zA-Z]:/))
			throw "Base folder must be an absolute path!";

		var ary = filedownload.ti.uploadMethod.dynamicDir.dyndir.replace(/\//g, "\\").split("\\");
		for (var i = 0; i < ary.length; i++)
		{
			var dirName = stringTrim(macroReplacer.replace(ary[i]));
			if (!dirName)
				continue;
			if (destDir[destDir.length-1] !== "\\")
				destDir += "\\";
			destDir += convertToValidPathName(dirName);
		}

		var command = this.options.pathToUtorrent;
		if (command === "")
		{
			message(0, "Set utorrent.exe path in Preferences -> Programs.", MT_ERROR);
			return;
		}

		var torrentPathWin = macroReplacer.replace('$(WinTorrentPathName)');
		var args = '/directory "' + destDir + '" "' + torrentPathWin + '"';
		filedownload.ti.torrentDataPath = destDir;

		if (!isWindows())
		{
			filedownload.ti.torrentDataPath = destDir.substr(2).replace(/\\/g, "/");
			args = '"' + command + '" ' + args;
			command = '/usr/bin/wine';
		}

		if (!Exec({ program: command, arguments: args }))
		{
			message(0, "Could not execute '" + command + "', args: '" + args + "'", MT_ERROR);
			return;
		}

		this.addDownload(filedownload);
		this.onTorrentFileUploaded(filedownload, "Added torrent to '" + destDir + "'");
	}
	catch (ex)
	{
		message(0, "Could not start uTorrent, torrent '" + filedownload.ti.torrentName + "', error: " + formatException(ex), MT_ERROR);
	}
}

plugin.runProgram =
function(filedownload)
{
	if (!this.downloadHistory.canDownload(filedownload.ti))
	{
		this.releaseAlreadyDownloaded(filedownload.ti);
		return;
	}

	try
	{
		var torrentFile = saveFileInternal(this.options.tempdir, filedownload.filename, filedownload.torrentFileData);
		this.addFileToBeDeleted(torrentFile);

		var macroReplacer = this.getMacroReplacer(filedownload.ti, torrentFile.path, filedownload.info_hash);
		var command = macroReplacer.replace(filedownload.ti.uploadMethod.tool.command);
		var args = macroReplacer.replace(filedownload.ti.uploadMethod.tool.args);

		if (!Exec({ program: command, arguments: args }))
		{
			message(0, "Could not execute '" + command + "', args: '" + args + "'", MT_ERROR);
			return;
		}

		this.addDownload(filedownload);
		this.onTorrentFileUploaded(filedownload, "Started command: '" + command + "', args: '" + args + "'");
	}
	catch (ex)
	{
		message(0, "Could not start program, torrent '" + filedownload.ti.torrentName + "', error: " + formatException(ex), MT_ERROR);
	}
}

plugin.sendTorrentFileFtp =
function(filedownload)
{
	if (!this.downloadHistory.canDownload(filedownload.ti))
	{
		this.releaseAlreadyDownloaded(filedownload.ti);
		return;
	}

	try
	{
		this.addDownload(filedownload);

		message(4, "Torrent '" + filedownload.ti.torrentName + "' (" + filedownload.ti.tracker.longName + "): Starting ftp upload.", MT_STATUS);

		// Some programs may read the torrent before we've had the chance to upload all of it, so upload
		// it with a non ".torrent" extension, and later rename it when all of the file has been uploaded.
		var tempName = filedownload.filename + "1";

		var this_ = this;
		var ftpClient = new FtpClient();
		ftpClient.addConnect(this.options.ftp);
		ftpClient.addChangeDirectory(filedownload.ti.uploadMethod.ftp.path);
		ftpClient.addSendFile(tempName, function(ctx)
		{
			if (ctx.sizeLeft === 0)
				return "";
			ctx.sizeLeft = 0;
			return ctx.torrentFileData;
		}, { torrentFileData: filedownload.torrentFileData, sizeLeft: filedownload.torrentFileData.length });
		ftpClient.addRename(tempName, filedownload.filename);
		ftpClient.addQuit();
		ftpClient.sendCommands(function(errMessage) { return this_.onFtpUploadComplete(errMessage, filedownload); });
	}
	catch (ex)
	{
		message(0, "Could not upload '" + filedownload.ti.torrentName + "' to ftp; error: " + formatException(ex), MT_ERROR);
	}
}

// Called when the FTP upload has completed
plugin.onFtpUploadComplete =
function(errorString, filedownload)
{
	if (errorString)
	{
		message(0, "Could not upload '" + filedownload.ti.torrentName + "' to ftp: error: " + errorString, MT_ERROR);
		return;
	}

	this.onTorrentFileUploaded(filedownload, "Uploaded torrent (ftp)");
}

// Upload torrent file to uTorrent (webui)
plugin.sendTorrentFileWebui =
function(filedownload)
{
	if (!this.downloadHistory.canDownload(filedownload.ti))
	{
		this.releaseAlreadyDownloaded(filedownload.ti);
		return;
	}

	try
	{
		this.addDownload(filedownload);

		message(4, "Torrent '" + filedownload.ti.torrentName + "' (" + filedownload.ti.tracker.longName + "): Starting webui upload.", MT_STATUS);

		var this_ = this;
		var webui = new UtorrentWebui(this.options.webui);
		webui.addSendTorrentCommand(filedownload.torrentFileData, filedownload.filename);
		webui.addGetSettingsCommand();
		webui.sendCommands(function(errorMessage, commandResults) { return this_.onWebuiUploadComplete(errorMessage, commandResults, filedownload); });
	}
	catch (ex)
	{
		message(0, "Could not send '" + filedownload.ti.torrentName + "' to webui; error: " + formatException(ex), MT_ERROR);
	}
}

// Called when the webui upload has completed
plugin.onWebuiUploadComplete =
function(errorMessage, commandResults, filedownload)
{
	if (errorMessage)
	{
		message(0, "Could not send '" + filedownload.ti.torrentName + "' to uTorrent (webui): error: " + errorMessage, MT_ERROR);
		return;
	}
	if (commandResults[0].json.error)
	{
		message(0, "Error adding torrent: " + commandResults[0].json.error, MT_ERROR);
		return;
	}

	function convertUtorrentSettings(json)
	{
		var rv = {};

		var settings;
		if (!json || !(settings = json.settings) || !(settings instanceof Array))
			return rv;

		for (var i = 0; i < settings.length; i++)
		{
			var ary = settings[i];
			if (!(ary instanceof Array) || ary.length < 3 || typeof ary[0] !== "string" || typeof ary[2] !== "string")
				return rv;

			var val;
			switch (ary[1])
			{
			case 0: val = parseInt(ary[2], 16); break;
			case 1: val = ary[2] !== "false"; break;
			case 2: val = ary[2]; break;
			default: return rv;
			}
			rv[ary[0]] = val;
		}

		return rv;
	}

	var settings = convertUtorrentSettings(commandResults[1].json);
	if (settings.dir_active_download_flag === true && settings.dir_active_download)
		filedownload.ti.torrentDataPath = settings.dir_active_download;

	this.onTorrentFileUploaded(filedownload, "Uploaded torrent (webui)");
}

//Send post requests for Sonarr/Radarr
plugin.post = 
function(path, apikey, params,)
{
	var json_params = JSON.stringify(params);
	var this_ = this;
	var request = new XMLHttpRequest();
	request.onreadystatechange= function () {
		if (request.readyState==4 && request.status == 200) {
			try
			{
				this_.onPostResponse(JSON.parse(request.responseText));
			}
			catch (ex)
			{
				message(0, "JSON parse error: " + formatException(ex), MT_ERROR);
			}

		}
	}
	request.open("POST", path, true);
	request.setRequestHeader("X-Api-Key", apikey);
	request.setRequestHeader("Content-Type","application/json");
	request.send(json_params);
}

plugin.onPostResponse = 
function(response)
{
	if (response.approved)
	{
		message(3, "APPROVED: " + response.title ,MT_STATUS);
	}
	else
	{
		message(4, "DENIED: " + response.toSource(), MT_STATUS);
	}
}

//Try to build a scene-esque release name for trackers that don't utilize scene naming
plugin.sceneStringBuilder =
function(filedownload)
{	
	var alt_release_name = ""
	if(filedownload.ti.name1)
	{
		alt_release_name = filedownload.ti.name1.replace(/ /g,".");
	}
	if(filedownload.ti.year)
	{
		alt_release_name = alt_release_name + "." + filedownload.ti.year;
	}
	if(filedownload.ti.season)
	{
		alt_release_name = alt_release_name + ".S" + filedownload.ti.season;
	}
	if (filedownload.ti.episode)
	{
		alt_release_name = alt_release_name + ".E" + filedownload.ti.episode;
	}
	if (filedownload.ti.resolution)
	{
		alt_release_name = alt_release_name + "." +  filedownload.ti.resolution;
	}
	if (filedownload.ti.source)
	{
		alt_release_name = alt_release_name + "." + filedownload.ti.source;
	}
	if (filedownload.ti.encoder)
	{
		alt_release_name = alt_release_name + "." + filedownload.ti.encoder;
	}
	return alt_release_name;
}

plugin.announceSonarr =
function(filedownload, isRadarr)
{
	if (!this.downloadHistory.canDownload(filedownload.ti))
	{
		this.releaseAlreadyDownloaded(filedownload.ti);
		return;
	}
	
	if (filedownload.ti.uploadMethod.sonarr.altRn && !isRadarr)
	{
		release_name = this.sceneStringBuilder(filedownload);
		message(3, release_name, MT_STATUS);
	}
	else if (filedownload.ti.uploadMethod.radarr.altRn && isRadarr)
	{
		release_name = this.sceneStringBuilder(filedownload);
		message(3, release_name, MT_STATUS);
	}
	else
	{
		release_name = filedownload.ti.torrentName;
	}
	
	if(isRadarr)
	{
		var url = plugin.options.announce.radarrPath + "/release/push";
	}
	else
	{
		var url = plugin.options.announce.sonarrPath + "/release/push";
	}

	if(isRadarr)
	{
		var apikey = plugin.options.announce.radarrApiKey;
	}
	else
	{
		var apikey = plugin.options.announce.sonarrApiKey;
	}


	
	var params =
	{	
		"title"			: release_name,
		'downloadUrl'	: filedownload.downloadUrl,
		'protocol'		: 'torrent',
		'publishDate'	: filedownload.startTime.toISOString(),
		'indexer'		: filedownload.ti.tracker.shortName,
	}
	
	this.post(url,apikey,params);

}

function saveFileInternal(directory, filename, data)
{
	var localFile = nsLocalFile(directory ? directory : plugin.fileCwd.path);
	createDirectory(localFile);
	localFile.appendRelativePath(filename);
	var file = new LocalFile(localFile, ">");
	file.write(data);
	file.close();
	return localFile;
}

// Save the torrent file to disk and move it to the watch dir
plugin.saveTorrentFile =
function(filedownload)
{
	if (!this.downloadHistory.canDownload(filedownload.ti))
	{
		this.releaseAlreadyDownloaded(filedownload.ti);
		return;
	}

	try
	{
		// Save it to a temporary name with a different extension, and when all data has been written
		// to the file, rename it to the real filename.
		var watchDir = filedownload.ti.uploadMethod.watchFolder.dir;
		var localFile = saveFileInternal(watchDir, filedownload.filename + '1', filedownload.torrentFileData);
		localFile.moveTo(null, filedownload.filename);

		this.addDownload(filedownload);
		this.onTorrentFileUploaded(filedownload, "Saved torrent");
	}
	catch (ex)
	{
		message(0, "Could not save torrent file; error: " + formatException(ex), MT_ERROR);
	}
}

function defaultScriptEventHandler(event)
{
	plugin.onScriptEvent(event);
}

plugin.onTorrentFileUploaded =
function(filedownload, message)
{
	this.displayTotalTime(filedownload, newDate(), message);

	var scriptExecOptions = this.options.scriptExecOptions;
	var hash = toHexString(filedownload.info_hash);
	if (scriptExecOptions.uploaded.scriptName)
	{
		var scriptExec = new ScriptExec(scriptExecOptions.uploaded.scriptName, hash, filedownload.ti,
										filedownload.torrentFiles, defaultScriptEventHandler);
		var execTime = new Date(newDate().getTime() + (scriptExecOptions.uploaded.execAfterSeconds * 1000));
		this.scriptExecQueue.enqueue(scriptExec, execTime);
	}
	if (scriptExecOptions.downloadedData.scriptName)
	{
		var scriptExec = new ScriptExec(scriptExecOptions.downloadedData.scriptName, hash, filedownload.ti,
										filedownload.torrentFiles, defaultScriptEventHandler);

		this.downloadedScriptExecQueue.enqueue(hash, scriptExec, scriptExecOptions.downloadedData);
	}
}

plugin.onScriptEvent =
function(event)
{
	var msgTorrent = this.getTorrentInfoString(
	{
		torrentName: event.scriptExec.ti.torrentName,
	});

	switch (event.name)
	{
	case "started":
		message(3, "Starting script \x02" + event.scriptExec.scriptName + "\x02 (" + msgTorrent + ")", MT_INFO);
		break;

	case "stopped":
		if (event.errorMessage)
			message(0, "Could not execute script '" + event.scriptExec.scriptName + "' (" + msgTorrent + "), error:\n" + event.errorMessage, MT_ERROR);
		else
			message(3, "Script \x02" + event.scriptExec.scriptName + "\x02 executed successfully (" + msgTorrent + ") (" + event.totalTimeMs/1000 + "s)", MT_INFO);
		break;

	default:
		break;
	}
}

plugin.displayTotalTime =
function(filedownload, endTime, startMsg)
{
	var ary = filedownload.downloadUrl.match(/^https?:\/\/([^\/:]*)/);
	var hostname = "";
	if (ary)
		hostname = ary[1];

	var msg = startMsg + " ";
	msg += this.getTorrentInfoString(filedownload.ti);
	var timeInMs = endTime.getTime() - filedownload.startTime.getTime();
	msg += ", total time \x02\x0313" + (timeInMs / 1000) + "\x03\x02 seconds";
	message(3, msg, MT_STATUS);
}

plugin.releaseAlreadyDownloaded =
function(ti)
{
	message(4, "Release \x02\x0303" + ti.torrentName + "\x03\x02 (\x02\x0302" + ti.tracker.longName + "\x03\x02) has already been downloaded", MT_STATUS);
}

plugin.getTorrentInfoString =
function(ti)
{
	var msg = "";

	msg += "\x02\x0303" + ti.torrentName + "\x03\x02";
	if (ti.category && ti.category.length > 0)
		msg += " in \x02\x0304" + ti.category + "\x03\x02";
	var sizeStr = convertToByteSizeString(convertByteSizeString(ti.torrentSize));
	if (sizeStr !== null)
		msg += ", \x02\x0312" + sizeStr + "\x03\x02";
	if (ti.filter && ti.filter.name.length > 0)
		msg += " (\x02\x0306" + ti.filter.name + "\x03\x02)";
	var preStr = convertToTimeSinceString(convertTimeSinceString(ti.preTime));
	if (preStr !== null)
		msg += ", pre'd \x02\x0305" + preStr + "\x03\x02 ago";
	if (ti.tracker)
		msg += ", \x02\x0302" + ti.tracker.longName + "\x03\x02";

	return msg;
}

// Should be the last statement in the file to indicate it loaded successfully
true;
