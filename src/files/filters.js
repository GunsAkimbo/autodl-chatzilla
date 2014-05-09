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
var textboxFilterName;

var uploadMethod;

var addMusicFormatButton;
var addMusicBitrateButton;
var addMusicMediaButton;
var addTvResolutionButton;
var addTvSourceButton;
var addTvEncoderButton;
var menulistScene;
var menulistLog;
var menulistCue;
var matchSitesButton;
var exceptSitesButton;
var syncTextBoxesName1;
var syncTextBoxesYears;

function ThreeStateMenulist(menulistId)
{
	this.menulist = document.getElementById(menulistId);

	this.menupopup = document.createElement("menupopup");
	this.menulist.appendChild(this.menupopup);

	var values = ["Don't care", "Yes", "No"];
	for (var i = 0; i < values.length; i++)
	{
		var menuitem = document.createElement("menuitem");
		menuitem.setAttribute("label", values[i]);
		this.menupopup.appendChild(menuitem);
	}
}

ThreeStateMenulist.prototype.getState =
function()
{
	var theState = "";
	if (this.menulist.selectedIndex === 1)
		theState = "true";
	else if (this.menulist.selectedIndex === 2)
		theState = "false";
	return theState;
}

ThreeStateMenulist.prototype.setState =
function(value, isEnabled)
{
	if (value === "true")
		this.menulist.selectedIndex = 1;
	else if (value === "false")
		this.menulist.selectedIndex = 2;
	else
		this.menulist.selectedIndex = 0;

	this.menulist.disabled = !isEnabled;
}

function SitesButton(textboxId, buttonId)
{
	var this_ = this;

	this.textbox = document.getElementById(textboxId);
	this.button = document.getElementById(buttonId);
	this.button.addEventListener("command", function(e) { this_.onClick(); }, true);
}

SitesButton.prototype.onClick =
function()
{
	var listboxData = [];
	for (var trackerType in plugin.trackers)
	{
		var tracker = plugin.trackers[trackerType];
		listboxData.push(
		{
			displayName: tracker.longName,
			validNames:
			[
				tracker.type,
				tracker.siteName,
				tracker.longName,
			],
		});
	}

	var data =
	{
		selectedText: this.textbox.value,
		listboxData: listboxData,
		multiSelect: true,
		title: "Press and hold CTRL to select more than one tracker.",
	};

	plugin_openDialog(
	{
		window: window,
		varName: "filters:Sites",
		xulFile: "files/listbox.xul",
		arg1: data,
		isModal: true,
	});

	this.textbox.value = data.selectedText;
}

function AddMenuButton(textboxId, buttonId, menupopupId, strings, onlyAppendValues, sortIt)
{
	var this_ = this;

	this.textbox = document.getElementById(textboxId);
	this.button = document.getElementById(buttonId);
	this.menupopup = document.getElementById(menupopupId);
	this.onlyAppendValues = !!onlyAppendValues;

	this.strings = [];
	for (var i = 0; i < strings.length; i++)
		this.strings[i] = strings[i];
	if (sortIt === undefined || sortIt === true)
	{
		this.strings.sort(function(a, b)
		{
			return stringCompare(a[0].toLowerCase(), b[0].toLowerCase());
		});
	}

	this.menupopup.addEventListener("popupshowing", function(e) { this_.onPopupShowing(); }, true);

	function appendMenuItem(label, value, isCheckBox)
	{
		var elem = document.createElement("menuitem");
		elem.setAttribute("label", label);
		elem.setAttribute("value", value);
		if (isCheckBox)
			elem.setAttribute("type", "checkbox");
		elem.addEventListener("command", function(e) { this_.onCommandMenuItem(elem); }, true);
		this_.menupopup.appendChild(elem);
	}

	for (var i = 0; i < this.strings.length; i++)
	{
		appendMenuItem(this.strings[i][0], i, !this.onlyAppendValues);
	}
}

