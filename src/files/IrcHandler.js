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

function getServerNetworkName(server)
{
	if (!server || !server.supports || !server.supports.network)
		return "";
	return server.supports.network;
}

// Called each time we get a PRIVMSG IRC command
plugin.onPrivmsg =
function(e)
{
	try
	{
		if (e.user === undefined || e.server === undefined)
			return true;

		var line = e.decodeParam(2);
		var networkName = getServerNetworkName(e.server);
		var serverName = e.server.hostname;
		var channelName = e.params[1];
		var userName = e.user.encodedName;

		this.onNewIrcLine(line, networkName, serverName, channelName, userName);
	}
	catch (ex)
	{
		message(0, "Got an exception: " + formatException(ex), MT_ERROR);
	}

	return true;
}

plugin.onNewIrcLine =
function(line, networkName, serverName, channelName, userName)
{
	var ti = this.handleNewAnnouncerLine(line, networkName, serverName, channelName, userName);
	if (!ti)
		return false;

	ti.uploadMethod = ti.filter.uploadMethod.overrideGlobal ? ti.filter.uploadMethod : this.options.uploadMethod;
	var forceHttps = readTrackerOption(ti.tracker, "forceHttps");
	this.downloadTorrent(ti, ti.torrentName + ".torrent", forceHttps);
	return true;
}

plugin.handleNewAnnouncerLine =
function(line, networkName, serverName, channelName, userName)
{
	var ary = this.findChannelParser(networkName, serverName, channelName, userName);
	if (!ary)
		return null;
	var server = ary[0];
	var tracker = ary[1].tracker;

	var ti = parseAnnounceLine(tracker, line);
	if (ti === false)
		return null;

	if (ti.torrentUrl.length === 0 || ti.torrentName.length === 0)
		return null;
	if (ti.torrentSslUrl.length === 0)
	{
		var ary = ti.torrentUrl.match(/^https?:\/\/([^:\/]*)(?::\d+)?(\/.*)/);
		if (ary)
			ti.torrentSslUrl = "https://" + ary[1] + ary[2];
		else
			ti.torrentSslUrl = ti.torrentUrl;
	}

	ti.filter = this.getFilterMatching(ti);
	if (!ti.filter)
		return null;

	var missing = this.checkRequiredTrackerOptionsPresent(ti);
	if (missing.length !== 0)
	{
		message(0, "Can't download '" + ti.torrentName + "'. Click Auto Downloader -> Trackers -> " + ti.tracker.longName + " and initialize " + missing + ".", MT_ERROR);
		return null;
	}

	return ti;
}

plugin.checkRequiredTrackerOptionsPresent =
function(ti)
{
	var settings = ti.tracker.settings;
	var missing = "";
	for (var i = 0; i < settings.length; i++)
	{
		var setting = settings[i];
		if (!setting.isDownloadVar)
			continue;

		var value = readTrackerOption(ti.tracker, setting.name);
		if ((typeof value === "string" && stringTrim(value).length === 0) ||
			(typeof value === "number" && isNaN(value)))
		{
			if (missing.length > 0)
				missing += ", ";
			missing += setting.name;
		}
	}

	return missing;
}

plugin.findServerInfo =
function(networkName, serverName)
{
	var server;

	server = this.servers[canonicalizeServerName(serverName)];
	if (server)
		return server;

	if (networkName)
	{
		server = this.servers[canonicalizeNetworkName(networkName)];
		if (server)
			return server;
	}

	return undefined;
}

plugin.findChannelParser =
function(networkName, serverName, channelName, announcerName)
{
	var server = this.findServerInfo(networkName, serverName);
	if (!server)
		return null;

	var channels = server.channels;
	for (var j = 0; j < channels.length; j++)
	{
		if (checkFilterStrings(channelName, channels[j].names) &&
			checkFilterStrings(announcerName, channels[j].announcerNames) &&
			channels[j].tracker.forceDisabled === false &&
			readTrackerOption(channels[j].tracker, "enabled") === true)
		{
			return [server, channels[j]];
		}
	}

	return null;
}

