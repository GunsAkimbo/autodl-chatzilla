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

plugin.trackers = {};

plugin.readAllTrackers =
function()
{
	try
	{
		var oldTrackers = this.trackers || {};
		if (!this.options.trackers)
			this.options.trackers = {};
		this.trackers = {};
		this.servers = {};

		var dir = this.fileCwd.clone();
		dir.append("trackers");
		var entries = dir.directoryEntries;
		while (entries.hasMoreElements())
		{
			var file = entries.getNext().QueryInterface(Components.interfaces.nsIFile);
			if (!file.isFile() || !file.leafName.match(/\.tracker$/))
				continue;

			var trackerXmlReader = new TrackerXmlReader();
			var tracker = trackerXmlReader.parse(file);
			if (!tracker)
				continue;

			if (oldTrackers[tracker.type])
				tracker.announceInfo = oldTrackers[tracker.type].announceInfo;
			if (!tracker.announceInfo)
				tracker.announceInfo = new AnnounceInfo(tracker.lastAnnounce);
			this.addTracker(tracker);
		}
	}
	catch (ex)
	{
		message(0, "Caught an exception when reading trackers: " + formatException(ex), MT_ERROR);
	}

	// If it's not empty...
	for (var ignore in oldTrackers)
	{
		this.printNewTrackers(oldTrackers);
		break;
	}

	var numTrackers = 0;
	for (var p in this.trackers)
		numTrackers++;
}

plugin.printNewTrackers =
function(oldTrackers)
{
	for (var type in this.trackers)
	{
		if (oldTrackers[type])
			continue;
		var tracker = this.trackers[type];
		message(3, "\x02Added new tracker\x02 \x02\x0303" + tracker.longName + "\x03\x02", MT_STATUS);
	}
	for (var type in oldTrackers)
	{
		if (this.trackers[type])
			continue;
		var tracker = oldTrackers[type];
		dmessage(3, "\x02Removed tracker\x02 \x02\x0304" + tracker.longName + "\x03\x02", MT_STATUS);
	}
}

plugin.addTracker =
function(tracker)
{
	if (!tracker)
		return;

	if (this.trackers[tracker.type])
	{
		message(0, "Tracker with type '" + tracker.type + "' has already been added.", MT_ERROR);
		message(0, "First file: " + this.trackers[tracker.type].file.path, MT_ERROR);
		message(0, "Second file: " + tracker.file.path, MT_ERROR);
		return;
	}

	this.initializeTrackerOptions(tracker);
	this.initializeServers(tracker);
	this.initializeAnnounceParser(tracker);
	this.trackers[tracker.type] = tracker;
}

plugin.initializeTrackerOptions =
function(tracker)
{
	var trackerOptions = getTrackerOptions(tracker.type);

	for (var i = 0; i < tracker.settings.length; i++)
	{
		var setting = tracker.settings[i];
		if (trackerOptions.__isDefaultOption[setting.name] || trackerOptions[setting.name] === undefined)
		{
			writeTrackerOption(tracker, setting.name, setting.defaultValue, 1);
		}
	}
}

plugin.initializeServers =
function(tracker)
{
	for (var i = 0; i < tracker.servers.length; i++)
	{
		// This is the canonicalized server name or network name
		var canonName = tracker.servers[i].serverName;

		var server = this.servers[canonName];
		if (!server)
			server = this.servers[canonName] = { channels: [] };

		var channel =
		{
			tracker: tracker,
			names: tracker.servers[i].channelNames,
			announcerNames: tracker.servers[i].announcerNames,
		};

		server.channels.push(channel);
	}
}

plugin.initializeAnnounceParser =
function(tracker)
{
	this.announceParsers[tracker.type] = new AnnounceParser(tracker);
}

//TODO: Similar func exists in Utils.js
function getTheTag(elem, elemName)
{
	var ary = getChildElementsByTagName(elem, elemName);
	if (ary.length !== 1)
		throw "Exactly one <" + elemName + "> tag not found";
	return ary[0];
}

function TrackerXmlReader()
{
}

