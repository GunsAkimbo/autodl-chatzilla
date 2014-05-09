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

window.addEventListener("dialogaccept", onDialogAccept, true);
window.addEventListener("dialogcancel", onDialogCancel, true);

var plugin = {};
var myListbox;

function AnnouncerChannel(serverName, channel)
{
	this.serverName = serverName;
	this.tracker = channel.tracker;
	this.channelNames = channel.names;
	this.announcerNames = channel.announcerNames;
}

AnnouncerChannel.prototype.toString =
function()
{
	return this.tracker.longName;
}

// Called right before the dialog is displayed. Initialize stuff!
function onDlgLoad()
{
	try
	{
		plugin = window.arguments[0];

		initializeListBox(plugin.servers);
	}
	catch (ex)
	{
		alert("Got an exception in onDlgLoad(): " + ex);
	}

	return true;
}

function initializeListBox(servers)
{
	var announcers = createAnnouncers(servers);

	myListbox = new MyListBox("announcers-listbox");
	myListbox.userObjSelected = function(newAnnouncer, oldAnnouncer) { onAnnouncerSelected(newAnnouncer, oldAnnouncer); };

	updateAnnouncerChannelOptions(null);
	for (var i = 0; i < announcers.length; i++)
	{
		var announcer = announcers[i];
		myListbox.appendUserObj(announcer, announcer.toString());
	}

	document.getElementById("server-name").focus();
}

function onAnnouncerSelected(newAnnouncer, oldAnnouncer)
{
	updateAnnouncerChannelOptions(newAnnouncer);
}

// Create the announcers array from plugin.servers
function createAnnouncers(servers)
{
	var rv = [];

	function addChannel(serverName, channel)
	{
		if (isCanonicalizedNetworkName(serverName))
			return;
		for (var i = 0; i < rv.length; i++)
		{
			var announcerChannel = rv[i];
			if (announcerChannel.tracker.type === channel.tracker.type &&
				announcerChannel.channelNames === channel.names &&
				announcerChannel.announcerNames === channel.announcerNames)
			{
				announcerChannel.serverName += ", " + serverName;
				return;
			}
		}
		rv.push(new AnnouncerChannel(serverName, channel));
	}

	for (var serverName in servers)
	{
		var channels = servers[serverName].channels;
		for (var i = 0; i < channels.length; i++)
			addChannel(serverName, channels[i]);
	}

	rv.sort(function(a, b)
	{
		var na = a.tracker.longName.toLowerCase();
		var nb = b.tracker.longName.toLowerCase();
		if (na < nb)
			return -1;
		if (na > nb)
			return 1;
		return 0;
	});

	return rv;
}

// Updates the text boxes to the right of the list box with announcerChannel's values
function updateAnnouncerChannelOptions(announcerChannel)
{
	function setValueString(id, propName)
	{
		var val = announcerChannel ? announcerChannel[propName] : "";
		var elem = document.getElementById(id);
		elem.value = val;
		elem.disabled = !announcerChannel;
	}

	setValueString("server-name", "serverName");
	setValueString("channel-names", "channelNames");
	setValueString("announcer-names", "announcerNames");
}

// Called when the user clicks OK or presses the Enter key
function onDialogAccept()
{
	dialogClosed();
	return true;
}

// Called when the user clicks Cancel or presses the ESC key
function onDialogCancel()
{
	dialogClosed();
	return true;
}

function dialogClosed()
{
	plugin.scope.dialogAnnouncers = null;
}

// Should be the last statement in the file to indicate it loaded successfully
true;
