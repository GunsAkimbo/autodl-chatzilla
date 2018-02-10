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

plugin.getSettingsFile =
function()
{
	var file = this.fileCwd.clone();
	file.append(this.settingsDirectory);
	createDirectory(file);
	file.append("autodl.xml");
	return file;
}

plugin.saveOptionsToFile =
function()
{
	var file;

	try
	{
		var doc = document.implementation.createDocument("", "", null);

		var root = doc.createElement("autodl");
		doc.appendChild(root);

		this.saveFilters(doc, root, this.filters);
		this.saveOptions(doc, root, this.options);
		this.saveScripts(doc, root, this.scripts);
		this.saveDownloadScriptQueue(doc, root, this.downloadedScriptExecQueue.getHashTable());

		var xmlSerializer = new XMLSerializer();
		var str = xmlSerializer.serializeToString(doc);

		file = new LocalFile(this.getSettingsFile(), ">");
		file.write(str);
	}
	catch (ex)
	{
		message(0, "Got an error when trying to save the options: " + formatException(ex), MT_ERROR);
	}
	finally
	{
		if (file)
			file.close();
	}
}

plugin.readOptionsFromFile =
function()
{
	var file;
	try
	{
		var dom = readXmlFile(this.getSettingsFile());
		if (dom === null)
			return;	// Empty file
		if (dom === undefined)
			throw "Error parsing options file";
		if (dom.childNodes.length !== 1 || dom.firstChild.nodeName !== "autodl")
			throw "root element is not autodl";

		var root = dom.firstChild;
		this.filters = this.readFilters(root);
		this.readOptions(root, this.options);
		this.scripts = this.readScripts(root);
		this.readDownloadScriptQueue(root);
	}
	catch (ex)
	{
		if (ex.name !== "NS_ERROR_FILE_NOT_FOUND")
			message(0, "Got an error when trying to read the options file: " + formatException(ex), MT_ERROR);
	}
	finally
	{
		if (file)
			file.close();
	}
}

plugin.saveDownloadScriptQueue =
function(doc, root, hashes)
{
	var root2 = doc.createElement("downloadScriptQueue");
	root.appendChild(root2);

	for (var hash in hashes)
	{
		var obj = hashes[hash];
		var downloadedScriptElem = doc.createElement("downloadedScript");

		downloadedScriptElem.setAttribute("timeInserted", +obj.timeInserted);
		if (obj.startSeedTime !== undefined)
			downloadedScriptElem.setAttribute("startSeedTime", +obj.startSeedTime);
		downloadedScriptElem.setAttribute("isInList", obj.isInList);

		this.saveScriptExec(doc, downloadedScriptElem, obj.scriptExec);
		this.saveExecConditions(doc, downloadedScriptElem, obj.execConditions);

		root2.appendChild(downloadedScriptElem);
	}
}

plugin.saveExecConditions =
function(doc, root, execConditions)
{
	var execConditionsElem = doc.createElement("execConditions");
	root.appendChild(execConditionsElem);

	execConditionsElem.setAttribute("useRatio", execConditions.useRatio);
	execConditionsElem.setAttribute("ratio", execConditions.ratio);
	execConditionsElem.setAttribute("useSeedingTime", execConditions.useSeedingTime);
	execConditionsElem.setAttribute("seedingTimeHours", execConditions.seedingTimeHours);
	execConditionsElem.setAttribute("isAnd", execConditions.isAnd);
}

plugin.saveScriptExec =
function(doc, root, scriptExec)
{
	var scriptExecElem = doc.createElement("scriptExec");
	root.appendChild(scriptExecElem);

	scriptExecElem.setAttribute("scriptName", scriptExec.scriptName);
	scriptExecElem.setAttribute("hash", scriptExec.hash);
	this.saveTorrentInfo(doc, scriptExecElem, scriptExec.ti);
	this.saveTorrentFiles(doc, scriptExecElem, scriptExec.torrentFiles);
}

var tiProps =
[
	"category",
	"torrentName",
	"uploader",
	"torrentSize",
	"preTime",
	"torrentUrl",
	"torrentSslUrl",
	"year",
	"name1",
	"name2",
	"season",
	"episode",
	"resolution",
	"source",
	"encoder",
	"format",
	"bitrate",
	"media",
	"tags",
	"scene",
	"log",
	"cue",
	"site",
	"torrentDataPath",
	"torrentSizeInBytes",	// number
];