// Returns the tracker or undefined if an error occurred
TrackerXmlReader.prototype.parse =
function(file)
{
	try
	{
		this.dom = readXmlFile(file, true);
		if (this.dom === null)
			return;	// Empty file
		if (this.dom === undefined)
			throw "Error parsing file";
		var trackerinfo = getTheTag(this.dom, "trackerinfo");

		this.tracker =
		{
			file:		file.clone(),
			forceDisabled: readAttributeBoolean(trackerinfo, "forceDisabled", false),
			type:		readAttribute(trackerinfo, "type", ""),
			shortName:	readAttribute(trackerinfo, "shortName", ""),
			longName:	readAttribute(trackerinfo, "longName", ""),
			siteName:	readAttribute(trackerinfo, "siteName", ""),
			deobfuscate:readAttribute(trackerinfo, "deobfuscate", ""),
			follow302:	readAttributeBoolean(trackerinfo, "follow302links", false),
		};
		if (this.tracker.type.length === 0) throw "Invalid trackerinfo.type";
		if (this.tracker.shortName.length === 0) throw "Invalid trackerinfo.shortName";
		if (this.tracker.longName.length === 0) throw "Invalid trackerinfo.longName";

		this.tracker.settings = this.parseSettings(trackerinfo);
		this.tracker.servers = this.parseServers(trackerinfo);
		this.tracker.parseInfo = this.parseParseInfo(trackerinfo);

		return this.tracker;
	}
	catch (ex)
	{
		message(0, "file '" + file.path + "' is invalid. exception: " + formatException(ex), MT_ERROR);
		return;
	}
}

TrackerXmlReader.prototype.parseSettings =
function(trackerinfo)
{
	var settings = getTheTag(trackerinfo, "settings");
	var children = getChildElements(settings);
	if (children.length === 0) throw "No settings found";

	var rv = [];

	var this_ = this;
	function addIt(setting, elemName)
	{
		this_.initializeSetting(setting, elemName);
		rv.push(setting);
	}

	addIt(
	{
		name: "enabled",
		type: "bool",
		defaultValue: "true",
		text: "Enabled",
		accesskey: "E",
		tooltiptext: "Check it to enable this announcer channel.",
		isDownloadVar: false,
	});

	for (var i = 0; i < children.length; i++)
	{
		var elem = children[i];

		var setting =
		{
			name:			readAttribute(elem, "name"),
			type:			readAttribute(elem, "type"),
			defaultValue:	readAttribute(elem, "defaultValue", ""),
			text:			readAttribute(elem, "text"),
			accesskey:		readAttribute(elem, "accesskey"),
			emptytext:		readAttribute(elem, "emptytext"),
			tooltiptext:	readAttribute(elem, "tooltiptext"),
			pasteGroup:		readAttribute(elem, "pasteGroup"),
			pasteRegex:		readAttribute(elem, "pasteRegex"),
			minValue:		readAttribute(elem, "minValue"),
			maxValue:		readAttribute(elem, "maxValue"),
			isDownloadVar:	readAttributeBoolean(elem, "isDownloadVar", true),
		};

		addIt(setting, elem.nodeName);
	}

	addIt(
	{
		name: "uploadDelaySecs",
		type: "integer",
		defaultValue: "0",
		text: "Delay",
		accesskey: "D",
		tooltiptext: "Wait this many seconds before uploading/saving the torrent. Default is 0.",
		isDownloadVar: false,
		minValue: "0",
	});
	addIt(
	{
		name: "forceHttps",
		type: "bool",
		defaultValue: "false",
		text: "Force HTTPS (SSL) downloads",
		accesskey: "F",
		tooltiptext: "If checked, all torrent file downloads from this tracker will be forced to use the HTTPS protocol. Not all trackers support this.",
		isDownloadVar: false,
	});

	return rv;
}