plugin.getFilterMatching =
function(ti)
{
	for (var i = 0; i < this.filters.length; i++)
	{
		if (this.checkFilter(ti, this.filters[i]))
			return this.filters[i];
	}

	return null;
}

plugin.checkFilter =
function(ti, filter)
{
	function shouldUse(s)
	{
		return s !== undefined && s.length > 0;
	}

	if (filter.enabled === false)
		return false;

	if (shouldUse(filter.matchReleases) && !checkFilterStrings(ti.torrentName, filter.matchReleases))
		return false;
	if (shouldUse(filter.exceptReleases) && checkFilterStrings(ti.torrentName, filter.exceptReleases))
		return false;

	if (shouldUse(filter.matchCategories) && !checkFilterStrings(ti.category, filter.matchCategories))
		return false;
	if (shouldUse(filter.exceptCategories) && checkFilterStrings(ti.category, filter.exceptCategories))
		return false;

	if (shouldUse(filter.matchUploaders) && !checkFilterStrings(ti.uploader, filter.matchUploaders))
		return false;
	if (shouldUse(filter.exceptUploaders) && checkFilterStrings(ti.uploader, filter.exceptUploaders))
		return false;

	if (shouldUse(filter.matchSites) && !this.checkSite(ti.tracker, filter.matchSites))
		return false;
	if (shouldUse(filter.exceptSites) && this.checkSite(ti.tracker, filter.exceptSites))
		return false;

	if (shouldUse(filter.years) && !this.checkFilterNumbers(ti.year, filter.years))
		return false;
	if (shouldUse(filter.seasons) && !this.checkFilterNumbers(ti.season, filter.seasons))
		return false;
	if (shouldUse(filter.episodes) && !this.checkFilterNumbers(ti.episode, filter.episodes))
		return false;

	if (shouldUse(filter.artists) && !this.checkName(ti.name1, filter.artists))
		return false;
	if (shouldUse(filter.albums) && !this.checkName(ti.name2, filter.albums))
		return false;

	if (shouldUse(filter.resolutions) && !this.checkArySynonyms(ti.resolution, filter.resolutions, tvResolutions))
		return false;
	if (shouldUse(filter.sources) && !this.checkArySynonyms(ti.source, filter.sources, tvSources))
		return false;
	if (shouldUse(filter.encoders) && !this.checkArySynonyms(ti.encoder, filter.encoders, tvEncoders))
		return false;

	if (shouldUse(filter.formats) && !checkFilterStrings(ti.format, filter.formats))
		return false;
	if (shouldUse(filter.bitrates) && !this.checkFilterBitrate(ti.bitrate, filter.bitrates))
		return false;
	if (shouldUse(filter.media) && !checkFilterStrings(ti.media, filter.media))
		return false;

	if (shouldUse(filter.tags) && !this.checkFilterTags(ti.tags, filter.tags))
		return false;
	if (shouldUse(filter.scene) && ti.scene !== filter.scene)
		return false;
	if (shouldUse(filter.log) && ti.log !== filter.log)
		return false;
	if (shouldUse(filter.cue) && ti.cue !== filter.cue)
		return false;

	var torrentSize = convertByteSizeString(ti.torrentSize);
	if (!this.checkFilterSize(torrentSize, filter))
		return false;

	var maxPreTime = convertTimeSinceString(filter.maxPreTime);
	if (maxPreTime !== null)
	{
		var preTime = convertTimeSinceString(ti.preTime);
		if (preTime === null || preTime > maxPreTime)
			return false;
	}

	if (filter.maxTriggers !== undefined && filter.maxTriggers > 0)
	{
		filter.maxTriggers--;
		if (filter.maxTriggers === 0)
			filter.enabled = false;
		this.optionsModified = true;
	}

	return true;
}