plugin.saveTorrentInfo =
function(doc, root, ti)
{
	var tiElem = doc.createElement("ti");
	root.appendChild(tiElem);

	for (var i = 0; i < tiProps.length; i++)
	{
		if (ti[tiProps[i]] !== undefined)
			tiElem.setAttribute(tiProps[i], ti[tiProps[i]]);
	}
}

plugin.saveTorrentFiles =
function(doc, root, torrentFiles)
{
	var torrentFilesElem = doc.createElement("torrentFiles");
	root.appendChild(torrentFilesElem);

	torrentFilesElem.setAttribute("directoryName", torrentFiles.directoryName);

	var files = torrentFiles.files;
	for (var i = 0; i < files.length; i++)
	{
		var torrentFile = files[i];
		var torrentFileElem = doc.createElement("torrentFile");

		var relativePath = torrentFile.relativePath;
		if (torrentFiles.directoryName)
			relativePath = relativePath.substr(torrentFiles.directoryName.length + 1);

		torrentFileElem.setAttribute("relativePath", relativePath);
		torrentFileElem.setAttribute("fileSize", torrentFile.fileSize);

		torrentFilesElem.appendChild(torrentFileElem);
	}
}

plugin.readDownloadScriptQueue =
function(root)
{
	var root2 = getChildElementsByTagName(root, "downloadScriptQueue")[0];
	if (!root2)
		return;

	var aryElems = getChildElementsByTagName(root2, "downloadedScript");

	for (var i = 0; i < aryElems.length; i++)
	{
		var downloadedScriptElem = aryElems[i];

		var obj =
		{
			timeInserted: newDate(readAttributeInteger(downloadedScriptElem, "timeInserted", 0)),
			startSeedTime: readAttributeInteger(downloadedScriptElem, "startSeedTime"),
			isInList: readAttributeBoolean(downloadedScriptElem, "isInList", false),
		};
		if (obj.startSeedTime !== undefined)
			obj.startSeedTime = newDate(obj.startSeedTime);

		obj.scriptExec = this.readScriptExec(downloadedScriptElem);
		obj.execConditions = this.readExecConditions(downloadedScriptElem);
		if (!obj.scriptExec || !obj.execConditions)
			continue;

		this.downloadedScriptExecQueue.enqueue2(obj.scriptExec.hash, obj);
	}
}

plugin.readExecConditions =
function(root)
{
	var elem = getChildElementsByTagName(root, "execConditions")[0];
	if (!elem)
		return null;

	var rv =
	{
		useRatio:			readAttributeBoolean(elem, "useRatio", false),
		ratio:				readAttributeNumber(elem, "ratio", 1.05, 0),
		useSeedingTime:		readAttributeBoolean(elem, "useSeedingTime", false),
		seedingTimeHours:	readAttributeNumber(elem, "seedingTimeHours", 24.1, 0),
		isAnd:				readAttributeBoolean(elem, "isAnd", false),
	};

	return rv;
}

plugin.readScriptExec =
function(root)
{
	var elem = getChildElementsByTagName(root, "scriptExec")[0];
	if (!elem)
		return null;

	var scriptName = readAttribute(elem, "scriptName");
	var hash = readAttribute(elem, "hash");
	var ti = this.readTorrentInfo(elem);
	var torrentFiles = this.readTorrentFiles(elem);
	if (!scriptName || !ti || !torrentFiles)
		return null;

	return new ScriptExec(scriptName, hash, ti, torrentFiles, defaultScriptEventHandler);
}

plugin.readTorrentInfo =
function(root)
{
	var elem = getChildElementsByTagName(root, "ti")[0];
	if (!elem)
		return null;

	var ti = {};

	for (var i = 0; i < tiProps.length; i++)
		ti[tiProps[i]] = readAttribute(elem, tiProps[i], "");

	ti.torrentSizeInBytes = parseInt(ti.torrentSizeInBytes);
	if (isNaN(ti.torrentSizeInBytes))
		ti.torrentSizeInBytes = 0;

	return ti;
}

