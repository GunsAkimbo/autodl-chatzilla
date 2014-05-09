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

// StreamListener which saves all binary data in a string
function BinaryStreamListener()
{
}

BinaryStreamListener.prototype.onStartRequest =
function(request, context)
{
	this.data = "";
}

BinaryStreamListener.prototype.onDataAvailable =
function(request, context, inputStream, offset, count)
{
	var bstream = createBinaryInputStream(inputStream);
	this.data += bstream.readBytes(count);
}

BinaryStreamListener.prototype.onStopRequest =
function(request, context, statusCode)
{
}

BinaryStreamListener.prototype.getDataAsString =
function()
{
	return this.data;
}

function Cookies()
{
	this.cookies = {};
}

Cookies.prototype.add =
function(name, value)
{
	this.cookies[name] = value;
}

Cookies.prototype.toString =
function()
{
	var rv = "";
	for (var name in this.cookies)
	{
		if (rv)
			rv += "; ";
		rv += name + "=" + this.cookies[name];
	}
	return rv;
}

// XMLHttpRequest doesn't work with binary data so we must write our own
function HttpRequest()
{
	this.connection = null;
	this.data = "";
	this.userAgent = plugin.options.userAgent || DEFAULT_USER_AGENT;
	this.follow3xxLocation = false;
	this.checkHttpErrors = true;
	this.numRedirects = 0;
	this.debugMessages = true;
}

HttpRequest.prototype.setFollowNewLocation =
function()
{
	this.follow3xxLocation = true;
}

HttpRequest.prototype._callUser =
function(errorMessage)
{
	var oldConnection = this.connection;
	this.connection = null;

	try
	{
		if (this.completionHandler)
		{
			// To prevent memory leaks due to circular references, remove the callback now
			var completionHandler = this.completionHandler;
			delete this.completionHandler;
			completionHandler(this, errorMessage);
		}
		this.cleanUpConnection(oldConnection);
	}
	catch (ex)
	{
		this.fatal("HttpRequest::_callUser: ex: " + formatException(ex));
	}
}

HttpRequest.prototype.printDebugMessages =
function(val)
{
	this.debugMessages = val;
}

HttpRequest.prototype.message =
function(level, msg, type)
{
	if (this.debugMessages)
		message(level, msg, type);
}

HttpRequest.prototype.dmessage =
function(level, msg, type)
{
	if (this.debugMessages)
		dmessage(level, msg, type);
}

// Called when we can't possibly continue
HttpRequest.prototype.fatal =
function(errorMessage)
{
	this._callUser(errorMessage);
}

// Called when something failed and we should retry the request
HttpRequest.prototype.retry =
function (errorMessage)
{
	try
	{
		var elapsedTimeInSecs = ((newDate()).getTime() - this.requestStartTime.getTime()) / 1000;
		if (elapsedTimeInSecs > plugin.options.maxDownloadRetryTimeSeconds)
		{
			this.fatal("Timed out! Error: '" + errorMessage + "'");
			return;
		}
		this.retryCount++;
		this.retryErrorMessage = errorMessage;

		if (this.retryTimer)
			this.retryTimer.cancel();
		else
			this.retryTimer = Components.classes["@mozilla.org/timer;1"].createInstance(Components.interfaces.nsITimer);

		var this_ = this;
		this.retryTimer.initWithCallback({ notify: function(timer) { this_.sendGetRequestInternal(); } }, this.getRetryTimeout(this.retryCount - 1), this.retryTimer.TYPE_ONE_SHOT);
	}
	catch (ex)
	{
		this.fatal("HttpRequest.retry: ex: " + formatException(ex));
		return;
	}
}

HttpRequest.prototype.getRetryTimeout =
function(retryCount)
{
	return 2000;
}

/**
 * @param url	The URL we should use
 * @param httpHeaders	Any extra HTTP headers we should use. An Object.
 * @param completionHandler	Notified on completion like completionHandler(httpRequest, errorMessage)
 */
