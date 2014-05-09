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

function MultiLineParser(announcerName)
{
	this.announcerName = announcerName;
	this.announces = [];
	this.regexLines = [];
	this.optional = [];
}

// Announces older than this are removed
MultiLineParser.MAX_AGE_IN_MS = 15000;

MultiLineParser.prototype.addLineRegex =
function(regex, optional)
{
	this.regexLines.push(regex);
	this.optional.push(optional);
}

MultiLineParser.prototype.getLineNumber =
function(line)
{
	for (var i = 0; i < this.regexLines.length; i++)
	{
		if (line.match(this.regexLines[i]))
			return i;
	}

	return null;
}

MultiLineParser.prototype.getAnnounceIndex =
function(lineNo)
{
	if (lineNo === 0)
	{
		var index = this.announces.length;
		this.announces.push(
		{
			time: newDate(),
			lines: [],
		});
		return index;
	}

	// If the bot announces two or more different releases at the same time, it's possible that
	// release #2's 2nd line is announced before release #1's 2nd line. There's nothing we can
	// do about that.
	for (var i = 0; i < this.announces.length; i++)
	{
		for (var j = this.announces[i].lines.length; j < this.optional.length; j++)
		{
			if (j === lineNo)
				return i;
			if (this.optional[j] === false)
				break;
		}
	}

	return null;
}

MultiLineParser.prototype.removeOld =
function()
{
	var time = newDate();

	for (var i = 0; i < this.announces.length; i++)
	{
		var announce = this.announces[i];
		var age = time - announce.time;
		if (age <= MultiLineParser.MAX_AGE_IN_MS)
			continue;

		dmessage(0, this.announcerName + ": Deleting old announcer lines", MT_ERROR);
		this.announces.splice(i, 1);
		i--;
	}
}

MultiLineParser.prototype.addLine =
function(line)
{
	this.removeOld();

	var lineNumber = this.getLineNumber(line);
	if (lineNumber === null)
		return false;
	var index = this.getAnnounceIndex(lineNumber);
	if (index === null)
		return false;
	for (var i = this.announces[index].lines.length; i < lineNumber; i++)
		this.announces[index].lines.push(null);
	this.announces[index].lines.push(line);

	if (this.regexLines.length - 1 !== lineNumber)
		return true;

	return this.announces.shift();
}

function AnnounceParser(tracker)
{
	this.tracker = tracker;

	if (this.tracker.parseInfo.multilinepatterns)
	{
		this.multiLineParser = new MultiLineParser(this.getTrackerName());
		var multilinepatterns = this.tracker.parseInfo.multilinepatterns;
		for (var i = 0; i < multilinepatterns.length; i++)
			this.multiLineParser.addLineRegex(multilinepatterns[i].regexInfo.regex, multilinepatterns[i].optional);
	}
}

AnnounceParser.prototype.getTrackerName =
function()
{
	return this.tracker.longName;
}

AnnounceParser.prototype.shouldIgnoreLine =
function(line)
{
	var ignore = this.tracker.parseInfo.ignore;
	for (var i = 0; i < ignore.length; i++)
	{
		if (!!line.match(ignore[i].regex) === ignore[i].expected)
			return true;
	}

	return false;
}

AnnounceParser.prototype.onNewLine =
function(line)
{
	var origLine = line;
	line = removeInvisibleChars(line);
	line = stripMircColorCodes(line);
	line = decodeHtmlEntities(line);

	var ti =
	{
		category: "",
		torrentName: "",
		uploader: "",
		torrentSize: "",
		preTime: "",
		torrentUrl: "",
		torrentSslUrl: "",
		year: "",
		name1: "",		// artist, show, movie
		name2: "",		// album
		season: "",
		episode: "",
		resolution: "",
		source: "",
		encoder: "",
		format: "",
		bitrate: "",
		media: "",
		tags: "",
		scene: "",
		log: "",
		cue: "",
		line: line,
		origLine: origLine,
		site: this.tracker.siteName,
		httpHeaders: {},
		tracker: this.tracker,
	};

	try
	{
		if (plugin.options.debug)
			this.lastLine = line;

		if (this.tracker.parseInfo.linepatterns)
			var rv = this.parseSingleLine(line, ti);
		else
			var rv = this.parseMultiLine(line, ti);

		if (rv === true)
			return ti;
		return false;
	}
	catch (ex)
	{
		message(0, "Got exception in onNewLine: " + formatException(ex), MT_ERROR)
		return false;
	}
}