plugin.readTorrentFiles =
function(root)
{
	var elem = getChildElementsByTagName(root, "torrentFiles")[0];
	if (!elem)
		return null;

	var torrentFiles = new TorrentFiles(readAttribute(elem, "directoryName", ""));

	var aryElems = getChildElementsByTagName(elem, "torrentFile");
	for (var i = 0; i < aryElems.length; i++)
	{
		var child = aryElems[i];
		var relativePath = readAttribute(child, "relativePath");
		var fileSize = readAttributeInteger(child, "fileSize");
		if (!relativePath || isNaN(fileSize))
			return null;
		torrentFiles.addFile(new TorrentFile(relativePath, fileSize));
	}

	return torrentFiles;
}

plugin.saveScripts =
function(doc, root, scripts)
{
	var root2 = doc.createElement("scripts");
	root.appendChild(root2);

	for (var i = 0; i < scripts.length; i++)
	{
		function setAttribute(s)
		{
			elem.setAttribute(s, script[s]);
		}

		var script = scripts[i];
		var elem = doc.createElement("script");
		setAttribute("name");
		setAttribute("contents");
		root2.appendChild(elem);
	}
}

plugin.readScripts =
function(root)
{
	var rv = [];

	var ary = getChildElementsByTagName(root, "scripts");
	for (var i = 0; i < ary.length; i++)
	{
		var scriptsElem = ary[i];
		var aryElems = getChildElementsByTagName(scriptsElem, "script");
		for (var j = 0; j < aryElems.length; j++)
		{
			var elem = aryElems[j];
			var script =
			{
				name:		readAttribute(elem, "name", ""),
				contents:	readAttribute(elem, "contents", ""),
			};

			rv.push(script);
		}
	}

	return rv;
}

plugin.saveFilters =
function(doc, root, filters)
{
	var root2 = doc.createElement("filters");
	root.appendChild(root2);

	for (var i = 0; i < filters.length; i++)
	{
		function saveChildNode(elemName, s, defaultValue)
		{
			if (defaultValue === undefined)
				defaultValue = ""
			var val = filter[s];
			if (val === undefined || val === defaultValue)
				return;
			appendTextElement(doc, filterElem, elemName, val);
		}

		var filter = filters[i];
		var filterElem = doc.createElement("filter");
		saveChildNode("name", "name");
		saveChildNode("enabled", "enabled", true);
		saveChildNode("match-releases", "matchReleases");
		saveChildNode("except-releases", "exceptReleases");
		saveChildNode("match-categories", "matchCategories");
		saveChildNode("except-categories", "exceptCategories");
		saveChildNode("match-uploaders", "matchUploaders");
		saveChildNode("except-uploaders", "exceptUploaders");
		saveChildNode("match-sites", "matchSites");
		saveChildNode("except-sites", "exceptSites");
		saveChildNode("min-size", "minSize");
		saveChildNode("max-size", "maxSize");
		saveChildNode("max-pretime", "maxPreTime");
		saveChildNode("max-triggers", "maxTriggers", 0);
		saveChildNode("seasons", "seasons");
		saveChildNode("episodes", "episodes");
		saveChildNode("resolutions", "resolutions");
		saveChildNode("sources", "sources");
		saveChildNode("encoders", "encoders");
		saveChildNode("years", "years");
		saveChildNode("shows", "artists");
		saveChildNode("albums", "albums");
		saveChildNode("formats", "formats");
		saveChildNode("bitrates", "bitrates");
		saveChildNode("media", "media");
		saveChildNode("tags", "tags");
		saveChildNode("scene", "scene");
		saveChildNode("log", "log");
		saveChildNode("cue", "cue");
		var uploadMethodElem = this.saveOptionsUploadMethodInternal(doc, filter.uploadMethod);
		if (uploadMethodElem)
			filterElem.appendChild(uploadMethodElem);
		root2.appendChild(filterElem);
	}
}

