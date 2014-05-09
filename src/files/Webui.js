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

function UtorrentWebui(webuiSettings)
{
	this.webuiSettings = webuiSettings;
	this.commands = [];
	this.httpDebugMessages = true;
}

// The uTorrent webui token and cookies. Shared by all instances.
UtorrentWebui.prototype.token = null;
UtorrentWebui.prototype.cookies = null;	// New since uTorrent 2.1

UtorrentWebui.prototype.setSettings =
function(webuiSettings)
{
	this.webuiSettings = webuiSettings;
}

UtorrentWebui.prototype.pringHttpDebugMessage =
function(val)
{
	this.httpDebugMessages = val;
}

UtorrentWebui.prototype.seemsValid =
function()
{
	return this.webuiSettings &&
			this.webuiSettings.user && this.webuiSettings.password && this.webuiSettings.hostname &&
			0 < this.webuiSettings.port && this.webuiSettings.port <= 65535;
}

// Tries to find the token div: <div id="token">ABUNCHOFCHARSHERE</div>, returning the token or null
UtorrentWebui.prototype.findToken =
function(s)
{
	var ary = s.match(/<div[^>]*\s+id=['"]?token['"]?[^>]*>([^<]*)<\/div>/m);
	if (!ary)
		return null;
	return ary[1];
}

UtorrentWebui.prototype.isSendingCommands =
function()
{
	return this.callback;
}

UtorrentWebui.prototype.checkNotSendingCommands =
function()
{
	if (this.isSendingCommands())
		throw "UtorrentWebui: Can't add commands when we're sending commands.";
}

UtorrentWebui.prototype.addCommand =
function(command)
{
	this.checkNotSendingCommands();

	this.commands.push(command);
}

UtorrentWebui.prototype.addListCommand =
function(cacheId)
{
	var command =
	{
		queries: [ "list=1" ],
	};
	if (typeof cacheId === "string")
		command.queries.push("cid=" + cacheId);
	this.addCommand(command);
}

UtorrentWebui.prototype.addGetSettingsCommand =
function()
{
	this.addCommand(
	{
		queries: [ "action=getsettings" ],
	});
}

UtorrentWebui.prototype.addSendTorrentCommand =
function(torrentFileData, torrentFilename)
{
	var boundaryString = "---------------------------32853208516921";
	var boundary = "--" + boundaryString;
	var postData = boundary + "\r\n" +
					"Content-Disposition: form-data; name=\"torrent_file\"; filename=\"" + torrentFilename + "\"\r\n" +
					"Content-Type: application/x-bittorrent\r\n" +
					"\r\n" +
					torrentFileData + "\r\n" +
					boundary + "--" + "\r\n";

	this.addCommand(
	{
		queries: [ "action=add-file" ],
		postData: postData,
		httpHeaders: { "Content-Type": "multipart/form-data; boundary=" + boundaryString },
	});
}

UtorrentWebui.prototype.addSetPropsCommand =
function(hash, propName, value)
{
	this.addCommand(
	{
		queries: [ "action=setprops", "hash=" + hash, "s=" + toUrlEncode(propName), "v=" + toUrlEncode(value.toString()) ],
	});
}

UtorrentWebui.prototype.addSetMaxUploadSpeedCommand =
function(hash, value)
{
	return this.addSetPropsCommand(hash, "ulrate", value);
}

UtorrentWebui.prototype.addSetMaxDownloadSpeedCommand =
function(hash, value)
{
	return this.addSetPropsCommand(hash, "dlrate", value);
}

UtorrentWebui.prototype.addSetLabelCommand =
function(hash, value)
{
	return this.addSetPropsCommand(hash, "label", value);
}

UtorrentWebui.prototype.addStartCommand =
function(hash, value)
{
	this.addCommand(
	{
		queries: [ "action=start", "hash=" + hash ],
	});
}

UtorrentWebui.prototype.addStopCommand =
function(hash, value)
{
	this.addCommand(
	{
		queries: [ "action=stop", "hash=" + hash ],
	});
}

UtorrentWebui.prototype.addPauseCommand =
function(hash, value)
{
	this.addCommand(
	{
		queries: [ "action=pause", "hash=" + hash ],
	});
}

UtorrentWebui.prototype.addUnpauseCommand =
function(hash, value)
{
	this.addCommand(
	{
		queries: [ "action=unpause", "hash=" + hash ],
	});
}

UtorrentWebui.prototype.addForceStartCommand =
function(hash, value)
{
	this.addCommand(
	{
		queries: [ "action=forcestart", "hash=" + hash ],
	});
}

UtorrentWebui.prototype.addRecheckCommand =
function(hash, value)
{
	this.addCommand(
	{
		queries: [ "action=recheck", "hash=" + hash ],
	});
}

UtorrentWebui.prototype.addRemoveCommand =
function(hash, value)
{
	this.addCommand(
	{
		queries: [ "action=remove", "hash=" + hash ],
	});
}

UtorrentWebui.prototype.addRemoveDataCommand =
function(hash, value)
{
	this.addCommand(
	{
		queries: [ "action=removedata", "hash=" + hash ],
	});
}

UtorrentWebui.prototype.addQueueBottomCommand =
function(hash, value)
{
	this.addCommand(
	{
		queries: [ "action=queuebottom", "hash=" + hash ],
	});
}

UtorrentWebui.prototype.addQueueTopCommand =
function(hash, value)
{
	this.addCommand(
	{
		queries: [ "action=queuetop", "hash=" + hash ],
	});
}

UtorrentWebui.prototype.addQueueUpCommand =
function(hash, value)
{
	this.addCommand(
	{
		queries: [ "action=queueup", "hash=" + hash ],
	});
}

UtorrentWebui.prototype.addQueueDownCommand =
function(hash, value)
{
	this.addCommand(
	{
		queries: [ "action=queuedown", "hash=" + hash ],
	});
}

/**
 * @param callback	Function called when completed. Called as callback(errorMessage, commandResults)
 */
UtorrentWebui.prototype.sendCommands =
function(callback)
{
	this.checkNotSendingCommands();

	this.callback = callback || function() {};
	try
	{
		this.commandIndex = -1;
		this.commandResults = [];
		this.nextCommand();
	}
	catch (ex)
	{
		this.sendCommandsCompleted("UtorrentWebui.sendCommands: ex: " + formatException(ex));
	}
}

UtorrentWebui.prototype.nextCommand =
function()
{
	try
	{
		this.gettingToken = false;
		this.commandIndex++;
		if (this.commandIndex >= this.commands.length)
			return this.sendCommandsCompleted("");

		this.sendNextCommand();
	}
	catch (ex)
	{
		this.sendCommandsCompleted("UtorrentWebui.nextCommand: ex: " + formatException(ex));
	}
}

UtorrentWebui.prototype.sendNextCommand =
function()
{
	try
	{
		var this_ = this;
		var command = this.commands[this.commandIndex];
		this.sendHttpRequest(command, function(errorMessage) { this_.onHttpRequestSent(errorMessage); })
	}
	catch (ex)
	{
		this.sendCommandsCompleted("UtorrentWebui.sendNextCommand: ex: " + formatException(ex));
	}
}

UtorrentWebui.prototype.onHttpRequestSent =
function(errorMessage)
{
	if (errorMessage)
		return this.sendCommandsCompleted(errorMessage);

	try
	{
		var response = this.httpRequest.response;
		if (response.statusCode === "300" || response.statusCode === "400")
			return this.getToken();
		if (response.statusCode === "401")
			return this.sendCommandsCompleted("Got HTTP 401. Check your webui user name and password!");
		if (response.statusCode !== "200")
			return this.sendCommandsCompleted("Got HTTP error: " + response.status + ".");

		this.commandResults.push(
		{
			json: decodeJson(response.content),
		});

		this.nextCommand();
	}
	catch (ex)
	{
		this.sendCommandsCompleted("UtorrentWebui.onHttpRequestSent: ex: " + formatException(ex));
	}
}

UtorrentWebui.prototype.getWebuiUrl =
function()
{
	var protocol = this.webuiSettings.https ? "https://" : "http://";
	return protocol + this.webuiSettings.hostname + ":" + this.webuiSettings.port + "/gui/";
}

UtorrentWebui.prototype.sendHttpRequest =
function(command, callback)
{
	try
	{
		if (!this.webuiSettings)
			return this.sendCommandsCompleted("Webui settings is null");

		this.deleteHttpRequest();
		this.httpRequest = new HttpRequest();
		this.httpRequest.printDebugMessages(this.httpDebugMessages);

		var url = this.getWebuiUrl();
		if (command.urlDir)
			url += command.urlDir;

		if (UtorrentWebui.prototype.token)
			url = appendUrlQuery(url, "token=" + UtorrentWebui.prototype.token);
		if (command.queries)
		{
			for (var i = 0; i < command.queries.length; i++)
				url = appendUrlQuery(url, command.queries[i]);
		}

		var httpHeaders = { "Authorization": "Basic " + btoa(this.webuiSettings.user + ":" + this.webuiSettings.password) };
		if (UtorrentWebui.prototype.cookies && UtorrentWebui.prototype.cookies.toString())
			httpHeaders["Cookie"] = UtorrentWebui.prototype.cookies.toString();
		if (command.httpHeaders)
			copyObj(command.httpHeaders, httpHeaders);

		var this_ = this;
		var ourCallback = function(httpRequest, errorMessage) { callback(errorMessage); };
		if (command.postData)
			this.httpRequest.sendRequest("POST", command.postData, url, httpHeaders, ourCallback);
		else
			this.httpRequest.sendGetRequest(url, httpHeaders, ourCallback);
	}
	catch (ex)
	{
		this.sendCommandsCompleted("UtorrentWebui.sendHttpRequest: ex: " + formatException(ex));
	}
}

UtorrentWebui.prototype.getToken =
function()
{
	try
	{
		if (this.gettingToken)
			return this.sendCommandsCompleted("Could not get webui token. Enable Webui and check webui settings for typos!");

		UtorrentWebui.prototype.token = null;
		UtorrentWebui.prototype.cookies = null;

		this.gettingToken = true;
		var command =
		{
			urlDir: "token.html",
			queries: [],
		};
		var this_ = this;
		this.sendHttpRequest(command, function(errorMessage) { this_.onHttpRequestToken(errorMessage); });
	}
	catch (ex)
	{
		this.sendCommandsCompleted("UtorrentWebui.getToken: ex: " + formatException(ex));
	}
}

UtorrentWebui.prototype.onHttpRequestToken =
function(errorMessage)
{
	if (errorMessage)
		return this.sendCommandsCompleted(errorMessage);

	try
	{
		var response = this.httpRequest.response;
		if (response.statusCode !== "200")
			return this.sendCommandsCompleted("Got HTTP error: " + response.status + ". Can't get token.");

		UtorrentWebui.prototype.token = this.findToken(response.content);
		UtorrentWebui.prototype.cookies = this.httpRequest.getCookiesFromResponseHeader();
		if (!UtorrentWebui.prototype.token)
			return this.sendCommandsCompleted("Could not get webui token.");

		message(5, "Got new \xb5Torrent webui token: " + UtorrentWebui.prototype.token + ", cookies: " + UtorrentWebui.prototype.cookies.toString(), MT_INFO);
		this.sendNextCommand();
	}
	catch (ex)
	{
		this.sendCommandsCompleted("UtorrentWebui.onHttpRequestToken: ex: " + formatException(ex));
	}
}

UtorrentWebui.prototype.deleteHttpRequest =
function()
{
	if (this.httpRequest)
	{
		this.httpRequest.cancel();
		this.httpRequest = null;
	}
}

UtorrentWebui.prototype.cleanUp =
function()
{
	this.callback = null;
	this.commandResults = null;
	this.commands = [];
	this.deleteHttpRequest();
	this.gettingToken = false;
}

UtorrentWebui.prototype.sendCommandsCompleted =
function(errorMessage)
{
	var callback = this.callback;
	var commandResults = this.commandResults;
	this.cleanUp();

	try
	{
		callback(errorMessage, commandResults);
	}
	catch (ex)
	{
		message(0, "UtorrentWebui.sendCommandsCompleted: ex: " + formatException(ex), MT_ERROR);
	}
}

// Cancel any commands without notifying the callback
UtorrentWebui.prototype.cancel =
function()
{
	if (this.httpRequest)
		this.httpRequest.cancel();
	this.cleanUp();
}

// Should be the last statement in the file to indicate it loaded successfully
true;
