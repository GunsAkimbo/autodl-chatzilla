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

function MySocket(name)
{
	this.name = name;
	this.writeQueue = [];
	this.numBytesWritten = 0;
	this.confirmedNumBytesWritten = 0;
	this.closeWhenWrittenAll = false;
}

MySocket.prototype.fatal =
function(errorMessage)
{
	this.close(errorMessage);
}

/**
 * This method gets called at various times by the transport. We only use it to figure out when all
 * currently written data have been sent to the destination. close() will set closeWhenWrittenAll
 * to the transport. When all data have been sent, this method will then call close(0) on the
 * transport. Calling it too early will cause not all bytes to be sent. Flushing the output stream
 * has no effect. Seems like this is the only safe method one can use.
 */
MySocket.prototype.onTransportStatus =
function(transport, status, progress, progressMax)
{
	try
	{
		const STATUS_SENDING_TO = 0x804b0005;	 
		if (status === STATUS_SENDING_TO)
		{
			this.confirmedNumBytesWritten = progress;
			if (this.closeWhenWrittenAll && this.confirmedNumBytesWritten >= this.numBytesWritten)
			{
				this.closeWhenWrittenAll.setEventSink(null, null);
				this.closeWhenWrittenAll.close(0);
				delete this.closeWhenWrittenAll;
			}
		}
	}
	catch (ex)
	{
		message(0, "MySocket.onTransportStatus: ex: " + formatException(ex), MT_ERROR);
	}
}

MySocket.prototype.connect =
function(host, port, config)
{
	config = config || {};

	this.ourThread = Components.classes["@mozilla.org/thread-manager;1"].getService().mainThread;

	var socketTransportService = Components.classes["@mozilla.org/network/socket-transport-service;1"].getService(Components.interfaces.nsISocketTransportService);

	var socketTypes = config.isSecure ? ["ssl"] : [];
	this.transport = socketTransportService.createTransport(socketTypes, socketTypes.length, host, port, null);
	if (!this.transport)
		return "Could not create transport";
//TODO: Init this.transport.securityCallbacks to an object ignoring all SSL errors

	this.transport.setEventSink(this, this.ourThread);

	this.inputStream = this.transport.openInputStream(0, 0, 0);
	if (!this.inputStream)
		return "Could not open input stream";
	this.binaryInputStream = createBinaryInputStream(this.inputStream);

	this.outputStream = this.transport.openOutputStream(0, 0, 0);
	if (!this.outputStream)
		return "Could not open output stream";

	return true;
}

/**
 * @param readListener	Gets called at various times. readListener.onStreamClose(this, errorMessage)
 *						when connection is closed. readListener.onStreamDataAvailable(this, data)
 *						when there's data.
 */
MySocket.prototype.readAsync =
function(readListener)
{
	if (readListener)
	{
		this.readListener = readListener;
		this.waitAsyncInputStreamReady();
	}
	else
	{
		if (this.inputStream)
			this.inputStream.asyncWait(null, 0, 0, null);
		delete this.readListener;
	}
}

MySocket.prototype.waitAsyncInputStreamReady =
function()
{
	if (this.inputStream)
		this.inputStream.asyncWait(this, 0, 0, this.ourThread);
}

MySocket.prototype.notifyListenerSocketClosed =
function(errorMessage)
{
	errorMessage = errorMessage || "";
	try
	{
		var readListener = this.readListener;
		delete this.readListener;
		if (readListener)
			readListener.onStreamClose(this, errorMessage);
	}
	catch (ex)
	{
		message(0, "MySocket.notifyListenerSocketClosed: ex: " + formatException(ex), MT_ERROR);
	}
	this.cancelWriteQueue(errorMessage);
}

MySocket.prototype.notifyListenerDataAvailable =
function(data)
{
	try
	{
		var readListener = this.readListener;
		if (readListener)
			readListener.onStreamDataAvailable(this, data);
	}
	catch (ex)
	{
		message(0, "MySocket.notifyListenerDataAvailable: ex: " + formatException(ex), MT_ERROR);
	}
}