plugin.readFilters =
function(root)
{
	var rv = [];

	var ary = getChildElementsByTagName(root, "filters");
	for (var i = 0; i < ary.length; i++)
	{
		var filtersElem = ary[i];
		var aryElems = getChildElementsByTagName(filtersElem, "filter");
		if (aryElems.length === 0)
		{
			this.old_readFilters(rv, filtersElem);
			continue;
		}

		for (var j = 0; j < aryElems.length; j++)
		{
			var elem = aryElems[j];
			var filter =
			{
				name:				readTextNode(elem, "name", ""),
				enabled:			readTextNodeBoolean(elem, "enabled", true),
				matchReleases:		readTextNode(elem, "match-releases", ""),
				exceptReleases:		readTextNode(elem, "except-releases", ""),
				matchCategories:	readTextNode(elem, "match-categories", ""),
				exceptCategories:	readTextNode(elem, "except-categories", ""),
				matchUploaders:		readTextNode(elem, "match-uploaders", ""),
				exceptUploaders:	readTextNode(elem, "except-uploaders", ""),
				matchSites:			readTextNode(elem, "match-sites", ""),
				exceptSites:		readTextNode(elem, "except-sites", ""),
				minSize:			readTextNode(elem, "min-size", ""),
				maxSize:			readTextNode(elem, "max-size", ""),
				maxPreTime:			readTextNode(elem, "max-pretime", ""),
				maxTriggers:		readTextNodeInteger(elem, "max-triggers", 0),
				seasons:			readTextNode(elem, "seasons", ""),
				episodes:			readTextNode(elem, "episodes", ""),
				resolutions:		readTextNode(elem, "resolutions", ""),
				sources:			readTextNode(elem, "sources", ""),
				encoders:			readTextNode(elem, "encoders", ""),
				years:				readTextNode(elem, "years", ""),
				artists:			readTextNode(elem, "shows", ""),
				albums:				readTextNode(elem, "albums", ""),
				formats:			readTextNode(elem, "formats", ""),
				bitrates:			readTextNode(elem, "bitrates", ""),
				media:				readTextNode(elem, "media", ""),
				tags:				readTextNode(elem, "tags", ""),
				scene:				readTextNode(elem, "scene", ""),
				log:				readTextNode(elem, "log", ""),
				cue:				readTextNode(elem, "cue", ""),
				uploadMethod:		createUploadMethod(),
			};

			var ary = getChildElementsByTagName(elem, "upload-method");
			if (ary.length !== 0)
				this.readOptionsUploadMethod(ary[0], filter.uploadMethod);

			rv.push(filter);
		}
	}

	return rv;
}

// Old code for autodl <= v2.0.2 settings.xml files
plugin.old_readFilters =
function(aryFilters, filtersElem)
{
	var aryElems = getChildElementsByTagName(filtersElem, "elem");

	for (var j = 0; j < aryElems.length; j++)
	{
		var elem = aryElems[j];
		var filter =
		{
			name:				readAttribute(elem, "name", ""),
			enabled:			readAttributeBoolean(elem, "enabled", true),
			matchReleases:		readAttribute(elem, "matchReleases", ""),
			exceptReleases:		readAttribute(elem, "exceptReleases", ""),
			matchCategories:	readAttribute(elem, "matchCategories", ""),
			exceptCategories:	readAttribute(elem, "exceptCategories", ""),
			matchUploaders:		readAttribute(elem, "matchUploaders", ""),
			exceptUploaders:	readAttribute(elem, "exceptUploaders", ""),
			matchSites:			readAttribute(elem, "matchSites", ""),
			exceptSites:		readAttribute(elem, "exceptSites", ""),
			minSize:			readAttribute(elem, "minSize", ""),
			maxSize:			readAttribute(elem, "maxSize", ""),
			maxPreTime:			readAttribute(elem, "maxPreTime", ""),
			maxTriggers:		readAttributeInteger(elem, "maxTriggers", 0),
			seasons:			readAttribute(elem, "seasons", ""),
			episodes:			readAttribute(elem, "episodes", ""),
			resolutions:		readAttribute(elem, "resolutions", ""),
			sources:			readAttribute(elem, "sources", ""),
			encoders:			readAttribute(elem, "encoders", ""),
			years:				readAttribute(elem, "years", ""),
			artists:			readAttribute(elem, "artists", ""),
			albums:				readAttribute(elem, "albums", ""),
			formats:			readAttribute(elem, "formats", ""),
			bitrates:			readAttribute(elem, "bitrates", ""),
			media:				readAttribute(elem, "media", ""),
			tags:				readAttribute(elem, "tags", ""),
			scene:				readAttribute(elem, "scene", ""),
			log:				readAttribute(elem, "log", ""),
			cue:				readAttribute(elem, "cue", ""),
			uploadMethod:		createUploadMethod(),
		};
		this.old_readOptionsUploadMethod(elem, filter.uploadMethod);

		aryFilters.push(filter);
	}
}

