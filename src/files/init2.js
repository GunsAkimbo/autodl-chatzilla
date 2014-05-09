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

plugin.settingsDirectory = "settings";
plugin.HOOK_PRIVMSG_STRING = plugin.id + "msghook";
plugin.HOOK_CHANNEL_STRING = plugin.id + "onchannel";
plugin.HOOK_DISCONNECT_STRING = plugin.id + "disconnect";

// This is set to true by the dialog box code when the user presses OK, and is checked by code once
// every second. If it's true, the options are saved to disk. The dialog box code doesn't have
// enough privilege, so it's better to let this code do the saving than to ask the user for the
// right privilege.
plugin.optionsModified = false;

plugin.announcerIntervalMilliseconds = 10*60*1000;

plugin.filters = [];
plugin.servers = {};
plugin.scripts = [];
plugin.tempFiles = [];

plugin.options =
{
	lastShownVersion: "",

	updateCheck: UPDATE_ASK,

	tempdir: "",

	userAgent: DEFAULT_USER_AGENT,

	maxSavedReleases: 1000,
	saveDownloadHistory: true,
	downloadDupeReleases: false,
	maxDownloadRetryTimeSeconds: 5*60,
	level: 3,
	debug: false,
	trackersVersion: -1,

	uploadMethod: createUploadMethod(),
	scriptExecOptions: createScriptExecOptions(),

	pathToUnrar: "",
	pathToUtorrent: "",

	webui:
	{
		user: "",
		password: "",
		hostname: "",
		port: 1,
		https: false,
	},

	ftp:
	{
		user: "",
		password: "",
		hostname: "",
		port: 21,
	},
};

// ChatZilla doesn't call disable() when its window is closed.
function myOnUnload()
{
	plugin.disable();
}

// Called by ChatZilla to enable the plugin
plugin.enable =
function(status)
{
	this.diskIoQueue = new DiskIoQueue();
	this.scriptExecQueue = new ScriptExecQueue();
	this.userTorrentsNotifier = new UserTorrentsNotifier();
	this.utorrentTorrentManager = new UtorrentTorrentManager(this.userTorrentsNotifier);
	this.downloadedScriptExecQueue = new DownloadedScriptExecQueue(this.userTorrentsNotifier, this.scriptExecQueue);

	this.readAllTrackers();
	this.readOptionsFromFile();

	this.downloadHistory = new DownloadHistory();
	this.downloadHistory.loadHistoryFile();

	this.utorrentTorrentManager.setWebuiSettings(this.options.webui);
	this.myUpdater = new MyUpdater();

	var this_ = this;
	client.eventPump.addHook({ type: "^parseddata$", code: "^(?:PRIVMSG|NOTICE)$" }, function(e) { return this_.onPrivmsg(e); }, this.HOOK_PRIVMSG_STRING, false);
	client.eventPump.addHook({ set: "^channel$", destMethod: "^(?:onJoin|onKick|onPart|onQuit)$" }, function(e) { return this_.onChannelJoinPart(e); }, this.HOOK_CHANNEL_STRING, false);
	client.eventPump.addHook({ set: "^server$", type: "^disconnect$" }, function(e) { return this_.onServerDisconnect(e); }, this.HOOK_DISCONNECT_STRING, false);
	this.startMonitoring(true);

	this.installMenu();
	this.initAnnouncerChecker();
	this.startSecondTimer();
	this.detectPrograms();

	window.addEventListener("unload", myOnUnload, false);

	return true;
}

// Called by ChatZilla to disable the plugin
plugin.disable =
function(status)
{
	window.removeEventListener("unload", myOnUnload, false);

	this.stopSecondTimer();
	this.removeMenu();

	this.startMonitoring(false);
	client.eventPump.removeHookByName(this.HOOK_PRIVMSG_STRING);
	client.eventPump.removeHookByName(this.HOOK_CHANNEL_STRING);
	client.eventPump.removeHookByName(this.HOOK_DISCONNECT_STRING);

	this.deleteTempFiles(true);
	this.saveOptionsToFile();

	return true;
}

plugin.findTrackerChannel =
function(networkName, serverName, channelName)
{
	var server = this.findServerInfo(networkName, serverName);
	if (!server)
		return null;

	var channels = server.channels;
	for (var i = 0; i < channels.length; i++)
	{
		if (checkFilterStrings(channelName, channels[i].names))
			return { server: server, channel: channels[i] };
	}

	return null;
}