AnnounceParser.prototype.parseSingleLine =
function(line, ti)
{
	var linepatterns = this.tracker.parseInfo.linepatterns;
	for (var i = 0; i < linepatterns.length; i++)
	{
		var extractInfo = linepatterns[i];
		var ary = line.match(extractInfo.regexInfo.regex)
		if (ary)
		{
			var tempVariables = {};
			this.extractMatched(extractInfo, ary, ti, tempVariables);
			this.onAllLinesMatched(ti, tempVariables);
			return true;
		}
	}

	if (!this.shouldIgnoreLine(line))
	{
		dmessage(0, this.getTrackerName() + ": did not match line '" + line + "'", MT_ERROR);
		return false;
	}
	return true;
}

AnnounceParser.prototype.parseMultiLine =
function(line, ti)
{
	var rv = this.multiLineParser.addLine(line);
	if (rv === true)
		return true;
	if (rv === false)
	{
		if (this.multiLineParser.getLineNumber(line) === null && !this.shouldIgnoreLine(line))
		{
			dmessage(0, this.getTrackerName() + ": did not match line '" + line + "'", MT_ERROR);
			return false;
		}
		return true;
	}

	var tempVariables = {};
	var multilinepatterns = this.tracker.parseInfo.multilinepatterns;
	for (var i = 0; i < multilinepatterns.length; i++)
	{
		var extractInfo = multilinepatterns[i];
		line = rv.lines[i];
		if (line === null)
			continue;	// Optional line
		var ary = line.match(extractInfo.regexInfo.regex);
		this.extractMatched(extractInfo, ary, ti, tempVariables);
	}
	this.onAllLinesMatched(ti, tempVariables);
	return true;
}

AnnounceParser.prototype.extractMatched =
function(extractInfo, ary, ti, tempVariables)
{
	if (ary.length - 1 !== extractInfo.vars.length)
	{
		message(0, this.getTrackerName() + ": invalid extractInfo.vars.length", MT_ERROR);
		return;
	}

	for (var i = 0; i < extractInfo.vars.length; i++)
	{
		var value = ary[i + 1] || "";
		value = stringTrim(value);
		this.setVariable(extractInfo.vars[i], value, ti, tempVariables);
	}
}

AnnounceParser.prototype.setVariable =
function(varName, value, ti, tempVariables)
{
	if (!value)
		value = "";

	if (varName in ti)
		ti[varName] = value;
	else
		tempVariables[varName] = value;
}

AnnounceParser.prototype.getVariable =
function(varName, ti, tempVariables)
{
	var rv, trackerOptions;

	if (varName in ti)
		rv = ti[varName];
	else if (varName in (trackerOptions = getTrackerOptions(this.tracker.type)))
		rv = trackerOptions[varName].toString();
	else
		rv = tempVariables[varName];

	return rv || "";
}

AnnounceParser.prototype.handleExtractInfo =
function(ti, tempVariables, extractInfo)
{
	var value = this.getVariable(extractInfo.srcvar, ti, tempVariables);

	var ary;
	if (!(ary = value.match(extractInfo.regexInfo.regex)))
		return false;

	this.extractMatched(extractInfo, ary, ti, tempVariables);
	return true;
}

AnnounceParser.prototype.postProcess =
function(ti, tempVariables, children)
{
	for (var i = 0; i < children.length; i++)
	{
		var obj = children[i];
		if (obj.type === "var" || obj.type === "http")
		{
			this.onVarOrHttp(obj, ti, tempVariables);
		}
		else if (obj.type === "extract")
		{
			if (!this.handleExtractInfo(ti, tempVariables, obj.extract) && obj.extract.optional === false)
				message(0, "extract: Did not match regex: " + obj.extract.regexInfo.regex + ", varName: '" + obj.extract.srcvar + "'", MT_ERROR);
		}
		else if (obj.type === "extractone")
		{
			var extracted = false;
			for (var j = 0; j < obj.ary.length; j++)
			{
				if (this.handleExtractInfo(ti, tempVariables, obj.ary[j]))
				{
					extracted = true;
					break;
				}
			}
			if (!extracted)
				message(0, "extractone: Did not match any regex.", MT_ERROR);
		}
		else if (obj.type === "extracttags")
		{
			this.handleExtractTags(ti, tempVariables, obj);
		}
		else if (obj.type === "varreplace")
		{
			this.handleVarreplace(ti, tempVariables, obj);
		}
		else if (obj.type === "setregex")
		{
			this.handleSetregex(ti, tempVariables, obj);
		}
		else if (obj.type === "if")
		{
			this.handleIf(ti, tempVariables, obj);
		}
		else
			throw "Invalid obj.type: " + obj.type;
	}
}

