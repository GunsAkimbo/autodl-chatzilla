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

// To make sure all downloaded bytes have been written back to disk, wait at least this many
// milliseconds after seeding starts before executing the script.
const MIN_DELAY_AFTER_SEED_MS = 3 * 1000;

function DownloadedScriptExecQueue(userTorrentsNotifier, scriptExecQueue)
{
	this.hashes = {};
	this.scriptExecQueue = scriptExecQueue;

	var this_ = this;
	userTorrentsNotifier.addListener(function(userTorrents, hasChanged) { this_.onUserTorrentsUpdated(userTorrents, hasChanged); });
}

DownloadedScriptExecQueue.prototype.enqueue =
function(hash, scriptExec, execConditions)
{
	var obj =
	{
		scriptExec: scriptExec,
		execConditions: copyObj(execConditions),
		timeInserted: newDate(),
		isInList: false,	// Set to true whenever the webui knows about the torrent
	};

	this.enqueue2(hash, obj);
}

DownloadedScriptExecQueue.prototype.enqueue2 =
function(hash, obj)
{
	this.hashes[hash.toLowerCase()] = obj;
	plugin.optionsModified = true;
}

DownloadedScriptExecQueue.prototype.getHashTable =
function()
{
	return this.hashes;
}

DownloadedScriptExecQueue.prototype.deleteHash =
function(hash)
{
	delete this.hashes[hash.toLowerCase()];
	plugin.optionsModified = true;
}

DownloadedScriptExecQueue.prototype.onUserTorrentsUpdated =
function(userTorrents)
{
	var currTime = newDate();
	for (var hash in this.hashes)
	{
		var userTorrent = userTorrents.lookupTorrent(hash);
		if (!userTorrent)
		{
			var obj = this.hashes[hash];
			var ti = obj.scriptExec.ti;

			// It's possible that we're called before the webui knows about the torrent. If
			// it doesn't know about it after some secs, then assume it was never added.
			if (obj.isInList || currTime - obj.timeInserted >= 60*1000)
			{
				message(3, "Torrent \x02" + ti.torrentName + "\x02 was removed. Not executing script '" + obj.scriptExec.scriptName + "'.", MT_STATUS);
				this.deleteHash(hash);
			}
			continue;
		}

		var obj = this.hashes[hash];
		if (!obj.isInList)
		{
			obj.isInList = true;
			plugin.optionsModified = true;
		}

		if (userTorrent.remainingBytes !== 0)
			continue;

		if (obj.startSeedTime === undefined)
		{
			obj.startSeedTime = currTime;
			plugin.optionsModified = true;
		}

		var execConditions = obj.execConditions;
		var ratioOk = userTorrent.ratioPerMil >= Math.round(execConditions.ratio*1000);
		var seedingTimeOk = (currTime - obj.startSeedTime) >= Math.round(execConditions.seedingTimeHours*60*60*1000);

		var done = true;
		if (execConditions.useRatio && execConditions.useSeedingTime)
		{
			if (execConditions.isAnd)
				done = ratioOk && seedingTimeOk;
			else
				done = ratioOk || seedingTimeOk;
		}
		else if (execConditions.useRatio)
			done = ratioOk;
		else if (execConditions.useSeedingTime)
			done = seedingTimeOk;
		if (!done)
			continue;

		this.deleteHash(hash);
		this.scriptExecQueue.enqueue(obj.scriptExec, newDate((+obj.startSeedTime) + MIN_DELAY_AFTER_SEED_MS));
	}
}

// Should be the last statement in the file to indicate it loaded successfully
true;