plugin.getTrackerChannelViews =
function()
{
	var rv = [];

	for (var i = 0; i < client.viewsArray.length; i++)
	{
		var view = client.viewsArray[i].source;
		if (view.TYPE !== "IRCChannel")
			continue;
		var o = getObjectDetails(view);
		var info = this.findTrackerChannel(getServerNetworkName(o.server), o.server.unicodeName, o.channel.unicodeName);
		if (!info)
			continue;
		rv.push(
		{
			view: view,
			objDetails: o,
			server: info.server,
			channel: info.channel,
			tracker: info.channel.tracker,
		});
	}

	return rv;
}

plugin.findChannelView =
function(serverName, channelName)
{
	for (var i = 0; i < client.viewsArray.length; i++)
	{
		var view = client.viewsArray[i].source;
		if (view.TYPE !== "IRCChannel")
			continue;
		var o = getObjectDetails(view);
		if (serverName.toLowerCase() === o.server.unicodeName.toLowerCase() &&
			checkFilterStrings(o.channel.unicodeName, channelName))
		{
			return view;
		}
	}

	return null;
}

plugin.startMonitoring =
function(isStarting)
{
/* Too much spam so it's now disabled

	var msgWhy = isStarting ? "starting" : "stopping";
	var viewInfos = this.getTrackerChannelViews();
	for (var i = 0; i < viewInfos.length; i++)
	{
		var o = viewInfos[i].objDetails;
		this.handleChannelEvent(o.server.unicodeName, o.channel.unicodeName, isStarting, msgWhy, false);
	}
*/
}

plugin.handleChannelEvent =
function(serverName, channelName, isConnected, msgWhy, wasUnexpected)
{
	var msg = serverName + ": ";
	if (isConnected)
		msg += "Monitoring channel ";
	else
		msg += "Not monitoring channel ";
	msg += channelName;
	if (msgWhy)
		msg += " (" + msgWhy + ")";
	message(3, msg, wasUnexpected ? MT_ERROR : MT_INFO);
}

plugin.onChannelJoinPart =
function(e)
{
	try
	{
		var user = e.lamer || e.user;	// onKick sets e.lamer to user
		if (!userIsMe(user))
			return;

		var info = this.findTrackerChannel(getServerNetworkName(e.server), e.server.unicodeName, e.channel.unicodeName);
		if (!info)
			return;

		if (e.code === "JOIN")
			this.handleChannelEvent(e.server.unicodeName, e.channel.unicodeName, true, "/join", false);
		else	// QUIT, KICK, PART
			this.handleChannelEvent(e.server.unicodeName, e.channel.unicodeName, false, "/" + e.code.toLowerCase(), e.code !== "PART");
	}
	catch (ex)
	{
		message(0, "onChannelJoinPart(): EX: " + formatException(ex), MT_ERROR);
	}
}

plugin.onServerDisconnect =
function(e)
{
	try
	{
		var server = this.findServerInfo(getServerNetworkName(e.server), e.server.unicodeName);
		if (!server)
			return;

		var channels = server.channels;
		for (var i = 0; i < channels.length; i++)
		{
			var aryNames = channels[i].names.split(",");
			for (var j = 0; j < aryNames.length; j++)
			{
				var channelName = stringTrim(aryNames[j]);
				if (!channelName)
					continue;
				var view = this.findChannelView(e.server.unicodeName, channelName);
				if (!view || !view.active)
					continue;
				this.handleChannelEvent(e.server.unicodeName, channelName, false, "disconnected", true);
			}
		}
	}
	catch (ex)
	{
		message(0, "onServerDisconnect(): EX: " + formatException(ex), MT_ERROR);
	}
}