HttpRequest.prototype.sendGetRequest =
function(url, httpHeaders, completionHandler)
{
	return this.sendRequest("GET", undefined, url, httpHeaders, completionHandler);
}

HttpRequest.prototype.sendRequest =
function(method, methodData, url, httpHeaders, completionHandler)
{
	this.method = method.toUpperCase();
	this.methodData = methodData;
	this.completionHandler = completionHandler;
	this.url = url;
	this.httpHeaders = httpHeaders;
	this.retryCount = 0;
	this.requestStartTime = newDate();
	this.sendGetRequestInternal();
}

HttpRequest.prototype.retryRequest =
function(errorMessage, completionHandler)
{
	errorMessage = errorMessage || "retryRequest() called";
	this.completionHandler = completionHandler;
	return this.retry(errorMessage);
}

HttpRequest.prototype.sendGetRequestInternal =
function()
{
	try
	{
		this.deleteConnection();
		this.connection = new CBSConnection(true);
		this.data = "";

		if (this.retryCount)
			this.message(4, "Retrying request (" + this.retryCount + ") " + this.url + ", error was: " + this.retryErrorMessage, MT_STATUS);

		var ary = this.url.match(/^(\w+):\/\/([^\/]+)(\/.*)/);
		if (!ary)
			return this.fatal("Invalid url: '" + this.url + "'");
		var protocol = ary[1];
		var hostname = ary[2];
		var path = ary[3];
		var port = protocol === "https" ? "443" : "80";
		ary = hostname.match(/([^:]+):(.+)/);
		if (ary)
		{
			hostname = ary[1];
			if (ary[2].length !== 0)
				port = ary[2];
		}
		var isSecure = protocol === "https";

		this.dmessage(5, "Trying to connect: url: " + this.url);
		if (this.connection.connect(hostname, port, { isSecure: isSecure }))
		{
			this.dmessage(5, "Now connected: url: " + this.url);

			var msg =
			this.method + " " + path + " HTTP/1.1\r\n" +
			"Host: " + hostname + "\r\n" +
			"User-Agent: " + this.userAgent + "\r\n" +
			"Accept: */*\r\n" +
			"Accept-Encoding: gzip\r\n" +
			"Connection: close\r\n";
			for (var prop in this.httpHeaders)
				msg += prop + ": " + this.httpHeaders[prop] + "\r\n";
			if (this.methodData !== undefined)
				msg += "Content-Length: " + this.methodData.length + "\r\n";
			msg += "\r\n";

			if (this.methodData !== undefined)
				msg += this.methodData + "\r\n";

			this.dmessage(5, "Sending HTTP headers:\n" + msg.substr(0, 700), MT_STATUS);
			this.connection.sendData(msg);
			this.connection.startAsyncRead(this);
		}
		else
		{
			this.dmessage(5, "Failed to connect: url: " + this.url);
			this.retry("Could not connect")
		}
	}
	catch (ex)
	{
		this.fatal("HttpRequest.sendGetRequestInternal: ex: " + formatException(ex));
	}
}

// Called when there's data to read
HttpRequest.prototype.onStreamDataAvailable =
function(request, inStream, sourceOffset, count)
{
	try
	{
		if (!this.connection)
			return;
		var str = this.connection.readData(0, count);
		this.data += str;
	}
	catch (ex)
	{
		this.message(0, "HttpRequest.onStreamDataAvailable(): Exception: " + formatException(ex), MT_ERROR);
	}
}