// Called before the popup menu is shown. Initializes the checkboxes.
AddMenuButton.prototype.onPopupShowing =
function()
{
	var checked = [];

	if (!this.onlyAppendValues)
	{
		var ary = this.textbox.value.split(",");
		for (var i = 0; i < ary.length; i++)
		{
			var name = stringTrim(ary[i]).toLowerCase();
			for (var j = 0; j < this.strings.length; j++)
			{
				var strings = this.strings[j];
				for (var k = 0; k < strings.length; k++)
				{
					if (checkFilterStrings(strings[k], name))
						checked[j] = true;
				}
			}
		}
	}

	for (var i = 0; i < this.strings.length; i++)
	{
		var elem = this.menupopup.childNodes[i];
		elem.setAttribute("checked", !!checked[i]);
	}
}

// Called when the user has clicked a menuitem
AddMenuButton.prototype.onCommandMenuItem =
function(clickedElem)
{
	if (this.onlyAppendValues)
	{
		var s = this.textbox.value;
		if (s.length !== 0)
			s += ", ";
		s += clickedElem.label;
		this.textbox.value = s;
		return;
	}

	var s = "";

	for (var i = 0; i < this.strings.length; i++)
	{
		elem = this.menupopup.childNodes[i];
		var isChecked = readAttributeBoolean(elem, "checked");
		if (isChecked === true)
		{
			if (s.length !== 0)
				s += ", ";
			s += this.strings[i][0];
		}
	}

	this.textbox.value = s;
}

// Makes sure a bunch of textboxes contain the same value
function SyncTextBoxes(ids)
{
	var this_ = this;

	this.textboxElems = [];
	for (var i = 0; i < ids.length; i++)
	{
		(function(i)
		{
			var textbox = document.getElementById(ids[i]);
			this_.textboxElems[i] = textbox;
			textbox.addEventListener("input", function(e) { this_.setNewValue(i); }, true);
		})(i);
	}
}

// Updates each textbox with the new value
SyncTextBoxes.prototype.setNewValue =
function(index)
{
	var newValue = this.textboxElems[index].value;
	for (var i = 0; i < this.textboxElems.length; i++)
	{
		if (i === index)
			continue;
		this.textboxElems[i].value = newValue;
	}
}

// Called right before the dialog is displayed. Initialize stuff!
function onDlgLoad()
{
	try
	{
		plugin = window.arguments[0];

		textboxFilterName = document.getElementById("filter-name");
		textboxFilterName.addEventListener("input", filterName_onInput, true);
		document.getElementById("filter-add").addEventListener("command", onNewFilter, true);
		document.getElementById("filter-remove").addEventListener("command", onRemoveFilter, true);

		addMusicFormatButton = new AddMenuButton("match-format", "add-format-button", "add-format-menupopup", musicFormats);
		addMusicBitrateButton = new AddMenuButton("match-bitrate", "add-bitrate-button", "add-bitrate-menupopup", musicBitrates, true);
		addMusicMediaButton = new AddMenuButton("match-media", "add-media-button", "add-media-menupopup", musicMedia);
		addTvResolutionButton = new AddMenuButton("tv-resolutions", "add-resolution-button", "add-resolution-menupopup", tvResolutions, undefined, false);
		addTvSourceButton = new AddMenuButton("tv-sources", "add-source-button", "add-source-menupopup", tvSources);
		addTvEncoderButton = new AddMenuButton("tv-encoders", "add-encoder-button", "add-encoder-menupopup", tvEncoders);
		menulistScene = new ThreeStateMenulist("match-scene");
		menulistLog = new ThreeStateMenulist("match-log");
		menulistCue = new ThreeStateMenulist("match-cue");
		matchSitesButton = new SitesButton("match-sites", "match-sites-button");
		exceptSitesButton = new SitesButton("except-sites", "except-sites-button");
		syncTextBoxesName1 = new SyncTextBoxes(["match-artist", "tv-show"]);
		syncTextBoxesYears = new SyncTextBoxes(["match-year", "tv-year"]);

		uploadMethod = new UploadMethod();
		uploadMethod.onDlgLoad();

		initializeFilters(plugin.filters);
	}
	catch (ex)
	{
		alert("Got an exception in onDlgLoad(): " + ex);
	}

	return true;
}