TrackerXmlReader.prototype.initializeSetting =
function(setting, elemName)
{
	function setProp(name, value)
	{
		if (setting[name] === undefined)
			setting[name] = value;
	}	

	if (elemName === "gazelle_description")
	{
		setProp("type", "description");
		setProp("text", "Paste (Ctrl+V) any " + this.tracker.longName + " torrent download link into any one of the two text boxes below to automatically extract authkey and torrent_pass.");
	}
	else if (elemName === "gazelle_authkey")
	{
		setProp("type", "textbox");
		setProp("name", "authkey");
		setProp("text", "authkey");
		setProp("accesskey", "h");
		setProp("emptytext", this.tracker.longName + " " + setting.name);
		setProp("tooltiptext", "The authkey in any " + this.tracker.longName + " torrent download link.");
		setProp("pasteGroup", "authkey,torrent_pass");
		setProp("pasteRegex", "[\\?&]authkey=([\\da-zA-Z]{32})");
	}
	else if (elemName === "gazelle_torrent_pass")
	{
		setProp("type", "textbox");
		setProp("name", "torrent_pass");
		setProp("text", "torrent_pass");
		setProp("accesskey", "r");
		setProp("emptytext", this.tracker.longName + " " + setting.name);
		setProp("tooltiptext", "The torrent_pass in any " + this.tracker.longName + " torrent download link.");
		setProp("pasteGroup", "authkey,torrent_pass");
		setProp("pasteRegex", "[\\?&]torrent_pass=([\\da-zA-Z]{32})");
	}
	else if (elemName === "description")
	{
		setProp("type", "description");
	}
	else if (elemName === "authkey")
	{
		setProp("type", "textbox");
		setProp("name", "authkey");
		setProp("text", "authkey");
		setProp("accesskey", "h");
		setProp("emptytext", this.tracker.longName + " " + setting.name);
		setProp("tooltiptext", "The authkey in any " + this.tracker.longName + " torrent download link.");
		setProp("pasteGroup", "authkey");
		setProp("pasteRegex", "[\\?&]authkey=([\\da-fA-F]{32})");
	}
	else if (elemName === "passkey")
	{
		setProp("type", "textbox");
		setProp("name", "passkey");
		setProp("text", "passkey");
		setProp("accesskey", "p");
		setProp("emptytext", this.tracker.longName + " passkey");
		setProp("tooltiptext", "The passkey in any " + this.tracker.longName + " torrent download link.");
		setProp("pasteGroup", "passkey");
		setProp("pasteRegex", "[\\?&]passkey=([\\da-fA-F]{32})");
	}
	else if (elemName === "cookie_description")
	{
		setProp("type", "description");
		setProp("text", "Go to the tracker and write javascript:document.innerHTML=document.cookie in the address bar and press enter. Select all and copy everything then paste it (Ctrl+V) in the text box below.");
	}
	else if (elemName === "cookie")
	{
		setProp("type", "textbox");
		setProp("name", "cookie");
		setProp("text", "Cookie");
		setProp("accesskey", "C");
		setProp("emptytext", this.tracker.longName + " " + setting.name);
		setProp("tooltiptext", "The " + this.tracker.longName + " cookie.");
	}
	else if (elemName === "integer")
	{
		setProp("type", "integer");
		setProp("minValue", "-999999999");
	}
	else if (elemName === "delta")
	{
		setProp("type", "integer");
		setProp("name", "delta");
		setProp("text", "Torrent ID delta");
		setProp("accesskey", "d");
		setProp("minValue", "-999999999");
	}
	else if (elemName === "textbox")
	{
		setProp("type", "textbox");
		setProp("emptytext", this.tracker.longName + " " + setting.name);
	}

	if (setting.pasteRegex)
		setting.pasteRegex = new RegExp(setting.pasteRegex);

	switch (setting.type)
	{
	case "bool":
		if (!setting.name) throw "Invalid bool setting.name";
		if (!setting.text) throw "Invalid bool setting.text";
		if (!setting.accesskey) throw "Invalid bool setting.accesskey";
		if (!setting.tooltiptext) throw "Invalid bool setting.tooltiptext";
		break;

	case "textbox":
		if (!setting.name) throw "Invalid textbox setting.name";
		if (!setting.text) throw "Invalid textbox setting.text";
		if (!setting.accesskey) throw "Invalid textbox setting.accesskey";
		if (!setting.emptytext) throw "Invalid textbox setting.emptytext";
		if (!setting.tooltiptext) throw "Invalid textbox setting.tooltiptext";
		break;

	case "integer":
	case "delta":
		if (!setting.name) throw "Invalid integer setting.name";
		if (!setting.text) throw "Invalid integer setting.text";
		if (!setting.accesskey) throw "Invalid integer setting.accesskey";
		if (!setting.tooltiptext) throw "Invalid integer setting.tooltiptext";
		break;

	case "description":
		if (!setting.text) throw "Invalid description setting.text";
		break;

	default:
		throw "Unknown tracker setting: " + setting.type;
	}
}

