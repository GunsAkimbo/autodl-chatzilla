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

function MacroReplacer()
{
	this.macros = {};
}

MacroReplacer.prototype.add =
function(name, value)
{
	this.macros[name] = value.toString();
}

MacroReplacer.prototype.addTimes =
function(time)
{
	if (!time)
		time = newDate();

	this.add("year", time.getFullYear().toString());
	this.add("month", ("0" + (time.getMonth()+1).toString()).slice(-2));
	this.add("day", ("0" + time.getDate().toString()).slice(-2));
	this.add("hour", ("0" + time.getHours().toString()).slice(-2));
	this.add("minute", ("0" + time.getMinutes().toString()).slice(-2));
	this.add("second", ("0" + time.getSeconds().toString()).slice(-2));
	this.add("milli", ("00" + time.getMilliseconds().toString()).slice(-3));
}

MacroReplacer.prototype.addTorrentInfo =
function(ti)
{
	this.add("Category", ti.category);
	this.add("TorrentName", ti.torrentName);
	this.add("Uploader", ti.uploader);
	this.add("TorrentSize", convertToByteSizeString(convertByteSizeString(ti.torrentSize)) || "");
	this.add("PreTime", convertToTimeSinceString(convertTimeSinceString(ti.preTime)) || "");
	this.add("TorrentUrl", ti.torrentUrl);
	this.add("TorrentSslUrl", ti.torrentSslUrl);

	this.add("TYear", ti.year);
	this.add("Artist", ti.name1);
	this.add("Show", ti.name1);
	this.add("Movie", ti.name1);
	this.add("Name1", ti.name1);
	this.add("Album", ti.name2);
	this.add("Name2", ti.name2);
	this.add("Season", ti.season);
	this.add("Episode", ti.episode);
	this.add("Resolution", ti.resolution);
	this.add("Source", ti.source);
	this.add("Encoder", ti.encoder);
	this.add("Format", ti.format);
	this.add("Bitrate", ti.bitrate);
	this.add("Media", ti.media);
	this.add("Tags", ti.tags);
	this.add("Scene", ti.scene);
	this.add("Log", ti.log);
	this.add("Cue", ti.cue);

	this.add("Site", ti.site);

	// ti.tracker isn't saved when serializing 'ti'
	if (ti.tracker)
	{
		this.add("Tracker", ti.tracker.longName);
		this.add("TrackerShort", ti.tracker.shortName);
	}
}

MacroReplacer.prototype.replace =
function(s)
{
	for (var p in this.macros)
	{
		s = s.replace(new RegExp("\\$\\(" + p + "\\)", "ig"), this.macros[p]);
	}
	return s;
}

// Should be the last statement in the file to indicate it loaded successfully
true;