// Called when the filter name text box is changed
// 'this' is the textbox.
function filterName_onInput(e)
{
	myListbox.setUserObjName(myListbox.getActiveUserObj(), textboxFilterName.value);
}

// Called when the New button is pressed.
// 'this' is the button.
function onNewFilter(e)
{
	var filter =
	{
		name: "",
		enabled: true,
		matchReleases: "",
		exceptReleases: "",
		matchCategories: "",
		exceptCategories: "",
		matchUploaders: "",
		exceptUploaders: "",
		matchSites: "",
		exceptSites: "",
		minSize: "",
		maxSize: "",
		maxPreTime: "",
		maxTriggers: 0,
		seasons: "",
		episodes: "",
		resolutions: "",
		sources: "",
		encoders: "",
		years: "",
		artists: "",
		albums: "",
		formats: "",
		bitrates: "",
		media: "",
		tags: "",
		scene: "",
		log: "",
		cue: "",
		uploadMethod: plugin.scope.createUploadMethod(),
	};

	filter = myListbox.appendUserObj(filter, filter.name);
	myListbox.makeUserObjActive(filter);
	textboxFilterName.focus();
}

// Called when the Remove button is pressed.
// 'this' is the button.
function onRemoveFilter(e)
{
	if (!confirm("Do you really want to remove the selected filter?", "Remove filter"))
		return;

	var filter = myListbox.getActiveUserObj();
	myListbox.removeUserObj(filter);
}

// Initialize the dialog box from the current filters
function initializeFilters(filters)
{
	myListbox = new MyListBox("filter-listbox");
	myListbox.userObjSelected = function(newFilter, oldFilter) { onFilterSelected(newFilter, oldFilter); };

	updateFilterOptions(null);
	for (var i = 0; i < filters.length; i++)
	{
		var filter = filters[i];
		myListbox.appendUserObj(filter, filter.name);
	}

	textboxFilterName.focus();
}

function onFilterSelected(newFilter, oldFilter)
{
	saveFilterOptions(oldFilter);
	updateFilterOptions(newFilter);
}

// Save the right side's filter option values in filter
function saveFilterOptions(filter)
{
	if (!filter)
		return;

	function getValue(id)
	{
		return document.getElementById(id).value;
	}
	function saveString(id, propName)
	{
		filter[propName] = getValue(id);
	}
	function saveNumber(id, propName)
	{
		filter[propName] = parseInt(getValue(id), 10);
	}
	function saveCheckbox(id, propName)
	{
		filter[propName] = !!document.getElementById(id).checked;
	}
	function saveThreeState(threestate, propName)
	{
		filter[propName] = threestate.getState();
	}

	saveString("filter-name", "name");
	saveCheckbox("filter-enabled", "enabled")
	saveString("match-releases", "matchReleases");
	saveString("except-releases", "exceptReleases");
	saveString("match-categories", "matchCategories");
	saveString("except-categories", "exceptCategories");
	saveString("match-uploaders", "matchUploaders");
	saveString("except-uploaders", "exceptUploaders");
	saveString("match-sites", "matchSites");
	saveString("except-sites", "exceptSites");
	saveString("minimum-size", "minSize");
	saveString("maximum-size", "maxSize");
	saveString("maximum-pretime", "maxPreTime");
	saveNumber("maximum-triggers", "maxTriggers");
	saveString("tv-seasons", "seasons");
	saveString("tv-episodes", "episodes");
	saveString("tv-resolutions", "resolutions");
	saveString("tv-sources", "sources");
	saveString("tv-encoders", "encoders");
	saveString("match-year", "years");
	saveString("match-artist", "artists");
	saveString("match-album", "albums");
	saveString("match-format", "formats");
	saveString("match-bitrate", "bitrates");
	saveString("match-media", "media");
	saveString("match-tags", "tags");
	saveThreeState(menulistScene, "scene");
	saveThreeState(menulistLog, "log");
	saveThreeState(menulistCue, "cue");

	uploadMethod.saveValues(filter.uploadMethod, true);
}