// Called when the connection is closed
HttpRequest.prototype.onStreamClose =
function(status)
{
	try
	{
		if (!this.connection)
			return;
		do
		{
			if (status !== 0)
			{
				var msg = "Error code 0x" + status.toString(16);

				// All SEC_ERROR_XXX codes, see here http://silver.warwickcompsoc.co.uk/mozilla/misc/nserror_list
				// or better yet the mozilla source code.
				if (0x805A1F55 <= status && status <= 0x805A2000)
				{
					this.fatal(msg + " probably an invalid certificate. Add an exception in FireFox!");
					return;
				}
				if (status === 0x804b001e)
				{
					this.fatal(msg + " (NS_ERROR_UNKNOWN_HOST), DNS lookup failed");
					return;
				}
				if (status === 0x804B000E)
					msg += " (NS_ERROR_NET_TIMEOUT)";
				else if (status === 0x804B0014)
					msg += " (NS_ERROR_NET_RESET)";
				this.retry(msg);
				return;
			}

			if (!this.parseResponse())
			{
				this.retry("Could not parse HTTP response header");
				return;
			}

			var contentLength = this.getResponseHeader("content-length");
			if (contentLength !== undefined && parseInt(contentLength, 10) > this.response.content.length)
			{
				this.retry("Missing bytes; expected " + contentLength + " but got " + this.response.content.length);
				return;
			}

			var transferEncoding = this.getResponseHeader("transfer-encoding");
			if (transferEncoding !== undefined)
			{
				if (transferEncoding.toLowerCase() !== "chunked")
				{
					this.fatal("Invalid Transfer-Encoding: '" + transferEncoding + "'");
					return;
				}
				if (!this.fixChunkedData())
				{
					this.retry("Could not decode chunked HTTP data (did not receive all bytes?)");
					return;
				}
			}

			var contentEncoding = this.getResponseHeader("content-encoding");
			if (contentEncoding !== undefined && !this.convertFrom(contentEncoding))
			{
				this.fatal("Invalid content encoding received: '" + contentEncoding + "'");
				return;
			}

			if (this.response.statusCode[0] === "3" && this.follow3xxLocation)
				return this.followNewLocation();
		} while (false);
	}
	catch (ex)
	{
		this.fatal("HttpRequest.onStreamClose: ex: " + formatException(ex));
		return;
	}

	this._callUser(null);
}

HttpRequest.prototype.getCookiesFromResponseHeader =
function()
{
	var cookies = new Cookies();

	for (var i = 0; ; i++)
	{
		var cookie = this.getResponseHeader("Set-Cookie", i);
		if (cookie === undefined)
			break;
		var ary = cookie.match(/^\s*([^\s=]+)\s*=\s*([^\s;]+)/)
		if (!ary)
			continue;

		cookies.add(ary[1], ary[2]);
	}

	return cookies;
}

HttpRequest.prototype.followNewLocation =
function()
{
	this.numRedirects++;
	if (this.numRedirects >= 10)
		return this.fatal("Too many HTTP redirects, aborting.");

	var url = this.getResponseHeader("location");
	if (url === undefined)
		return this.fatal("HTTP " + this.response.statusCode + " without a Location header.");

	var cookies = this.getCookiesFromResponseHeader().toString();
	if (cookies.length > 0)
		this.httpHeaders["COOKIE"] = cookies;
	else
		delete this.httpHeaders["COOKIE"];

	this.url = url;
	this.sendGetRequestInternal();
}

// Convert from a compressed mime type to uncompressed data, eg. gzip to uncompressed
HttpRequest.prototype.convertFrom =
function(contentEncoding)
{
	try
	{
		var sstream = Components.classes["@mozilla.org/io/string-input-stream;1"].createInstance(Components.interfaces.nsIStringInputStream);
		sstream.setData(this.response.content, this.response.content.length);

		// streamconv.convert() (sync) is not implemented so use the async method instead.
		var sconv = Components.classes["@mozilla.org/streamconv;1?from=" + contentEncoding + "&to=uncompressed"].createInstance(Components.interfaces.nsIStreamConverter);
		var binaryStreamListener = new BinaryStreamListener();
		sconv.asyncConvertData(contentEncoding, "uncompressed", binaryStreamListener, null);
		sconv.onStartRequest(null, null);
		sconv.onDataAvailable(null, null, sstream, 0, sstream.available());
		sconv.onStopRequest(null, null, 0);

		this.response.content = binaryStreamListener.getDataAsString();
	}
	catch (ex)
	{
		return false;
	}

	return true;
}