// Install our menu
plugin.installMenu =
function()
{
	var cmdlist =
	[
		["adlfilters", commandFilters, CMD_CONSOLE],
		["adlannouncers", commandAnnouncers, CMD_CONSOLE],
		["adlprefs", commandPreferences, CMD_CONSOLE],
		["adltrackers", commandTrackers, CMD_CONSOLE],
		["adlscripteditor", commandScriptEditor, CMD_CONSOLE],
		["adlhelp", commandHelp, CMD_CONSOLE],
		["adlupdate", commandUpdate, CMD_CONSOLE],
	];
	this.cmdlist = client.commandManager.defineCommands(cmdlist);

	client.menuManager.menuSpecs["mainmenu:autodl"] =
	{
		label: "Auto Downloader",
		accesskey: "A",
		items:
		[
			["adlfilters",		{label: "Filters...", accesskey: "F"}],
			["adlannouncers",	{label: "Announce Channels...", accesskey: "A"}],
			["adltrackers",		{label: "Trackers...", accesskey: "T"}],
			["adlscripteditor",	{label: "Script Editor...", accesskey: "S"}],
			["adlprefs",		{label: "Preferences...", accesskey: "P"}],
			["adlupdate",		{label: "Check for Updates", accesskey: "U"}],
			["adlhelp",			{label: "Help", accesskey: "H"}],
		]
	};
	client.updateMenus();

/*
//TODO: This fails at startup since the UI isn't visible.
	var mainmenu = document.getElementById("mainmenu");
	var insertBeforeMenu = document.getElementById("mainmenu:view").nextSibling;
	var ourmenu = document.getElementById("mainmenu:autodl");
	mainmenu.insertBefore(ourmenu, insertBeforeMenu);
*/
}

// Remove our menu
plugin.removeMenu =
function()
{
	client.commandManager.removeCommands(this.cmdlist);
	delete this.cmdlist;

	delete client.menuManager.menuSpecs["mainmenu:autodl"];
	document.getElementById("mainmenu").removeChild(document.getElementById("mainmenu:autodl"));
	client.updateMenus();
}

function commandFilters(e)
{
	plugin_openDialog(
	{
		varName: "dialogFilters",
		xulFile: "files/filters.xul",
	});
}

function commandAnnouncers(e)
{
	plugin_openDialog(
	{
		varName: "dialogAnnouncers",
		xulFile: "files/networks.xul",
	});
}

function commandPreferences(e)
{
	plugin_openDialog(
	{
		varName: "dialogPreferences",
		xulFile: "files/preferences.xul",
	});
}

function commandTrackers(e)
{
	plugin_openDialog(
	{
		varName: "dialogTrackers",
		xulFile: "files/trackers.xul",
	});
}

function commandScriptEditor(e)
{
	plugin_openDialog(
	{
		varName: "dialogScriptEditor",
		xulFile: "files/ScriptEditor.xul",
	});
}

function commandHelp(e)
{
	client.dispatch("goto-url-newwin", { url: "http://sourceforge.net/apps/phpbb/autodl/" });
}

function commandUpdate(e)
{
	plugin.myUpdater.manualCheckForUpdates();
}

// Start the timer that notifies us every second
plugin.startSecondTimer =
function()
{
	if (!this.secondTimer)
		this.secondTimer = Components.classes["@mozilla.org/timer;1"].createInstance(Components.interfaces.nsITimer);

	var this_ = this;
	this.secondTimer.initWithCallback({ notify: function(timer) { this_.onSecondTimer(); } }, 1000, this.secondTimer.TYPE_REPEATING_SLACK);
}

// Stop the timer that notifies us every second
plugin.stopSecondTimer =
function()
{
	if (this.secondTimer)
		this.secondTimer.cancel();
}

// Called every second
plugin.onSecondTimer =
function()
{
	try
	{
		this.scriptExecQueue.exec();
		this.utorrentTorrentManager.onTimer();

		if (this.optionsModified === true)
		{
			this.optionsModified = false;
			this.saveOptionsToFile();
		}
		this.myUpdater.checkForUpdates();
		this.checkForBrokenAnnouncers();
		this.deleteTempFiles();
	}
	catch (ex)
	{
		message(0, "Caught an exception in onSecondTimer(): " + formatException(ex), MT_ERROR);
	}
}

function versionToInt(s)
{
	var major, minor;
	var ary = s.match(/^(\d+)\.(\d+)$/);
	if (ary)
	{
		major = ary[1];
		minor = ary[2];
	}
	major = parseInt(major, 10);
	minor = parseInt(minor, 10);
	if (isNaN(major) || isNaN(minor))
		major = minor = 0;
	return major * 100 + minor;
}

function EventTimer(timeMilliSecs)
{
	this.timeMilliSecs = timeMilliSecs;
}

EventTimer.prototype.check =
function()
{
	var currentTime = newDate();
	if (this.lastTime !== undefined && (currentTime - this.lastTime) < this.timeMilliSecs)
		return false;

	this.lastTime = currentTime;
	return true;
}