// Update the right side of the dialog box with a new filter
function updateFilterOptions(filter)
{
	function setValueString(id, propName)
	{
		var val = filter ? filter[propName] : "";
		var elem = document.getElementById(id);
		elem.value = val;
		elem.disabled = !filter;
	}
	function setValueNumber(id, propName)
	{
		setValueString(id, propName);
	}
	function setCheckbox(id, propName)
	{
		var val = !!(filter ? filter[propName] : false);
		var elem = document.getElementById(id);
		elem.checked = val;
		elem.disabled = !filter;
	}
	function setThreeState(threestate, propName)
	{
		threestate.setState(filter ? filter[propName] : "", !!filter);
	}
	function setDisabledButtonState(id)
	{
		document.getElementById(id).disabled = !filter;
	}
	function setSyncString(syncTextboxes, propName)
	{
		for (var i = 0; i < syncTextboxes.textboxElems.length; i++)
			setValueString(syncTextboxes.textboxElems[i].id, propName);
	}

	setValueString("filter-name", "name");
	setCheckbox("filter-enabled", "enabled")
	setValueString("match-releases", "matchReleases");
	setValueString("except-releases", "exceptReleases");
	setValueString("match-categories", "matchCategories");
	setValueString("except-categories", "exceptCategories");
	setValueString("match-uploaders", "matchUploaders");
	setValueString("except-uploaders", "exceptUploaders");
	setValueString("match-sites", "matchSites");
	setValueString("except-sites", "exceptSites");
	setValueString("minimum-size", "minSize");
	setValueString("maximum-size", "maxSize");
	setValueString("maximum-pretime", "maxPreTime");
	setValueNumber("maximum-triggers", "maxTriggers");
	setValueString("tv-seasons", "seasons");
	setValueString("tv-episodes", "episodes");
	setValueString("tv-resolutions", "resolutions");
	setValueString("tv-sources", "sources");
	setValueString("tv-encoders", "encoders");
	setValueString("match-album", "albums");
	setValueString("match-format", "formats");
	setValueString("match-bitrate", "bitrates");
	setValueString("match-media", "media");
	setValueString("match-tags", "tags");
	setThreeState(menulistScene, "scene");
	setThreeState(menulistLog, "log");
	setThreeState(menulistCue, "cue");

	setSyncString(syncTextBoxesName1, "artists");
	setSyncString(syncTextBoxesYears, "years");

	setDisabledButtonState("add-format-button");
	setDisabledButtonState("add-bitrate-button");
	setDisabledButtonState("add-media-button");
	setDisabledButtonState("match-sites-button");
	setDisabledButtonState("except-sites-button");
	setDisabledButtonState("add-resolution-button");
	setDisabledButtonState("add-encoder-button");
	setDisabledButtonState("add-source-button");
	setDisabledButtonState("filter-remove");

	uploadMethod.initializeGui(filter ? filter.uploadMethod : null, true);
}

// Called when the user clicks OK or presses the Enter key
function onDialogAccept()
{
	try
	{
		plugin.filters = myListbox.getCleanUserObjArray();
	}
	catch (ex)
	{
		alert("Got an exception in onDialogAccept(): " + ex);
	}

	plugin.optionsModified = true;
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
	plugin.scope.dialogFilters = null;
}

// Should be the last statement in the file to indicate it loaded successfully
true;