TrackerXmlReader.prototype.parseServers =
function(trackerinfo)
{
	var servers = getTheTag(trackerinfo, "servers");
	var children = getChildElementsByTagName(servers, "server");
	if (children.length === 0) throw "No servers children found";

	var rv = [];

	for (var i = 0; i < children.length; i++)
	{
		var elem = children[i];

		var network = readAttribute(elem, "network", "");
		var serverNames = readAttribute(elem, "serverNames", "");
		var channelNames = readAttribute(elem, "channelNames");
		var announcerNames = readAttribute(elem, "announcerNames");

		if (!channelNames) throw "Invalid server.channelNames";
		if (!announcerNames) throw "Invalid server.announcerNames";

		var ary = serverNames.split(",");
		for (var i = 0; i < ary.length; i++)
		{
			ary[i] = canonicalizeServerName(stringTrim(ary[i]));
		}
		if (network)
			ary.push(canonicalizeNetworkName(network));
		for (var i = 0; i < ary.length; i++)
		{
			var serverName = ary[i];
			if (!serverName)
				continue;

			var server =
			{
				serverName:		serverName,
				channelNames:	channelNames,
				announcerNames:	announcerNames,
			};

			rv.push(server);
		}
	}

	return rv;
}

TrackerXmlReader.prototype.parseParseInfo =
function(trackerinfo)
{
	var parseinfo = getTheTag(trackerinfo, "parseinfo");

	var rv = {};

	rv.linepatterns = this.parseLinePatterns(parseinfo);
	rv.multilinepatterns = this.parseMultiLinePatterns(parseinfo);
	rv.linematched = this.parseLineMatched(parseinfo);
	rv.ignore = this.parseIgnore(parseinfo);

	if (!rv.linepatterns && !rv.multilinepatterns)
		throw "Invalid parseinfo, missing line patterns";

	return rv;
}

TrackerXmlReader.prototype.parseLinePatterns =
function(parseinfo)
{
	try
	{
		var linepatterns = getTheTag(parseinfo, "linepatterns");
	}
	catch (ex)
	{
		return;
	}
	var children = getChildElementsByTagName(linepatterns, "extract");
	if (children.length === 0) throw "No linepatterns children found";

	return this.parseLinePatternsInternal(children);
}

TrackerXmlReader.prototype.parseMultiLinePatterns =
function(parseinfo)
{
	try
	{
		var multilinepatterns = getTheTag(parseinfo, "multilinepatterns");
	}
	catch (ex)
	{
		return;
	}
	var children = getChildElementsByTagName(multilinepatterns, "extract");
	if (children.length === 0) throw "No multilinepatterns children found";

	return this.parseLinePatternsInternal(children);
}

TrackerXmlReader.prototype.parseLinePatternsInternal =
function(children)
{
	var rv = [];

	for (var i = 0; i < children.length; i++)
		rv.push(this.parseExtractElem(children[i]));

	return rv;
}

TrackerXmlReader.prototype.parseRegex =
function(regexElem)
{
	var regexInfo =
	{
		regex:		readAttribute(regexElem, "value"),
		expected:	readAttributeBoolean(regexElem, "expected", true),
	};
	if (regexInfo.regex === undefined)
		return undefined;
	regexInfo.regex = new RegExp(regexInfo.regex);
	return regexInfo;
}