plugin.saveOptions =
function(doc, root, options)
{
	var root2 = doc.createElement("options");
	root.appendChild(root2);

	for (var name in options)
	{
		var elem;
		if (name === "trackers")
			elem = this.saveOptionsTrackers(doc, options);
		else if (name === "uploadMethod")
			elem = this.saveOptionsUploadMethod(doc, options);
		else if (name === "scriptExecOptions")
			elem = this.saveOptionsScriptExec(doc, options);
		else if (name === "webui")
			elem = this.saveOptionsWebui(doc, options.webui);
		else if (name === "ftp")
			elem = this.saveOptionsFtp(doc, options.ftp);
		else if (name === "announce")
			elem = this.saveOptionsAnnounce(doc, options.announce);
		else
		{
			elem = doc.createElement(name);
			elem.appendChild(doc.createTextNode(options[name]));
		}
		if (elem)
			root2.appendChild(elem);
	}
}

plugin.saveOptionsFtp =
function(doc, ftp)
{
	var ftpElem = doc.createElement("ftp");

	appendTextElement(doc, ftpElem, "user", ftp.user);
	appendTextElement(doc, ftpElem, "password", ftp.password);
	appendTextElement(doc, ftpElem, "hostname", ftp.hostname);
	appendTextElement(doc, ftpElem, "port", ftp.port);

	return ftpElem;
}

plugin.saveOptionsWebui =
function(doc, webui)
{
	var webuiElem = doc.createElement("webui");

	appendTextElement(doc, webuiElem, "user", webui.user);
	appendTextElement(doc, webuiElem, "password", webui.password);
	appendTextElement(doc, webuiElem, "hostname", webui.hostname);
	appendTextElement(doc, webuiElem, "port", webui.port);
	appendTextElement(doc, webuiElem, "ssl", webui.https);

	return webuiElem;
}

plugin.saveOptionsAnnounce =
function(doc, announce)
{
	var announceElem = doc.createElement("announce");

	appendTextElement(doc, announceElem, "path-sonarr", announce.sonarrPath);
	appendTextElement(doc, announceElem, "apikey-sonarr", announce.sonarrApiKey);
	appendTextElement(doc, announceElem, "path-radarr", announce.radarrPath);
	appendTextElement(doc, announceElem, "apikey-radarr", announce.radarrApiKey);
	appendTextElement(doc, announceElem, "hdtv-delay", announce.hdtvDelay);
	appendTextElement(doc, announceElem, "web-delay", announce.webDelay);

	return announceElem;
}
plugin.saveOptionsTrackers =
function(doc, options)
{
	var trackers = doc.createElement("trackers");

	for (var trackerType in options.trackers)
	{
		var tracker = this.trackers[trackerType];
		if (!tracker)
			continue;

		var trackerElem = doc.createElement("tracker");
		trackerElem.setAttribute("type", trackerType);
		if (tracker.announceInfo && tracker.announceInfo.lastAnnounce !== undefined)
			trackerElem.setAttribute("lastAnnounce", +tracker.announceInfo.lastAnnounce);

		var trackerOptions = getTrackerOptions(trackerType, options);
		for (var i = 0; i < tracker.settings.length; i++)
		{
			var setting = tracker.settings[i];
			if (!(setting.name in trackerOptions))
				continue;

			var value = trackerOptions[setting.name].toString();
			if (value === setting.defaultValue)
				continue;

			var optionElem = doc.createElement("option");
			optionElem.setAttribute("name", setting.name);
			optionElem.setAttribute("value", value);
			trackerElem.appendChild(optionElem);
		}

		trackers.appendChild(trackerElem);
	}

	return trackers;
}

plugin.saveOptionsUploadMethod =
function(doc, options)
{
	return this.saveOptionsUploadMethodInternal(doc, options.uploadMethod);
}