function newDate_orig(arg)
{
	// Passing undefined as first arg won't work so check here
	if (arg === undefined)
		return new Date();
	return new Date(arg);
}

function createUploadMethod()
{
	var uploadMethod =
	{
		type: UPLOAD_WATCH_FOLDER,
		overrideGlobal: false,

		watchFolder:
		{
			dir: "",
		},

		ftp:
		{
			path: "",
		},

		tool:
		{
			command: "",
			args: "",
		},

		dynamicDir:
		{
			basedir: "",
			dyndir: "",
		},
	};

	return uploadMethod
}

function createScriptExecOptions()
{
	var scriptExecOptions =
	{
		uploaded:
		{
			scriptName: "",
			execAfterSeconds: 0,
		},
		downloadedData:
		{
			scriptName: "",
			useRatio: false,
			ratio: 1.05,
			useSeedingTime: false,
			seedingTimeHours: 24.1,
			isAnd: false,
		},
	};

	return scriptExecOptions;
}

var newDate = newDate_orig;

plugin.initAnnouncerChecker =
function()
{
	for (var trackerType in this.trackers)
	{
		var tracker = this.trackers[trackerType];
		tracker.announceInfo = new AnnounceInfo(tracker.lastAnnounce);
	}
}

plugin.announceTimer = new EventTimer(plugin.announcerIntervalMilliseconds);
plugin.checkForBrokenAnnouncers =
function()
{
	if (!this.announceTimer.check())
		return;

	var currentTime = newDate();
	var viewInfos = this.getTrackerChannelViews();
	for (var i = 0; i < viewInfos.length; i++)
	{
		var viewInfo = viewInfos[i];
		var view = viewInfo.view;
		if (!view.active || !view.joined)
			continue;

		var tracker = viewInfo.tracker;
		// Only warn the user every 6 hours if it has been at least 24 hours since last announce
		if (!tracker.announceInfo.check(currentTime))
		{
			var lastAnnounce = tracker.announceInfo.getLastAnnounce();
			if (currentTime - lastAnnounce >= 24*60*60*1000)
				message(3, "\x02\x0304WARNING\x03\x02: \x02" + tracker.longName + "\x02: Nothing announced since " + lastAnnounce, MT_WARN);
		}
	}
}

function AnnounceInfo(lastAnnounce)
{
	var currDate = newDate();
	this.lastAnnounce = lastAnnounce || currDate;
}

AnnounceInfo.prototype.maxAnnounceWaitTimeMilliSecs = 6*60*60*1000;

AnnounceInfo.prototype.getLastAnnounce =
function()
{
	return this.lastAnnounce;
}

AnnounceInfo.prototype.gotAnnouncement =
function()
{
	this.lastCheck = this.lastAnnounce = newDate();
}

AnnounceInfo.prototype.check =
function(currentTime)
{
	if (this.lastCheck === undefined)
		this.lastCheck = currentTime;
	if (currentTime - this.lastCheck <= this.maxAnnounceWaitTimeMilliSecs)
		return true;

	this.lastCheck = currentTime;
	return false;
}

// localFile is a nsILocalFile instance
plugin.addFileToBeDeleted =
function(localFile)
{
	this.tempFiles.push(
	{
		time: newDate(),
		localFile: localFile,
	});
}

plugin.deleteTempFiles =
function(deleteAll)
{
	if (this.tempFiles.length === 0)
		return;
	if (deleteAll === undefined)
		deleteAll = false;

	var currentTime = newDate();
	var waitTimeInMilliSecs = 30*1000;
	while (this.tempFiles.length > 0)
	{
		var data = this.tempFiles[0];
		if (!deleteAll && currentTime - data.time <= waitTimeInMilliSecs)
			break;
		this.tempFiles.shift();
		message(4, "Deleting temporary file '" + data.localFile.path + "'", MT_STATUS);
		try
		{
			data.localFile.remove(false);
		}
		catch (ex)
		{
			if (ex.name !== "NS_ERROR_FILE_NOT_FOUND")
				message(0, "Could not delete temporary file '" + data.localFile.path + "' (" + ex.name + ")", MT_ERROR);
		}
	}
}

plugin.detectPrograms =
function()
{
	this.detectProgramUnrar();
	this.detectProgramUtorrent();
}

