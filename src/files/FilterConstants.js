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

var tvResolutions =
[
	["Portable Device", "PD"],
	["SD", "SDTV", "Standard Def", "Standard Definition"],
	["480i"],
	["480p"],
	["576p"],
	["720p"],
	["810p"],
	["1080i"],
	["1080p"],
];

var tvSources =
[
	["DSR"],
	["PDTV"],
	["HDTV"],
	["HR.PDTV"],
	["HR.HDTV"],
	["DVDRip"],
	["DVDScr", "DVDScrener", "DVD-Screner"],
	["BDr"],
	["BD5"],
	["BD9"],
	["BDRip"],
	["BRRip", "BLURAYRiP"],
	["DVDR", "MDVDR", "DVD"],
	["HDDVD", "HD-DVD"],
	["HDDVDRip"],
	["BluRay", "Blu-Ray", "MBluRay"],
	["WEB-DL", "WEB", "WEBDL"],
	["TVRip", "TV"],
	["CAM"],
	["R5"],
	["TELESYNC", "TS"],
	["TELECINE", "TC"],
];

var tvEncoders =
[
	["XviD", "XvidHD"],
	["DivX"],
	["x264"],
	["h.264", "h264"],
	["mpeg2", "mpeg-2"],
	["VC-1", "VC1"],
	["WMV", "WMV-HD"],
];

var musicFormats =
[
	["MP3"],
	["FLAC"],
	["Ogg"],
	["AAC"],
	["AC3"],
	["DTS"],
];

var musicBitrates =
[
	["192"],
	["APS (VBR)"],
	["V2 (VBR)"],
	["V1 (VBR)"],
	["256"],
	["APX (VBR)"],
	["V0 (VBR)"],
	["q8.x (VBR)"],
	["320"],
	["Lossless"],
	["24bit Lossless"],
	["Other"],
];

var musicMedia =
[
	["CD"],
	["DVD"],
	["Vinyl"],
	["Soundboard"],
	["SACD"],
	["DAT"],
	["Cassette"],
	["WEB"],
	["Other"],
];

// Should be the last statement in the file to indicate it loaded successfully
true;