plugin.saveOptionsUploadMethodInternal =
function(doc, uploadMethod)
{
	var uploadMethodElem = doc.createElement("upload-method");

	var modified = false;
	function saveValue(childElemName, value, defaultValue)
	{
		if (value === defaultValue)
			return;
		modified = true;

		appendTextElement(doc, uploadMethodElem, childElemName, value);
	}

	var defaults = createUploadMethod();

	saveValue("type", uploadMethod.type, defaults.type);
	saveValue("override-global", uploadMethod.overrideGlobal, defaults.overrideGlobal);
	saveValue("watch-dir", uploadMethod.watchFolder.dir, defaults.watchFolder.dir);
	saveValue("ftp-path", uploadMethod.ftp.path, defaults.ftp.path);
	saveValue("tool-command", uploadMethod.tool.command, defaults.tool.command);
	saveValue("tool-args", uploadMethod.tool.args, defaults.tool.args);
	saveValue("dyndir-basedir", uploadMethod.dynamicDir.basedir, defaults.dynamicDir.basedir);
	saveValue("dyndir-dyndir", uploadMethod.dynamicDir.dyndir, defaults.dynamicDir.dyndir);

	return modified ? uploadMethodElem : null;
}

plugin.saveOptionsScriptExec =
function(doc, options)
{
	return this.saveOptionsScriptExecInternal(doc, options.scriptExecOptions);
}

plugin.saveOptionsScriptExecInternal =
function(doc, scriptExecOptions)
{
	var scriptExecOptionsElem = doc.createElement("script-exec-options");

	var uploadedElem = doc.createElement("uploaded");
	appendTextElement(doc, uploadedElem, "script-name", scriptExecOptions.uploaded.scriptName);
	appendTextElement(doc, uploadedElem, "seconds", scriptExecOptions.uploaded.execAfterSeconds);
	scriptExecOptionsElem.appendChild(uploadedElem);

	var downloadedElem = doc.createElement("downloaded");
	appendTextElement(doc, downloadedElem, "script-name", scriptExecOptions.downloadedData.scriptName);
	appendTextElement(doc, downloadedElem, "use-ratio", scriptExecOptions.downloadedData.useRatio);
	appendTextElement(doc, downloadedElem, "ratio", scriptExecOptions.downloadedData.ratio);
	appendTextElement(doc, downloadedElem, "use-seeding-time", scriptExecOptions.downloadedData.useSeedingTime);
	appendTextElement(doc, downloadedElem, "seeding-time-hours", scriptExecOptions.downloadedData.seedingTimeHours);
	appendTextElement(doc, downloadedElem, "is-and", scriptExecOptions.downloadedData.isAnd);
	scriptExecOptionsElem.appendChild(downloadedElem);

	return scriptExecOptionsElem;
}

plugin.readOptions =
function(root, options)
{
	var ary = getChildElementsByTagName(root, "options");
	for (var i = 0; i < ary.length; i++)
	{
		var optsElem = ary[i];

		for (var i = 0; i < optsElem.childNodes.length; i++)
		{
			var optElem = optsElem.childNodes[i];
			if (optElem.nodeType !== 1)
				continue;
			var nodeName = optElem.nodeName;

			var value = "";
			if (optElem.childNodes.length >= 1 && optElem.childNodes[0].nodeType === 3)
				value = optElem.childNodes[0].nodeValue;

			value = trimMultiLineString(value);

			if (this.checkOldOption(options, nodeName, value))
				continue;

			if (nodeName === "maxSavedReleases")
				options.maxSavedReleases = convertStringToInteger(value, 1000, 0);
			else if (nodeName === "updateCheck")
				options.updateCheck = convertStringToInteger(value, UPDATE_ASK, UPDATE_MIN, UPDATE_MAX);
			else if (nodeName === "debug")
				options.debug = convertStringToBoolean(value);
			else if (nodeName === "saveDownloadHistory")
				options.saveDownloadHistory = convertStringToBoolean(value);
			else if (nodeName === "downloadDupeReleases")
				options.downloadDupeReleases = convertStringToBoolean(value);
			else if (nodeName === "maxDownloadRetryTimeSeconds")
				options.maxDownloadRetryTimeSeconds = convertStringToInteger(value, 2*60, 0, 60*60);
			else if (nodeName === "level")
				options.level = convertStringToInteger(value, 3);
			else if (nodeName === "trackersVersion")
				options.trackersVersion = convertStringToInteger(value, -1);
			else if (nodeName === "trackers")
				this.readOptionsTrackers(optElem, options);
			else if (nodeName === "upload-method")
				this.readOptionsUploadMethod(optElem, options.uploadMethod);
			else if (nodeName === "uploadMethod")
				this.old_readOptionsUploadMethod(optElem, options.uploadMethod);
			else if (nodeName === "script-exec-options")
				this.readOptionsScriptExec(optElem, options.scriptExecOptions);
			else if (nodeName === "scriptExecOptions")
				this.old_readOptionsScriptExec(optElem, options.scriptExecOptions);
			else if (nodeName === "webui")
				this.readOptionsWebui(optElem, options.webui);
			else if (nodeName === "ftp")
				this.readOptionsFtp(optElem, options.ftp);
			else if (nodeName === "announce")
				this.readOptionsAnnounce(optElem, options.announce);
			else if (nodeName === "userAgent")
			{
				if (value !== 'FireFox 3.5')
					options.userAgent = value;
			}
			else
			{
				if (!(nodeName in options))
				{
					message(0, "Unknown option: '" + nodeName + "' with value: '" + value + "'", MT_ERROR);
					continue;
				}

				options[nodeName] = value;
			}
		}
	}
}

