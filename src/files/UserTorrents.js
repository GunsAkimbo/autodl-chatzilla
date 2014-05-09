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

function UserTorrentsNotifier()
{
	this.listeners = [];
}

/**
 * @param callback	Notified when the user torrents state changes. Called as callback(userTorrents, hasChanged)
 */
UserTorrentsNotifier.prototype.addListener =
function(callback)
{
	this.listeners.push(callback);
}

UserTorrentsNotifier.prototype.notifyListeners =
function(userTorrents, hasChanged)
{
	for (var i = 0; i < this.listeners.length; i++)
	{
		try
		{
			this.listeners[i](userTorrents, hasChanged);
		}
		catch (ex)
		{
			message(0, "UserTorrentsNotifier.notifyListeners: ex: " + formatException(ex), MT_ERROR);
		}
	}
}

function UserTorrents()
{
	this.clearAll();
}

UserTorrents.prototype.canonicalizeHash =
function(hash)
{
	return hash.toLowerCase();
}

UserTorrents.prototype.clearAll =
function()
{
	this.torrents = {};
	this.numTorrents = 0;
}

UserTorrents.prototype.addTorrent =
function(hash, ratioPerMil, remainingBytes)
{
	var canonHash = this.canonicalizeHash(hash);

	var userTorrent = this.torrents[canonHash];
	if (!userTorrent)
	{
		userTorrent = {};
		this.numTorrents++;
	}

	userTorrent.ratioPerMil = ratioPerMil;
	userTorrent.remainingBytes = remainingBytes;

	this.torrents[canonHash] = userTorrent;
}

UserTorrents.prototype.removeTorrent =
function(hash)
{
	var canonHash = this.canonicalizeHash(hash);
	if (this.torrents[canonHash])
	{
		delete this.torrents[canonHash];
		this.numTorrents--;
	}
}

// Returns a user torrent or null if none
UserTorrents.prototype.lookupTorrent =
function(hash)
{
	return this.torrents[this.canonicalizeHash(hash)] || null;
}

// Should be the last statement in the file to indicate it loaded successfully
true;