// Deobfuscate an FTN obfuscated string
function ftnDeobfuscate(ob)
{
	function simpleFix(s, fixedChars)
	{
		var rv = "";
		for (var i = 0; i < s.length; i++)
		{
			var fixed = true;
			switch (s[i])
			{
			case "0": rv += "O"; break;
			case "O": rv += "0"; break;
			case "I": rv += "1"; break;
			default:  rv += s[i]; fixed = false; break;
			}
			if (fixed)
				fixedChars[i] = true;
		}
		return rv;
	}

	var words = stringTrim(ob.replace(/[^a-zA-Z\d]/g, " ")).split(/\s+/);
	for (var i = 0; i < words.length; i++)
	{
		var fixedChars = {};
		var word = simpleFix(words[i], fixedChars);

		var numUppercase = word.replace(/[^A-Z]/g, "").length;
		var numLowercase = word.replace(/[^a-z]/g, "").length;

		// 1 should be converted to l or I
		var newWord = "", c;
		for (var j = 0; j < word.length; j++)
		{
			if (fixedChars[j] || word[j] !== "1")
				c = word[j];
			// if it's the beginning of a word, convert to I
			else if (j === 0)
				c = "I";
			// if most chars are uppercase, convert to I
			else if (numUppercase > numLowercase)
				c = "I";
			// if most chars are lowercase, convert to l
			else if (numUppercase < numLowercase)
				c = "l";
			else
				c = "l";
			newWord += c;
		}

		words[i] = newWord;
	}
	return words.join(" ");
}

AnnounceParser.prototype.onAllLinesMatched =
function(ti, tempVariables)
{
	ti.tracker.announceInfo.gotAnnouncement();
	ti.torrentName = stringTrim(ti.torrentName);

	this.postProcess(ti, tempVariables, this.tracker.parseInfo.linematched);

	// Some trackers are "secret" so we can't use their names or domain names.
	if (ti.site.length === 0)
	{
		var ary = ti.torrentUrl.match(/:\/\/([^\/:]*)/);
		if (ary)
			ti.site = ary[1];
	}

	if (ti.tracker.deobfuscate === "ftn")
		ti.torrentName = ftnDeobfuscate(ti.torrentName);
	extractReleaseNameInfo(ti, ti.torrentName);

	ti.torrentSize = convertToByteSizeString(convertByteSizeString(ti.torrentSize)) || "";
	ti.preTime = convertToTimeSinceString(convertTimeSinceString(ti.preTime)) || "";

	function canonicalizeIt(name, ary)
	{
		name = name.toLowerCase();
		for (var i = 0; i < ary.length; i++)
		{
			var ary2 = ary[i];
			for (var j = 0; j < ary2.length; j++)
			{
				if (name === ary2[j].toLowerCase())
					return ary2[0];
			}
		}

		return name;
	}
	ti.resolution = canonicalizeIt(ti.resolution, tvResolutions);
	ti.source = canonicalizeIt(ti.source, tvSources);
	ti.encoder = canonicalizeIt(ti.encoder, tvEncoders);

	ti.canonicalizedName = getCanonicalizedReleaseName(ti);

	var msg = "\x02\x0303" + this.getTrackerName() + "\x03\x02";
	function dumpVars(base)
	{
		for (var o in base)
		{
			var v = base[o];
			if (v === undefined || (typeof v === "string" && v.length === 0) || typeof v === "object")
				continue;
			if (o === "line" || o === "origLine")
				continue;
			msg += " : \x02\x0312" + o + "\x03\x02: '\x02\x0304" + v + "\x03\x02'";
		}
	}
	dumpVars(ti);
	dumpVars(tempVariables);
	dumpVars(ti.httpHeaders);
	message(5, msg, MT_STATUS);
}