plugin.readOptionsFtp =
function(elem, ftp)
{
	// True if <= v2.0.1
	if (readAttribute(elem, "user") !== undefined)
	{
		ftp.user = readAttribute(elem, "user", "");
		ftp.password = readAttribute(elem, "password", "");
		ftp.hostname = readAttribute(elem, "hostname", "");
		ftp.port = readAttributeInteger(elem, "port", 1, 1, 65535);
		return;
	}

	ftp.user = readTextNode(elem, "user", "");
	ftp.password = readTextNode(elem, "password", "");
	ftp.hostname = readTextNode(elem, "hostname", "");
	ftp.port = readTextNodeInteger(elem, "port", 1, 1, 65535);
}

plugin.readOptionsWebui =
function(elem, webui)
{
	// True if <= v2.0.1
	if (readAttribute(elem, "user") !== undefined)
	{
		webui.user = readAttribute(elem, "user", "");
		webui.password = readAttribute(elem, "password", "");
		webui.hostname = readAttribute(elem, "hostname", "");
		webui.port = readAttributeInteger(elem, "port", 1, 1, 65535);
		webui.https = readAttributeBoolean(elem, "https", false);
		return;
	}

	webui.user = readTextNode(elem, "user", "");
	webui.password = readTextNode(elem, "password", "");
	webui.hostname = readTextNode(elem, "hostname", "");
	webui.port = readTextNodeInteger(elem, "port", 1, 1, 65535);
	webui.https = readTextNodeBoolean(elem, "ssl", false);
}

plugin.readOptionsAnnounce =
function(elem, announce)
{
	announce.sonarrPath = readTextNode(elem, "path-sonarr", "");
	announce.sonarrApiKey = readTextNode(elem, "apikey-sonarr", "");
	announce.radarrPath = readTextNode(elem, "path-radarr", "");
	announce.radarrApiKey = readTextNode(elem, "apikey-radarr", "");
	announce.hdtvDelay = readTextNodeInteger(elem, "hdtv-delay", 1, 1, 65535);
	announce.webDelay = readTextNodeInteger(elem, "web-delay", 1, 1, 65535);
}

plugin.readOptionsTrackers =
function(root, options)
{
	var trackerElems = getChildElementsByTagName(root, "tracker");
	for (var i = 0; i < trackerElems.length; i++)
	{
		var trackerElem = trackerElems[i];

		var trackerType = readAttribute(trackerElem, "type", "");
		var tracker = this.trackers[trackerType];
		if (!tracker)
			continue;

		var lastAnnounce = readAttributeInteger(trackerElem, "lastAnnounce", undefined);
		if (lastAnnounce !== undefined)
			tracker.lastAnnounce = newDate(lastAnnounce);
		else
			tracker.lastAnnounce = undefined;

		var optionElems = getChildElementsByTagName(trackerElem, "option");
		var trackerOptions = getTrackerOptions(tracker.type, options);
		for (var j = 0; j < optionElems.length; j++)
		{
			var optionElem = optionElems[j];
			var optionName = readAttribute(optionElem, "name", "");
			var optionValue = readAttribute(optionElem, "value", "");
			if (!optionName)
				continue;
			trackerOptions.__isDefaultOption[optionName] = false;
			trackerOptions[optionName] = optionValue;
		}
	}
}

