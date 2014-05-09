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

//TODO: When restarting autodl, remember the queue

function ScriptExecQueue()
{
	this.queue = [];
	this.queueSorted = true;
}

ScriptExecQueue.prototype.enqueue =
function(scriptExec, execTime)
{
	this.queue.push(
	{
		scriptExec: scriptExec,
		execTime: execTime,
	});
	this.queueSorted = false;

	if (execTime <= newDate())
		this.exec();
}

ScriptExecQueue.prototype.sortQueue =
function()
{
	if (this.queueSorted)
		return;
	this.queue.sort(function(a, b)
	{
		if (a.execTime < b.execTime)
			return -1;
		if (a.execTime > b.execTime)
			return 1;
		return 0;
	});
	this.queueSorted = true;
}

ScriptExecQueue.prototype.exec =
function()
{
	this.sortQueue();

	var currTime = newDate();
	while (this.queue.length > 0)
	{
		var queueInfo = this.queue[0];
		if (queueInfo.execTime > currTime)
			break;
		this.queue.shift();
		queueInfo.scriptExec.exec();
	}
}

// Should be the last statement in the file to indicate it loaded successfully
true;