// Returns path to program if it exists, or null otherwise
function findProgram(baseDir, subDir, programName)
{
	try
	{
		if (!baseDir)
			return null;

		var localFile = getLocalFile(baseDir, subDir);
		localFile.append(programName);
		if (!localFile.exists() || !localFile.isFile())
			return null;
		return localFile.path;
	}
	catch (ex)
	{
		return null;
	}
}

function winFindProgramFilesProgram(subDir, programName)
{
	var env = Components.classes["@mozilla.org/process/environment;1"].createInstance(Components.interfaces.nsIEnvironment);
	return findProgram(env.get("ProgramFiles"), subDir, programName) ||
		   findProgram(env.get("ProgramFiles(x86)"), subDir, programName) ||
		   findProgram(env.get("ProgramW6432"), subDir, programName);
}

function findProgramFromPathEnv(programName)
{
	var env = Components.classes["@mozilla.org/process/environment;1"].createInstance(Components.interfaces.nsIEnvironment);
	var sep = client.platform.toLowerCase() === "windows" ? ";" : ":";
	var pathEnv = env.get("PATH");
	if (!pathEnv)
		return null;

	var ary = pathEnv.split(sep);
	for (var i = 0; i < ary.length; i++)
	{
		var basePath = ary[i];
		var path = findProgram(basePath, "", programName);
		if (path)
			return path;
	}
	return null;
}

plugin.detectProgramUnrar =
function()
{
	if (this.options.pathToUnrar)
		return;

	var path;
	if (client.platform.toLowerCase() === "windows")
	{
		path = path || winFindProgramFilesProgram("WinRAR", "unrar.exe");
		path = path || winFindProgramFilesProgram("WinRAR", "rar.exe");
		path = path || findProgramFromPathEnv("unrar.exe");
		path = path || findProgramFromPathEnv("rar.exe");
	}
	else
	{
		path = path || findProgramFromPathEnv("unrar");
	}

	if (path)
	{
		this.options.pathToUnrar = path;
		this.optionsModified = true;
		message(4, "\x02Found unrar\x02: " + path, MT_INFO);
	}
}

plugin.detectProgramUtorrent =
function()
{
	if (this.options.pathToUtorrent)
		return;

	var path;
	if (client.platform.toLowerCase() === "windows")
	{
		path = path || winFindProgramFilesProgram("uTorrent", "uTorrent.exe");
		path = path || findProgramFromPathEnv("uTorrent.exe");
	}

	if (path)
	{
		this.options.pathToUtorrent = path;
		this.optionsModified = true;
		message(4, "\x02Found uTorrent\x02: " + path, MT_INFO);
	}
}

function MyUpdater()
{
	this.dialogBoxActive = false;
}

//
// How often we'll check for updates to autodl-cz and *.tracker files. Default is 1 hour.
//
MyUpdater.prototype.CHECK_FOR_UPDATES_SECS = 60*60;

//
// Wait at most this many seconds before closing the connection. Default is 10 mins.
//
MyUpdater.prototype.MAX_CONNECTION_WAIT_SECS = 10*60;

MyUpdater.prototype.checkForUpdates =
function()
{
	try
	{
		if (this.autoUpdater && this.autoUpdater.getRequestTimeInSecs() >= this.MAX_CONNECTION_WAIT_SECS)
		{
			this.cancelCheckForUpdates("Stuck connection!");
			return;
		}
		var elapsedSecs = this.lastUpdateCheck !== undefined ? (newDate() - this.lastUpdateCheck) / 1000 : -1;
		if (elapsedSecs >= 0 && elapsedSecs < this.CHECK_FOR_UPDATES_SECS)
			return;
		if (this.dialogBoxActive)
			return;
		this.updateCheck = plugin.options.updateCheck;
		this.forceCheckForUpdates();
	}
	catch (ex)
	{
		message(0, "checkForUpdates: ex: " + formatException(ex), MT_ERROR);
	}
}

MyUpdater.prototype.manualCheckForUpdates =
function()
{
	try
	{
		if (this.dialogBoxActive)
			return;
		this.updateCheck = 'manual';
		this.forceCheckForUpdates();
	}
	catch (ex)
	{
		message(0, "manualCheckForUpdates: ex: " + formatException(ex), MT_ERROR);
	}
}

MyUpdater.prototype.updateFailed =
function(errorMessage)
{
	delete this.autoUpdater;
	message(0, errorMessage, MT_ERROR);
}