plugin.checkName =
function(name, filterName)
{
	function removeExtraSpaces(s)
	{
		return stringTrim(s.replace(/\s+/g, " "));
	}

	// first part is all ASCII chars except "a-zA-Z0-9*?,". Not same as [^a-zA-Z\d\*\?,].
	var nregex = /[\x00-\x1F\x21-\x29\x2B\x2D-\x2F\x3A-\x3E\x40\x5B-\x60\x7B-\x7F\*\?,]/g;
	var fregex = /[\x00-\x1F\x21-\x29\x2B\x2D-\x2F\x3A-\x3E\x40\x5B-\x60\x7B-\x7F]/g;
	name = name.replace(nregex, "");
	name = removeExtraSpaces(name);
	filterName = filterName.replace(fregex, "");
	filterName = removeExtraSpaces(filterName);
	return checkFilterStrings(name, filterName);
}

plugin.checkArySynonyms =
function(value, filterString, arySynonyms)
{
	var aryValidValues;
	for (var i = 0; i < arySynonyms.length; i++)
	{
		var ary = arySynonyms[i];
		for (var j = 0; j < ary.length; j++)
		{
			if (value.toLowerCase() === ary[j].toLowerCase())
			{
				aryValidValues = ary;
				break;
			}
		}
		if (aryValidValues)
			break;
	}
	if (!aryValidValues)
		return false;

	for (var i = 0; i < aryValidValues.length; i++)
	{
		if (checkFilterStrings(aryValidValues[i], filterString))
			return true;
	}

	return false;
}

plugin.checkSite =
function(tracker, sitesFilter)
{
	return checkFilterStrings(tracker.siteName, sitesFilter) ||
		   checkFilterStrings(tracker.type, sitesFilter) ||
		   checkFilterStrings(tracker.longName, sitesFilter);
}

plugin.checkFilterNumbers =
function(num, filterNums)
{
	num = parseInt(num, 10);
	if (isNaN(num))
		return false;

	var ary = filterNums.split(",");
	for (var i = 0; i < ary.length; i++)
	{
		var ary2 = stringTrim(ary[i]).match(/^(\d+)(?:\s*-\s*(\d+))?$/);
		if (!ary2)
			continue;

		var n1 = parseInt(ary2[1], 10);
		var n2 = ary2[2] === undefined ? n1 : parseInt(ary2[2], 10);

		if (isNaN(n1) || isNaN(n2))
			continue;

		if (n2 < n1)
		{
			var tmp = n1;
			n1 = n2;
			n2 = tmp;
		}

		if (n1 <= num && num <= n2)
			return true;
	}

	return false;
}

function canonicalizeBitrate(s, isFilter)
{
	var regex = "[^a-zA-Z\\d.";
	if (isFilter)
		regex += "*?";
	regex += "]";

	s = s.replace(new RegExp(regex, "g"), "");
	s = s.toLowerCase();
	return s;
}

plugin.checkFilterBitrate =
function(bitrate, filterBitrates)
{
	bitrate = canonicalizeBitrate(bitrate);
	var aryBitrates = filterBitrates.split(",");
	for (var i = 0; i < aryBitrates.length; i++)
	{
		var filterBitrate = canonicalizeBitrate(aryBitrates[i], true);
		if (checkFilterStrings(bitrate, filterBitrate))
			return true;
	}

	return false;
}

plugin.checkFilterTags =
function(tags, filterTags)
{
	var aryTags = tags.replace(/[._]/g, " ").replace(/\s+/g, " ").split(",");
	var aryFilterTags = filterTags.replace(/[._]/g, " ").replace(/\s+/g, " ").split(",");

	function isInTags(filterTag)
	{
		filterTag = stringTrim(filterTag);
		for (var i = 0; i < aryTags.length; i++)
		{
			var tag = stringTrim(aryTags[i]);
			if (checkFilterStrings(tag, filterTag))
				return true;
		}

		return false;
	}

	for (var i = 0; i < aryFilterTags.length; i++)
	{
		if (isInTags(aryFilterTags[i]))
			return true;
	}

	return false;
}

plugin.checkFilterSize =
function(torrentSize, filter)
{
	if (torrentSize === null || torrentSize === undefined)
		return true;

	var minSize = convertByteSizeString(filter.minSize);
	var maxSize = convertByteSizeString(filter.maxSize);

	if (minSize !== null && torrentSize < minSize)
		return false;
	if (maxSize !== null && torrentSize > maxSize)
		return false;

	return true;
}

// Should be the last statement in the file to indicate it loaded successfully
true;