AnnounceParser.prototype.handleExtractTags =
function(ti, tempVariables, obj)
{
	var varValue = this.getVariable(obj.srcvar, ti, tempVariables);
	var ary = varValue.split(obj.split);
	for (var i = 0; i < ary.length; i++)
	{
		var tagName = stringTrim(ary[i]);
		if (tagName.length === 0)
			continue;

		var hasSetVar = false;
		for (var j = 0; j < obj.ary.length; j++)
		{
			var setvarifInfo = obj.ary[j];
			hasSetVar = this.handleSetvarifInfo(ti, tempVariables, setvarifInfo, tagName);
			if (hasSetVar)
				break;
		}

		// Report unknown tags if debug is true
		if (plugin.options.debug && !hasSetVar)
		{
			for (var j = 0; j < obj.regexIgnore.length; j++)
			{
				if (!!tagName.match(obj.regexIgnore[j].regex) === obj.regexIgnore[j].expected)
					break;
			}
			if (j === obj.regexIgnore.length)
				message(0, "extracttags: Unknown tag '" + tagName + "', site: " + ti.tracker.longName + ", lastLine: '" + this.lastLine + "'", MT_ERROR);
		}
	}
}

AnnounceParser.prototype.handleVarreplace =
function(ti, tempVariables, obj)
{
	var varreplace = obj.varreplace;
	var srcvar = this.getVariable(varreplace.srcvar, ti, tempVariables);
	var newValue = srcvar.replace(new RegExp(varreplace.regex, "g"), varreplace.replace);
	this.setVariable(varreplace.name, newValue, ti, tempVariables);
}

AnnounceParser.prototype.handleSetregex =
function(ti, tempVariables, obj)
{
	var setregex = obj.setregex;
	var srcvar = this.getVariable(setregex.srcvar, ti, tempVariables);
	var ary = srcvar.match(new RegExp(setregex.regex, "i"));
	if (ary)
		this.setVariable(setregex.varName, setregex.newValue, ti, tempVariables);
}

AnnounceParser.prototype.handleIf =
function(ti, tempVariables, obj)
{
	var if_ = obj.if_;
	var srcvar = this.getVariable(if_.srcvar, ti, tempVariables);
	var ary = srcvar.match(if_.regex);
	if (ary)
		this.postProcess(ti, tempVariables, if_.children);
}

AnnounceParser.prototype.handleSetvarifInfo =
function(ti, tempVariables, setvarifInfo, tagName)
{
	if (setvarifInfo.value !== undefined)
	{
		if (setvarifInfo.value.toLowerCase() !== tagName.toLowerCase())
			return false;
	}
	else
	{
		if (!tagName.match(setvarifInfo.regex))
			return false;
	}

	var newValue = setvarifInfo.newValue || tagName;
	this.setVariable(setvarifInfo.varName, newValue, ti, tempVariables);
	return true;
}

AnnounceParser.prototype.onVarOrHttp =
function(obj, ti, tempVariables)
{
	var newValue = "";
	for (var i = 0; i < obj.vars.length; i++)
	{
		var o = obj.vars[i];
		switch (o.type)
		{
		case "var":
			newValue += this.getVariable(o.name, ti, tempVariables);
			break;

		case "varenc":
			// Replace invalid chars or the download could fail
			var value = this.getVariable(o.name, ti, tempVariables).replace(/[\/\\]/g, "_");
			newValue += toUrlEncode(value);
			break;

		case "string":
			newValue += o.value;
			break;

		case "delta":
			newValue += parseInt(this.getVariable(o.name1, ti, tempVariables), 10) + parseInt(this.getVariable(o.name2, ti, tempVariables), 10);
			break;

		default:
			throw "Invalid o.type: " + o.type;
		}
	}

	if (obj.type === "http")
		ti.httpHeaders[obj.name] = newValue;
	else
		this.setVariable(obj.name, newValue, ti, tempVariables);
}

plugin.announceParsers = {};
function parseAnnounceLine(tracker, line)
{
	var parser = plugin.announceParsers[tracker.type];
	if (!parser)
	{
		message(0, "Could not find parser for tracker " + tracker.type, MT_ERROR);
		return false;
	}

	return parser.onNewLine(line);
}

