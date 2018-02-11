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

const DEFAULT_USER_AGENT = "autodl-cz";

const USE_OLD_CANONICALIZED_RELEASENAME = true;

// Webui commands
const WEBUI_SETMAXUL = "setmaxul";
const WEBUI_SETMAXDL = "setmaxdl";
const WEBUI_SETLABEL = "setlabel";
const WEBUI_START = "start";
const WEBUI_STOP = "stop";
const WEBUI_PAUSE = "pause";
const WEBUI_UNPAUSE = "unpause";
const WEBUI_FORCESTART = "forcestart";
const WEBUI_RECHECK = "recheck";
const WEBUI_REMOVE = "remove";				// Removes torrent, not the data
const WEBUI_REMOVEDATA = "removedata";		// Removes torrent and data
const WEBUI_QUEUEBOTTOM = "queuebottom";
const WEBUI_QUEUETOP = "queuetop";
const WEBUI_QUEUEUP = "queueup";
const WEBUI_QUEUEDOWN = "queuedown";

// Upload method constants
const UPLOAD_MIN = 0;
const UPLOAD_WATCH_FOLDER = 0;
const UPLOAD_WEBUI = 1;
const UPLOAD_FTP = 2;
const UPLOAD_TOOL = 3;
const UPLOAD_UTORRENT_DIR = 4;
const UPLOAD_SONARR = 5;
const UPLOAD_RADARR = 6;
const UPLOAD_MAX = 6;

// Update constants
const UPDATE_MIN = 0;
const UPDATE_AUTO = 0;
const UPDATE_ASK = 1;
const UPDATE_DISABLED = 2;
const UPDATE_MAX = 2;

// extract command
const EXTRACT_DEST_FOLDER = 0;
const EXTRACT_DEST_FOLDER_ROOT = 1;
const EXTRACT_DEST_FOLDER_PARENT = 2;
const EXTRACT_SOURCE_FOLDER = 3;
const EXTRACT_SOURCE_FOLDER_ROOT = 4;
const EXTRACT_SOURCE_FOLDER_PARENT = 5;

// Should be the last statement in the file to indicate it loaded successfully
true;