MyUpdater.prototype.cancelCheckForUpdates =
function(errorMessage)
{
	if (this.autoUpdater === undefined)
		return;

	this.autoUpdater.cancel(errorMessage || "Update canceled!");
	delete this.autoUpdater;
}

MyUpdater.prototype.forceCheckForUpdates =
function()
{
	this.cancelCheckForUpdates('Update check cancelled!');
	message(5, "Checking for updates...", MT_STATUS);
	this.lastUpdateCheck = newDate();
	this.autoUpdater = new AutoUpdater();
	var this_ = this;
	this.autoUpdater.check(function(errorMessage)
	{
		this_.onUpdateFileDownloaded(errorMessage);
	});
}

MyUpdater.prototype.onUpdateFileDownloaded =
function(errorMessage)
{
	var this_ = this;

	if (!this.autoUpdater)
		return;
	if (errorMessage)
		return this.updateFailed("Could not check for updates: " + errorMessage);

	var version = intToVersion(plugin.major * 100 + plugin.minor);
	var autodlUpdateAvailable = this.autoUpdater.hasAutodlUpdate(version);
	var updateAutodl = autodlUpdateAvailable;

	var this_ = this;
	function ask()
	{
		try
		{
			this_.dialogBoxActive = true;
			return confirm("A new version of IRC Auto Downloader is available!\n" +
							"New in v" + this_.autoUpdater.autodl.version + ":\n" +
							"\n" +
							this_.autoUpdater.autodl.whatsNew + "\n" +
							"\n" +
							"Do you want to install it?", window, "IRC Auto Downloader");
		}
		finally
		{
			this_.dialogBoxActive = false;
		}
	}

	switch (this.updateCheck)
	{
	case UPDATE_AUTO:
		// Nothing
		break;

	case UPDATE_ASK:
		if (autodlUpdateAvailable)
		{
			if (this.lastCanceledUpdateVersion === this.autoUpdater.autodl.version)
			{
				message(5, "Automatic update canceled, still same version.", MT_STATUS);
				updateAutodl = false;
			}
			else if (!ask())
			{
				this.lastCanceledUpdateVersion = this.autoUpdater.autodl.version;
				message(5, "Automatic update canceled by user.", MT_STATUS);
				updateAutodl = false;
			}
		}
		break;

	case 'manual':
		if (autodlUpdateAvailable)
		{
			if (!ask())
				updateAutodl = false;
		}
		else
		{
			alert("You are using the latest version!", window, "IRC Auto Downloader");
		}
		break;

	case UPDATE_DISABLED:
	default:
		updateAutodl = false;
		break;
	}
	if (!this.autoUpdater)
		return;

	if (updateAutodl)
	{
		message(3, "Downloading update...", MT_STATUS);
		var destDir = plugin.fileCwd.clone();
		destDir = destDir.parent;
		this.autoUpdater.updateAutodl(destDir, function(errorMessage)
		{
			this_.onUpdatedAutodl(errorMessage);
		});
		return;
	}

	if (this.autoUpdater.hasTrackersUpdate(plugin.options.trackersVersion))
	{
		message(4, "Updating tracker files...", MT_STATUS);
		var destDir = plugin.fileCwd.clone();
		destDir.append("trackers");
		this.autoUpdater.updateTrackers(destDir, function(errorMessage)
		{
			this_.onUpdatedTrackers(errorMessage);
		});
		return;
	}

	delete this.autoUpdater;
}

MyUpdater.prototype.onUpdatedAutodl =
function(errorMessage)
{
	delete this.autoUpdater;
	if (errorMessage)
		return this.updateFailed("Could not update autodl-cz: " + errorMessage);

	// Reset trackersVersion since we may have overwritten with older files
	plugin.options.trackersVersion = 0;
	message(3, "Reloading autodl-cz...", MT_STATUS);
	client.dispatch("reload-plugin", { plugin: plugin } );
}

MyUpdater.prototype.onUpdatedTrackers =
function(errorMessage)
{
	if (errorMessage)
		return this.updateFailed("Could not update trackers: " + errorMessage);

	dmessage(4, "Trackers updated", MT_STATUS);
	plugin.options.trackersVersion = this.autoUpdater.getTrackersVersion();
	plugin.optionsModified = true;
	delete this.autoUpdater;
	plugin.readAllTrackers();
}

// Should be the last statement in the file to indicate it loaded successfully
true;