function extractReleaseNameInfo(out, releaseName)
{
	function canonicalize(s)
	{
		return s.replace(/[^a-zA-Z0-9]/g, " ");
	}
	
	function setVariable(name, value)
	{
		if (!out[name])
			out[name] = value;
	}

	var data;

	var canonReleaseName = canonicalize(releaseName);

	function findLast(s, regex)
	{
		var rv = {};
		for (var indexBase = 0; s; )
		{
			var ary = s.match(regex);
			if (!ary)
				break;

			rv.index = indexBase + ary.index;
			rv.value = ary[1];
			var skipChars = ary.index + ary[0].length;
			indexBase += skipChars;
			s = s.substr(skipChars);
		}

		if (rv.index === undefined)
			return null;
		return rv;
	}

	var indexYear;
	if (data = findLast(canonReleaseName, /(?:^|\D)(19[3-9]\d|20[01]\d)(?:\D|$)/))
	{
		indexYear = data.index;
		setVariable("year", data.value);
	}

	var indexSeason;
	if ((data = findLast(canonReleaseName, /\sS(\d+)\s?[ED]\d+/i)) ||
		(data = findLast(canonReleaseName, /\s(?:S|Season\s*)(\d+)/i)) ||
		(data = findLast(canonReleaseName, /\s(\d+)x\d+/i)))
	{
		indexSeason = data.index;
		setVariable("season", parseInt(data.value, 10).toString());
	}

	var indexEpisode;
	if ((data = findLast(canonReleaseName, /\sS\d+\s?E(\d+)/i)) ||
		(data = findLast(canonReleaseName, /\s(?:E|Episode\s*)(\d+)/i)) ||
		(data = findLast(canonReleaseName, /\s\d+x(\d+)/i)))
	{
		indexEpisode = data.index;
		setVariable("episode", parseInt(data.value, 10).toString());
	}

	// Year month day must be part of canonicalized name if it's present.
	var indexYmd;
	if (data = findLast(canonReleaseName, /(?:^|\D)((?:19[3-9]\d|20[01]\d)\s\d{1,2}\s\d{1,2})(?:\D|$)/))
	{
		indexYmd = data.index;
		setVariable("ymd", data.value);
	}

	var startIndex = my_max(0, indexSeason, indexEpisode, indexYmd);
	function find(aryStrings, isCaseSensitive)
	{
		var rv =
		{
			index: 99999999999,
			value: "",
		};

		var regexFlags = isCaseSensitive ? "" : "i";
		for (var i = 0; i < aryStrings.length; i++)
		{
			var strings = aryStrings[i];
			for (var j = 0; j < strings.length; j++)
			{
				var searchString = strings[j];
				searchString = canonicalize(searchString);
				var ary = findLast(canonReleaseName, new RegExp("\\s" + searchString + "(?:\\s|$)", regexFlags));
				if (ary && ary.index >= startIndex && ary.index < rv.index)
				{
					rv.index = ary.index;
					rv.value = strings[j];
				}
			}
		}

		if (rv.value)
			return rv;
		return null;
	}

	var indexResolution;
	if (data = find(tvResolutions))
	{
		indexResolution = data.index;
		out.resolution = data.value;
	}

	var indexSource;
	if (data = find(tvSources))
	{
		indexSource = data.index;
		out.source = data.value;
	}

	var indexEncoder;
	if (data = find(tvEncoders))
	{
		indexEncoder = data.index;
		out.encoder = data.value;
	}

	var indexIgnore;
	if ((data = find(otherReleaseNameStuff, true)) ||
		(data = find(otherReleaseNameStuffLowerCase, true)))
	{
		indexIgnore = data.index;
	}

	// Some MP3 releases contain the tag "WEB"
	var isTvOrMovie = !!(out.resolution || (out.source && out.source.toLowerCase() !== "web") ||
						out.encoder || out.season || out.episode);

	if (isTvOrMovie)
	{
		if (out.source)
		{
			var source = out.source.toLowerCase();
			if (source === "dsr" || source === "pdtv" || source === "hdtv" || source === "hr.pdtv" ||
				source === "hr.hdtv" || source === "dvdrip" || source === "dvdscr" || source === "tvrip" ||
				source === "cam" || source === "telesync" || source === "ts" || source === "telecine" ||
				source === "tc" || source === "brrip" || source === "bdrip")
			{
				setVariable("encoder", "XviD");
			}
			else if (source === "hddvd" || source === "hd-dvd" || source === "bluray" ||
					source === "blu-ray")
			{
				setVariable("encoder", "x264");
				setVariable("resolution", "720p");
			}
			else if (source === "web-dl")
			{
				setVariable("encoder", "h.264");
				setVariable("resolution", "720p");
			}
		}

		// Don't use the year index if it's a TV show since the year may be part of the name.
		var yindex = indexYear;
		if (out.season || out.episode || (out.source && out.source.match(/HDTV|PDTV/i)))
		{
			if (!canonReleaseName.match(/(?:^|\D)(?:19[4-9]\d|20[01]\d)\s+\d\d\s+\d\d(?:\D|$)/))
				yindex = undefined;
		}
		var indexMin = my_min(indexResolution, indexSource, indexEncoder, indexIgnore,
							yindex, indexSeason, indexEpisode, indexYmd);

		var name1 = releaseName.substr(0, indexMin);
		name1 = name1.replace(/[^a-zA-Z0-9]/g, " ");
		name1 = name1.replace(/\s+/g, " ");
		name1 = stringTrim(name1);
		setVariable("name1", name1);
	}

	if (isTvOrMovie && !out.resolution)
		setVariable("resolution", "SD");
}

