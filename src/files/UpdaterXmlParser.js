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

//
// Parses the update.xml file
//

function UpdaterXmlParser()
{
}

UpdaterXmlParser.prototype.parse =
function(xmlData)
{
	var doc = parseXmlString(xmlData);
	var updateElem = getTheChildElement(doc, "update");
	var czElem = getTheChildElement(updateElem, "cz");

	var autodlElem = getTheChildElement(czElem, "autodl");
	this._parseAutodlElement(autodlElem);

	var trackersElem = getTheChildElement(czElem, "trackers");
	this._parseTrackersElement(trackersElem);
}

UpdaterXmlParser.prototype._parseAutodlElement =
function(autodlElem)
{
	this.autodl =
	{
		version:	readTextNode(autodlElem, "version"),
		whatsNew:	readTextNode(autodlElem, "whats-new"),
		url:		readTextNode(autodlElem, "url"),
	};
	if (this.autodl.version === undefined || this.autodl.whatsNew === undefined ||
		this.autodl.url === undefined || !this.autodl.version.match(/^\d\.\d\d$/))
	{
		throw  "Invalid XML file";
	}
	this.autodl.whatsNew = this.autodl.whatsNew.replace(/^\s+/mg, "");
}

UpdaterXmlParser.prototype._parseTrackersElement =
function(trackersElem)
{
	this.trackers =
	{
		version:	readTextNode(trackersElem, "version"),
		url:		readTextNode(trackersElem, "url"),
	};
	if (this.trackers.version === undefined || this.trackers.url === undefined ||
		!this.trackers.version.match(/^\d+$/))
	{
		throw  "Invalid XML file";
	}
	this.trackers.version = +this.trackers.version;
}

// Should be the last statement in the file to indicate it loaded successfully
true;