plugin.readOptionsUploadMethod =
function(elem, uploadMethod)
{
	var defaults = createUploadMethod();

	uploadMethod.type = readTextNodeInteger(elem, "type", defaults.type, UPLOAD_MIN, UPLOAD_MAX);
	uploadMethod.overrideGlobal = readTextNodeBoolean(elem, "override-global", defaults.overrideGlobal);
	uploadMethod.watchFolder.dir = readTextNode(elem, "watch-dir", defaults.watchFolder.dir);
	uploadMethod.ftp.path = readTextNode(elem, "ftp-path", defaults.ftp.path);
	uploadMethod.tool.command = readTextNode(elem, "tool-command", defaults.tool.command);
	uploadMethod.tool.args = readTextNode(elem, "tool-args", defaults.tool.args);
	uploadMethod.dynamicDir.basedir = readTextNode(elem, "dyndir-basedir", defaults.dynamicDir.basedir);
	uploadMethod.dynamicDir.dyndir = readTextNode(elem, "dyndir-dyndir", defaults.dynamicDir.dyndir);
}

// <= v2.0.1
plugin.old_readOptionsUploadMethod =
function(elem, uploadMethod)
{
	function getValue(attribName, defaultValue)
	{
		return readAttribute(elem, "um_" + attribName, defaultValue || "");
	}
	uploadMethod.type = convertStringToInteger(getValue("type"), UPLOAD_WATCH_FOLDER, UPLOAD_MIN, UPLOAD_MAX);
	uploadMethod.overrideGlobal = convertStringToBoolean(getValue("overrideGlobal", "false"));
	uploadMethod.watchFolder.dir = getValue("watch_dir");
	uploadMethod.ftp.path = getValue("ftp_path");
	uploadMethod.tool.command = getValue("tool_command");
	uploadMethod.tool.args = getValue("tool_args");
	uploadMethod.dynamicDir.basedir = getValue("dyndir_basedir");
	uploadMethod.dynamicDir.dyndir = getValue("dyndir_dyndir");
}

plugin.readOptionsScriptExec =
function(elem, scriptExecOptions)
{
	var child;
	if (child = getChildElementsByTagName(elem, "uploaded")[0])
	{
		scriptExecOptions.uploaded.scriptName = readTextNode(child, "script-name", "");
		scriptExecOptions.uploaded.execAfterSeconds = readTextNodeInteger(child, "seconds", 0, 0);
	}

	if (child = getChildElementsByTagName(elem, "downloaded")[0])
	{
		scriptExecOptions.downloadedData.scriptName = readTextNode(child, "script-name", "");
		scriptExecOptions.downloadedData.useRatio = readTextNodeBoolean(child, "use-ratio", false);
		scriptExecOptions.downloadedData.ratio = readTextNodeNumber(child, "ratio", 1.05, 0);
		scriptExecOptions.downloadedData.useSeedingTime = readTextNodeBoolean(child, "use-seeding-time", false);
		scriptExecOptions.downloadedData.seedingTimeHours = readTextNodeNumber(child, "seeding-time-hours", 24.1, 0);
		scriptExecOptions.downloadedData.isAnd = readTextNodeBoolean(child, "is-and", false);
	}
}

// <= v2.0.1
plugin.old_readOptionsScriptExec =
function(elem, scriptExecOptions)
{
	function getValue(attribName, defaultValue)
	{
		return readAttribute(elem, "seo_" + attribName, defaultValue || "");
	}

	scriptExecOptions.uploaded.scriptName = getValue("upl_name");
	scriptExecOptions.uploaded.execAfterSeconds = convertStringToInteger(getValue("upl_secs"), 0, 0);

	scriptExecOptions.downloadedData.scriptName = getValue("dnl_name");
	scriptExecOptions.downloadedData.useRatio = convertStringToBoolean(getValue("dnl_useRatio", "false"));
	scriptExecOptions.downloadedData.ratio = convertStringToNumber(getValue("dnl_ratio"), 1.05, 0);
	scriptExecOptions.downloadedData.useSeedingTime = convertStringToBoolean(getValue("dnl_useSeedingTime", "false"));
	scriptExecOptions.downloadedData.seedingTimeHours = convertStringToNumber(getValue("dnl_seedingTimeHours"), 24.1, 0);
	scriptExecOptions.downloadedData.isAnd = convertStringToBoolean(getValue("dnl_isAnd", "false"));
}

plugin.checkOldOption =
function(options, name, value)
{
	switch (name)
	{
	// <= v2.09
	case "torrent-client":
		return true;

	default:
		break;
	}

	return false;
}

// Should be the last statement in the file to indicate it loaded successfully
true;
