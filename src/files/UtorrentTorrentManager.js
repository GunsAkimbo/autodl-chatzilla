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

// Indexes of various data in the torrent info array returned by the list command
const TORRENTS_HASH_INDEX = 0
const TORRENTS_RATIO_INDEX = 7;
const TORRENTS_REMAINING_INDEX = 18;

const WARN_LIST_COMMAND_ERROR_EVERY_MS = 15*60*1000;

const MAX_LIST_COMMAND_WAIT_SECS = 60;

function UtorrentTorrentManager(userTorrentsNotifier)
{
	this.webui = new UtorrentWebui();
	this.webui.pringHttpDebugMessage(false);
	this.userTorrentsNotifier = userTorrentsNotifier;
	this.torrents = new UserTorrents();
	this.secondTick = 0;
}

// How often (in seconds) we send the list command to uTorrent
UtorrentTorrentManager.prototype.CHECK_EVERY_SECS = 2;

// Called once a second
UtorrentTorrentManager.prototype.onTimer =
function()
{
	if (++this.secondTick < this.CHECK_EVERY_SECS)
		return;

	if (this.sendingListCommand && this.secondTick >= MAX_LIST_COMMAND_WAIT_SECS)
		this.cancelListCommand();

	this.sendListCommand();
}

UtorrentTorrentManager.prototype.cancelListCommand =
function()
{
	this.webui.cancel();
	delete this.cacheId;	// Something went wrong so start over
	this.sendingListCommand = false;
	this.secondTick = 0;
}

UtorrentTorrentManager.prototype.setWebuiSettings =
function(webuiSettings)
{
	this.webui.setSettings(webuiSettings);
	this.sendListCommand();
}

UtorrentTorrentManager.prototype.sendListCommand =
function()
{
	if (this.sendingListCommand || !this.webui.seemsValid())
		return;

	try
	{
		this.sendingListCommand = true;
		this.secondTick = 0;
		this.webui.addListCommand(this.cacheId);
		var this_ = this;
		this.webui.sendCommands(function(errorMessage, commandResults) { this_.onReceivedListCommand(errorMessage, commandResults); })
	}
	catch (ex)
	{
		this.sentListCommand("UtorrentTorrentManager.sendListCommand: ex: " + formatException(ex));
	}
}

UtorrentTorrentManager.prototype.onReceivedListCommand =
function(errorMessage, commandResults)
{
	try
	{
		if (errorMessage)
			return this.sentListCommand(errorMessage);

		var json = commandResults[0].json;
		this.cacheId = json.torrentc;

		var changed = false;
		changed |= this.removeTorrents(json.torrentm);
		changed |= this.resetTorrents(json.torrents);
		changed |= this.updateTorrents(json.torrentp);

		this.userTorrentsNotifier.notifyListeners(this.torrents, changed);

		this.sentListCommand();
	}
	catch (ex)
	{
		this.sentListCommand("UtorrentTorrentManager.onReceivedListCommand: ex: " + formatException(ex));
	}
}

UtorrentTorrentManager.prototype.checkTorrentInfo =
function(info)
{
	if (!info || !(info instanceof Array) || typeof info[TORRENTS_HASH_INDEX] !== "string" ||
		info[TORRENTS_HASH_INDEX].length !== 40 || typeof info[TORRENTS_RATIO_INDEX] !== "number" ||
		typeof info[TORRENTS_REMAINING_INDEX] !== "number")
	{
		throw "Invalid \xb5Torrent torrent list entry";
	}
}

UtorrentTorrentManager.prototype.resetTorrents =
function(torrents)
{
	if (!torrents || !(torrents instanceof Array))
		return false;

	this.torrents.clearAll();
	return this.addTorrents(torrents);
}

UtorrentTorrentManager.prototype.updateTorrents =
function(torrentp)
{
	if (!torrentp || !(torrentp instanceof Array))
		return false;

	return this.addTorrents(torrentp);
}

UtorrentTorrentManager.prototype.removeTorrents =
function(torrentm)
{
	if (!torrentm || !(torrentm instanceof Array))
		return false;

	for (var i = 0; i < torrentm.length; i++)
	{
		var hash = torrentm[i];
		if (typeof hash !== "string")
			continue;
		this.torrents.removeTorrent(hash);
	}
	return torrentm.length > 0;
}

UtorrentTorrentManager.prototype.addTorrents =
function(torrents)
{
	for (var i = 0; i < torrents.length; i++)
	{
		var info = torrents[i];
		this.checkTorrentInfo(info);
		this.torrents.addTorrent(info[TORRENTS_HASH_INDEX], info[TORRENTS_RATIO_INDEX], info[TORRENTS_REMAINING_INDEX]);
	}
	return torrents.length > 0;
}

UtorrentTorrentManager.prototype.sentListCommand =
function(errorMessage)
{
	this.sendingListCommand = false;

	if (errorMessage)
	{
		delete this.cacheId;

		var currTime = newDate();
		if (this.timeLastListError === undefined || currTime - this.timeLastListError >= WARN_LIST_COMMAND_ERROR_EVERY_MS)
		{
			this.timeLastListError = currTime;
			message(0, "Error getting \xb5Torrent torrent list. Check your webui settings and make sure \xb5Torrent is started. Webui error: " + errorMessage, MT_ERROR);
		}

		return;
	}

	if (this.timeLastListError)
		message(3, "Webui is working again", MT_INFO);
	delete this.timeLastListError;
}

// Should be the last statement in the file to indicate it loaded successfully
true;