TrackerXmlReader.prototype.parseExtractElem =
function(extractElem)
{
	var ary = getChildElementsByTagName(extractElem, "regex");
	if (ary.length !== 1) throw "Invalid extract regex";
	var regexElem = ary[0];

	var ary = getChildElementsByTagName(extractElem, "vars");
	if (ary.length !== 1) throw "Invalid extract vars";
	var varsElem = ary[0];
	var vars = [];
	var ary = getChildElementsByTagName(varsElem, "var");
	for (var j = 0; j < ary.length; j++)
	{
		var varElem = ary[j];
		var name = readAttribute(varElem, "name");
		if (!name) throw "Invalid var.name";
		vars.push(name);
	}

	var extract =
	{
		optional:	readAttributeBoolean(extractElem, "optional", false),
		regexInfo:	this.parseRegex(regexElem),
		vars:		vars,
		srcvar:		readAttribute(extractElem, "srcvar"),
	};
	if (!extract.regexInfo) throw "Invalid extract.regex";
	if (!extract.vars) throw "Invalid extract.vars";
	return extract;
}

TrackerXmlReader.prototype.parseSetVarIf =
function(setvarifElem)
{
	var setvarif =
	{
		varName:	readAttribute(setvarifElem, "varName"),
		value:		readAttribute(setvarifElem, "value"),
		regex:		readAttribute(setvarifElem, "regex"),
		newValue:	readAttribute(setvarifElem, "newValue"),
	};

	if (setvarif.varName === undefined) throw "Invalid setvarif.varName";
	if (setvarif.value === undefined && setvarif.regex === undefined) throw "Invalid setvarif.value/regex";

	if (setvarif.regex !== undefined)
		setvarif.regex = new RegExp(setvarif.regex, "i");

	return setvarif;
}

TrackerXmlReader.prototype.parseVarreplace =
function(varreplaceElem)
{
	var varreplace =
	{
		name:		readAttribute(varreplaceElem, "name"),
		srcvar:		readAttribute(varreplaceElem, "srcvar"),
		regex:		readAttribute(varreplaceElem, "regex"),
		replace:	readAttribute(varreplaceElem, "replace"),
	};

	if (varreplace.name === undefined) throw "Invalid varreplace.name";
	if (varreplace.srcvar === undefined) throw "Invalid varreplace.srcvar";
	if (varreplace.regex === undefined) throw "Invalid varreplace.regex";
	if (varreplace.replace === undefined) throw "Invalid varreplace.replace";

	return varreplace;
}

TrackerXmlReader.prototype.parseSetregex =
function(setregexElem)
{
	var setregex =
	{
		srcvar:		readAttribute(setregexElem, "srcvar"),
		regex:		readAttribute(setregexElem, "regex"),
		varName:	readAttribute(setregexElem, "varName"),
		newValue:	readAttribute(setregexElem, "newValue"),
	};

	if (setregex.srcvar === undefined) throw "Invalid setregex.srcvar";
	if (setregex.regex === undefined) throw "Invalid setregex.regex";
	if (setregex.varName === undefined) throw "Invalid setregex.varName";
	if (setregex.newValue === undefined) throw "Invalid setregex.newValue";

	return setregex;
}

TrackerXmlReader.prototype.parseIf =
function(ifElem)
{
	var if_ =
	{
		srcvar:		readAttribute(ifElem, "srcvar"),
		regex:		readAttribute(ifElem, "regex"),
	};

	if (if_.srcvar === undefined) throw "Invalid if.srcvar";
	if (if_.regex === undefined) throw "Invalid if.regex";

	if_.children = this.parseLineMatchedInternal(ifElem);
	if_.regex = new RegExp(if_.regex, "i");

	return if_;
}

TrackerXmlReader.prototype.parseIgnore =
function(parseinfo)
{
	var ignore = getTheTag(parseinfo, "ignore");
	var children = getChildElementsByTagName(ignore, "regex");

	var rv = [];

	for (var i = 0; i < children.length; i++)
	{
		var regexInfo = this.parseRegex(children[i]);
		if (regexInfo === undefined) throw "Invalid ignore regex";
		rv.push(regexInfo);
	}

	return rv;
}