// Fixes this.data if we got Transfer-Encoding: chunked
HttpRequest.prototype.fixChunkedData =
function()
{
	var chunkedData = this.response.content;
	this.response.content = "";
	var offset = 0;

	while (true)
	{
		var eolIndex = chunkedData.indexOf("\r\n", offset);
		if (eolIndex === -1)
			return false;
		var chunkSizeStr = stringTrim(chunkedData.substr(offset, eolIndex - offset));
		offset = eolIndex + 2;
		var chunkSize = parseInt(chunkSizeStr, 16);
		if (chunkSize < 0 || chunkSize.toString(16).toLowerCase() !== chunkSizeStr.toLowerCase())
			return false;
		if (eolIndex + 2 + chunkSize + 2 > chunkedData.length)
			return false;

		this.response.content += chunkedData.substr(offset, chunkSize)
		offset += chunkSize;

		if (chunkedData.substr(offset, 2) !== "\r\n")
			return false;
		offset += 2;

		if (chunkSize === 0)
			break;
	}
	if (offset !== chunkedData.length)
		return false;

	return true;
}

HttpRequest.prototype.parseResponse =
function()
{
	var endOfHeader = this.data.indexOf("\r\n\r\n");
	if (endOfHeader === -1)
		return false;

	this.response = {};
	this.response.content = this.data.substr(endOfHeader + 4);

	this.dmessage(5, "HTTP response headers:\n" + this.data.substr(0, endOfHeader + 2), MT_STATUS);
	this.dmessage(5, "HTTP data:\n" + this.data.substr(endOfHeader + 4, 700), MT_STATUS);

	var headerStrings = this.data.substr(0, endOfHeader + 2).match(/.+\r\n/gm);
	if (!headerStrings)
		return false;

	this.response.status = headerStrings[0].substr(0, headerStrings[0].length - 2);
	var ary = this.response.status.match(/\S+\s+(\d+)/);
	if (!ary)
		return false;
	this.response.statusCode = ary[1];

	this.response.headers = {};
	for (var i = 1; i < headerStrings.length; i++)
	{
		ary = headerStrings[i].match(/([^:]+):\s*(.*)/);
		if (!ary)
			return false;
		var key = stringTrim(ary[1]).toLowerCase();
		var value = stringTrim(ary[2]);

		var ary = this.response.headers[key];
		if (ary === undefined)
			ary = this.response.headers[key] = [];
		ary.push(value);
	}

	return true;
}

HttpRequest.prototype.getResponseHeader =
function(name, index)
{
	if (!index)
		index = 0;
	name = name.toLowerCase();
	var ary = this.response.headers[name];
	if (!ary)
		return undefined;
	return ary[index];
}

HttpRequest.prototype.getResponseStatusCode =
function()
{
	return +this.response.statusCode;
}

HttpRequest.prototype.getResponseStatusText =
function()
{
	return this.response.status;
}

HttpRequest.prototype.getResponseData =
function()
{
	return this.response.content;
}

// Cancel any request WITHOUT notifying the callback function
HttpRequest.prototype.cancel =
function()
{
	delete this.completionHandler;
	this.deleteConnection();
}

// Deletes the CBSConnection if it exists.
HttpRequest.prototype.deleteConnection =
function()
{
	if (this.connection)
	{
		this.cleanUpConnection(this.connection);
		delete this.connection;
	}
}

HttpRequest.prototype.cleanUpConnection =
function(connection)
{
	if (connection)
	{
		connection.disconnect();
		connection.close();
	}
}

// Should be the last statement in the file to indicate it loaded successfully
true;