// Returns number of bytes we can read from the input stream or null if the socket is closed
MySocket.prototype.getBytesAvailable =
function()
{
	try
	{
		return this.inputStream.available();
	}
	catch (ex)
	{
		return null;	// socket closed (eg. NS_BASE_STREAM_CLOSED)
	}
}

// Called when there's data to read from input stream
MySocket.prototype.onInputStreamReady =
function(stream)
{
	try
	{
		var numBytes = this.getBytesAvailable();
		if (numBytes === null)
			return this.notifyListenerSocketClosed();

		for (;;)
		{
			var numBytes = this.getBytesAvailable();
			if (numBytes === null)
				return this.notifyListenerSocketClosed();
			if (numBytes === 0)
				break;
			if (!this.binaryInputStream)
				return;
			var data = this.binaryInputStream.readBytes(numBytes);
			this.notifyListenerDataAvailable(data);
		}
		this.waitAsyncInputStreamReady();
	}
	catch (ex)
	{
		this.fatal("MySocket.onInputStreamReady: ex: " + formatException(ex));
	}
}

/**
 * Write data asynchronously. The callback is called when the data have been sent:
 * callback(this, errorMessage, numBytesWritten).
 */
MySocket.prototype.writeAsync =
function(data, callback)
{
	this.writeQueue.push(
	{
		data: data,
		callback: callback,
	});
	this.waitAsyncOutputStreamReady();
}

// Cancel all pending writes
MySocket.prototype.cancelWriteQueue =
function(errorMessage)
{
	errorMessage = errorMessage || "Cancelling write queue";

	for (var i = 0; i < this.writeQueue.length; i++)
	{
		try
		{
			this.writeQueue[i].callback(this, errorMessage, 0);
		}
		catch (ex)
		{
		}
	}

	this.writeQueue = [];
}

MySocket.prototype.waitAsyncOutputStreamReady =
function()
{
	if (this.outputStream)
		this.outputStream.asyncWait(this, 0, 0, this.ourThread);
}

// Called when we can write data to output stream
MySocket.prototype.onOutputStreamReady =
function(stream)
{
	try
	{
		var job = this.writeQueue.shift();
		if (!job || !this.outputStream)
			return;

		try
		{
			var numBytesWritten = this.outputStream.write(job.data, job.data.length);
			this.numBytesWritten += numBytesWritten;
		}
		catch (ex)
		{
			if (ex.name === "NS_BASE_STREAM_WOULD_BLOCK")
				this.writeQueue.unshift(job);
			else if (ex.name === "NS_ERROR_NET_RESET")
				return this.fatal("Connection reset");
			else
				throw ex;
		}
		if (numBytesWritten !== undefined)
			job.callback(this, "", numBytesWritten);

		if (this.writeQueue.length > 0)
			this.waitAsyncOutputStreamReady();
	}
	catch (ex)
	{
		this.fatal("MySocket.onOutputStreamReady: ex: " + formatException(ex));
	}
}

MySocket.prototype.close =
function(errorMessage)
{
	if (!errorMessage && this.outputStream)
		this.outputStream.flush();
	if (this.inputStream)
		this.inputStream.asyncWait(null, 0, 0, null);
	if (this.outputStream)
		this.outputStream.asyncWait(null, 0, 0, null);
	if (this.transport)
	{
		if (!errorMessage && this.confirmedNumBytesWritten < this.numBytesWritten)
			this.closeWhenWrittenAll = this.transport;
		else
		{
			this.transport.setEventSink(null, null);
			this.transport.close(0);
		}
	}
	delete this.transport;
	delete this.inputStream;
	delete this.outputStream;
	delete this.binaryInputStream;

	this.notifyListenerSocketClosed(errorMessage);
}

// Should be the last statement in the file to indicate it loaded successfully
true;
