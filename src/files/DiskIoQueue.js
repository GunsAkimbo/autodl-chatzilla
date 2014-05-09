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

const MAX_DISKIO_MS = 100;

function DiskIoQueue()
{
	this.queue = [];
	this.addedTimer = false;
}

DiskIoQueue.ASYNC = 0;
DiskIoQueue.FINISHED = 1;
DiskIoQueue.YIELD = 2;

DiskIoQueue.prototype.MAX_DISKIO_BYTES_BEFORE_YIELD = 4*1024*1024;

DiskIoQueue.prototype.enqueue =
function(job, callback)
{
	job.callback = callback;

	this.queue.push(job);
	this.start();
}

DiskIoQueue.prototype.hasJob =
function()
{
	return this.queue.length > 0 || this.savedJob;
}

DiskIoQueue.prototype.start =
function()
{
	if (!this.hasJob() || this.addedTimer || this.savedJobIsAsync)
		return;

	var this_ = this;
	// I've tested various values of timeoutInMs and MAX_DISKIO_BYTES_BEFORE_YIELD when copying
	// a 500-600MB file.
	//	timeoutInMs / MAX_DISKIO_BYTES_BEFORE_YIELD / comment
	//	10 / 4MB / Could use ChatZilla, but still slow.
	//	20 / 4MB / Easy to use, but some slowdowns. Much better than 10ms/4MB
	//	30 / 4MB / Easy to use. Only slightly worse disk I/O than 10ms/4MB.
	const timeoutInMs = 30;
	window.setTimeout(function() { this_.onProcess(); }, timeoutInMs);

	this.addedTimer = true;
}

DiskIoQueue.prototype.jobFinished =
function(job, errorMessage)
{
	if (!job)
		return;

	try
	{
		job.callback(errorMessage || "");
	}
	catch (ex)
	{
		message(0, "DiskIoQueue.jobFinished: ex: " + formatException(ex), MT_ERROR);
	}
}

DiskIoQueue.prototype.onProcess =
function(ev)
{
	this.addedTimer = false;

	try
	{
		this.allJobsLoop();
	}
	catch (ex)
	{
		message(0, "DiskIoQueue.onProcess: ex: " + formatException(ex), MT_ERROR);
	}
}

DiskIoQueue.prototype.allJobsLoop =
function()
{
	try
	{
		if (this.savedJobIsAsync)
			return;

		this.diskIoStart = +newDate();

		for (;;)
		{
			var job = this.savedJob || this.queue.shift();
			this.savedJob = null;
			if (!job)
				break;

			var rv = this.jobHandlerLoop(job);
			switch (rv)
			{
			case DiskIoQueue.ASYNC:
				this.savedJob = job;
				this.savedJobIsAsync = true;
				return;

			case DiskIoQueue.FINISHED:
				this.jobFinished(job);
				break;

			case DiskIoQueue.YIELD:
				this.savedJob = job;
				this.start();
				return;

			default:
				// Check if the job returned an error string
				if (typeof rv === "string")
					this.jobFinished(job, rv);
				else
					message(0, "DiskIoQueue: Invalid return value: " + rv, MT_ERROR);
				break;
			}
		}
	}
	catch (ex)
	{
		var errorMessage;
		if (typeof ex === "string")
			errorMessage = ex;
		else
		{
			errorMessage = "DiskIoQueue.allJobsLoop: ex: " + formatException(ex);
			message(0, errorMessage, MT_ERROR);
		}
		this.jobFinished(job, errorMessage);
		this.start();
	}
}

DiskIoQueue.prototype.jobHandlerLoop =
function(job)
{
	try
	{
		for (;;)
		{
			var rv;
			// asyncJobCompleted() sets asyncReturnValue
			if (this.asyncReturnValue !== undefined)
			{
				rv = this.asyncReturnValue;
				delete this.asyncReturnValue;
			}
			else
			{
				rv = job.handler();
			}

			if (rv !== DiskIoQueue.YIELD)
				return rv;

			var totalTime = (+newDate()) - this.diskIoStart;
			if (totalTime >= MAX_DISKIO_MS)
				return DiskIoQueue.YIELD;
		}
	}
	catch (ex)
	{
		if (typeof ex === "string")
			return ex;
		return "DiskIoQueue.jobHandlerLoop: ex: " + formatException(ex);
	}
}

// All async jobs must call this method once the async I/O has completed
DiskIoQueue.prototype.asyncJobCompleted =
function(rv)
{
	if (!this.savedJob || !this.savedJobIsAsync)
	{
		message(0, "DiskIoQueue.asyncJobCompleted: invalid savedJob: " + this.savedJob + " or savedJobIsAsync: " + this.savedJobIsAsync, MT_ERROR);
		return;
	}

	// Remember return value for jobHandlerLoop()
	this.asyncReturnValue = rv;
	this.savedJobIsAsync = false;
	this.allJobsLoop();
}

// Should be the last statement in the file to indicate it loaded successfully
true;