TrackerXmlReader.prototype.parseLineMatched =
function(parseinfo)
{
	var linematched = getTheTag(parseinfo, "linematched");
	return this.parseLineMatchedInternal(linematched);
}

TrackerXmlReader.prototype.parseLineMatchedInternal =
function(root)
{
	var children = getChildElements(root);

	var rv = [];

	for (var i = 0; i < children.length; i++)
	{
		var elem = children[i];

		var obj = {};

		if (elem.nodeName === "var" || elem.nodeName === "http")
		{
			obj.type = elem.nodeName;
			obj.name = readAttribute(elem, "name");
			if (!obj.name) throw "Invalid " + elem.nodeName + ".name";

			obj.vars = [];
			var varChildren = getChildElements(elem);

			for (var j = 0; j < varChildren.length; j++)
			{
				var childElem = varChildren[j];

				if (childElem.nodeName === "var")
				{
					var name = readAttribute(childElem, "name");
					if (!name) throw "Invalid var.name";
					obj.vars.push({ type: "var", name: name });
				}
				else if (childElem.nodeName === "varenc")
				{
					var name = readAttribute(childElem, "name");
					if (!name) throw "Invalid varenc.name";
					obj.vars.push({ type: "varenc", name: name });
				}
				else if (childElem.nodeName === "string")
				{
					var value = readAttribute(childElem, "value");
					if (value === undefined) throw "Invalid string.value";
					obj.vars.push({ type: "string", value: value });
				}
				else if (childElem.nodeName === "delta")
				{
					var idName = readAttribute(childElem, "idName");
					if (!idName) throw "Invalid delta.idName";
					var deltaName = readAttribute(childElem, "deltaName");
					if (!deltaName) throw "Invalid delta.deltaName";
					obj.vars.push({ type: "delta", name1: idName, name2: deltaName });
				}
				else
					throw "Invalid tag " + childElem.nodeName;
			}
		}
		else if (elem.nodeName === "extract")
		{
			obj.type = "extract";
			obj.extract = this.parseExtractElem(elem);
		}
		else if (elem.nodeName === "extractone")
		{
			obj.type = "extractone";
			obj.ary = [];
			var childElems = getChildElementsByTagName(elem, "extract");
			for (var j = 0; j < childElems.length; j++)
				obj.ary.push(this.parseExtractElem(childElems[j]));
		}
		else if (elem.nodeName === "extracttags")
		{
			obj.type = "extracttags";

			obj.srcvar = readAttribute(elem, "srcvar");
			obj.split = readAttribute(elem, "split");
			if (obj.srcvar === undefined) throw "Invalid extracttags.srcvar";
			if (obj.split === undefined) throw "Invalid extracttags.split";

			obj.ary = [];
			var childElems = getChildElementsByTagName(elem, "setvarif");
			for (var j = 0; j < childElems.length; j++)
				obj.ary.push(this.parseSetVarIf(childElems[j]));

			obj.regexIgnore = [];
			var childElems = getChildElementsByTagName(elem, "regex");
			for (var j = 0; j < childElems.length; j++)
			{
				var regexInfo = this.parseRegex(childElems[j]);
				if (regexInfo === undefined) throw "Invalid extracttags ignore regex";
				obj.regexIgnore.push(regexInfo);
			}
		}
		else if (elem.nodeName === "varreplace")
		{
			obj.type = "varreplace";
			obj.varreplace = this.parseVarreplace(elem);
		}
		else if (elem.nodeName === "setregex")
		{
			obj.type = "setregex";
			obj.setregex = this.parseSetregex(elem);
		}
		else if (elem.nodeName === "if")
		{
			obj.type = "if";
			obj.if_ = this.parseIf(elem);
		}
		else
			throw "Invalid tag " + elem.nodeName;

		rv.push(obj);
	}

	return rv;
}

// Should be the last statement in the file to indicate it loaded successfully
true;