function getCanonicalizedReleaseName(ti)
{
	var rv;

	//TODO: This func also exists in plugin.checkFilter(). Both should use the same func.
	function removeExtraSpaces(s)
	{
		return stringTrim(s.replace(/\s+/g, " "));
	}

	var releaseName = ti.torrentName;

	if (USE_OLD_CANONICALIZED_RELEASENAME)
	{
		rv = canonicalizeReleaseName(releaseName);
	}
	// All TV shows and movies have a resolution
	else if (ti.resolution)
	{
		function addOne(s)
		{
			if (s)
				rv += "-" + s.toLowerCase();
		}
		rv = "";
		addOne(removeExtraSpaces(ti.name1.replace(/[\x00-\x1F\x21-\x2F\x3A-\x40\x5B-\x60\x7B-\x7F]+/g, "")));
		addOne(ti.season);
		addOne(ti.episode);
		addOne(ti.source);
		addOne(ti.encoder);
		addOne(ti.resolution);
		addOne(ti.ymd);

		var tags = otherReleaseNameStuff[0];
		for (var i = 0; i < tags.length; i++)
		{
			if (releaseName.match(new RegExp("(?:^|[^a-zA-Z\d])" + tags[i] + "(?:$|[^a-zA-Z\d])", "i")))
				addOne(tags[i]);
			else
				addOne("");
		}

		rv = "TV-" + rv;
	}
	else
	{
		rv = canonicalizeReleaseName(releaseName);
	}

	return rv;
}

function my_min()
{
	var rv;
	for (var i = 0; i < arguments.length; i++)
	{
		if (arguments[i] !== undefined && (rv === undefined || arguments[i] < rv))
			rv = arguments[i];
	}
	return rv;
}

function my_max()
{
	var rv;
	for (var i = 0; i < arguments.length; i++)
	{
		if (arguments[i] !== undefined && (rv === undefined || arguments[i] > rv))
			rv = arguments[i];
	}
	return rv;
}

var otherReleaseNameStuff =
[
	["SWEDISH", "SWEDiSH", "DUTCH", "FLEMISH", "FLEMiSH", "GERMAN", "SPANISH", "SPANiSH",
	"ICELANDIC", "iCELANDiC", "NORWEGIAN", "NORWEGiAN", "FINNISH", "FiNNiSH", "DANISH",
	"DANiSH", "NORDIC", "NORDiC", "POLiSH", "POLISH",
	"SE", "NO", "DK", "FI", "NL", "ENG", "PL", "RO",
	"SWESUB", "DKSubs", "DKSUBS", "MULTISUBS", "MULTiSUBS", "PLDUB", "NLSUBBED",
	"INTERNAL", "iNTERNAL", "PROPER", "REPACK", "LIMITED", "LiMiTED",
	"NTSC", "PAL", "CUSTOM", "iNTERNAL", "INTERNAL", "FS", "REAL",
	"R2", "WS", "iNT", "READ.NFO", "READNFO", "XXX", "STV", "REENCODE",
	"RERIP", "RERiP", "DISC1", "DISC2", "DISC3", "DISC4", "SCREENER",
	"DTS", "AC3", "DD5.1"],
];
var otherReleaseNameStuffLowerCase = [[]];
window.i = 0;
for (var i = 0; i < otherReleaseNameStuff[0].length; i++)
	otherReleaseNameStuffLowerCase[0].push(otherReleaseNameStuff[0][i].toLowerCase());
delete window.i;

// Should be the last statement in the file to indicate it loaded successfully
true;
