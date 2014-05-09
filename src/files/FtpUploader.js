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

function SocketSendDataAsync(socket, readDataFunc, readDataFuncContext, callback)
{
	this.socket = socket;
	this.readDataFunc = readDataFunc;
	this.readDataFuncContext = readDataFuncContext;
	this.callback = callback;
	this.completed = false;

	var this_ = this;
	this.socket.readAsync(
	{
		onStreamClose: function(socket, errorMessage)
		{
			this_.notifyCallback(errorMessage || "Data connection unexpectedly closed");
		},
		onStreamDataAvailable: function(socket, data)
		{
			// ignore
		},
	});
}

SocketSendDataAsync.prototype.MAX_BUFFER_SIZE = 32 * 1024;	// Don't send more than this

SocketSendDataAsync.prototype.notifyCallback =
function(errorMessage)
{
	try
	{
		this.completed = true;
		this.socket.readAsync(null);
		var callback = this.callback;
		delete this.callback;
		if (callback)
			callback(this, errorMessage);
	}
	catch (ex)
	{
		message(0, "SocketSendDataAsync.notifyCallback: ex: " + formatException(ex), MT_ERROR);
	}
}

SocketSendDataAsync.prototype.start =
function()
{
	this.pendingData = "";
	this.sendNextData("", 0);
}

SocketSendDataAsync.prototype.abort =
function(errorMessage)
{
	this.closing = true;
	this.socket.close(errorMessage);
}

SocketSendDataAsync.prototype.sendNextData =
function(errorMessage, numBytesWritten)
{
	try
	{
		if (errorMessage)
			return this.notifyCallback(errorMessage);

		if (this.completed)
			return;

		if (numBytesWritten > 0)
			this.pendingData = this.pendingData.substr(numBytesWritten);

		if (!this.pendingData)
			this.pendingData = this.readDataFunc(this.readDataFuncContext);
		if (!this.pendingData)
			return this.notifyCallback("");

		var this_ = this;
		this.socket.writeAsync(this.pendingData, function(socket, errorMessage, numBytesWritten) { this_.sendNextData(errorMessage, numBytesWritten); });
	}
	catch (ex)
	{
		this.notifyCallback("SocketSendDataAsync.sendNextData: ex: " + formatException(ex));
	}
}

function LineBuffer(dataHandler)
{
	this.data = "";
	this.newLineMode = true;
	this.dataHandler = dataHandler;
}

LineBuffer.prototype.setBinaryMode =
function(isBinaryMode)
{
	this.newLineMode = !isBinaryMode;
}

LineBuffer.prototype.addData =
function(data)
{
	this.data += data;
	this.dataAvailLoop(false);
}

LineBuffer.prototype.flushData =
function()
{
	this.dataAvailLoop(true);
}

LineBuffer.prototype.dataAvailLoop =
function(flush)
{
	while (this.data.length > 0)
	{
		var dataUsed = 0;
		if (this.newLineMode)
		{
			var newLineIndex = this.data.indexOf("\n");
			if (newLineIndex === -1 && !flush)
				return;

			if (newLineIndex === -1)
			{
				var eol = dataUsed = newLineIndex = this.data.length;
			}
			else
			{
				dataUsed = newLineIndex + 1;
				var eol = newLineIndex;
			}
			if (eol > 0 && this.data[eol-1] === "\r")
				eol--;

			var line = this.data.substr(0, eol);
			// Initialize this.data here in case flushData() is called in this.dataHandler()
			this.data = this.data.substr(dataUsed);
			this.dataHandler(line);
		}
		else
		{
			dataUsed = this.dataHandler(this.data);
			if (dataUsed === undefined || dataUsed <= 0)
			{
				this.data = "";
				return;
			}
			this.data = this.data.substr(dataUsed);
		}
	}
}

function FtpClient()
{
	this.commands = [];
	this.isSecure = false;
}

FtpClient.prototype.isSendingCommands =
function()
{
	return !!this.sendingInfo;
}

FtpClient.prototype.isConnected =
function()
{
	return !!this.cmdConn;
}

FtpClient.prototype.cleanUp =
function()
{
	if (this.cmdConn)
	{
		this.cmdConn.readAsync(null);
		this.cmdConn.close("FtpClient.cleanUp() called");
		delete this.cmdConn;
	}
}

// Initializes everything needed for connecting to the FTP, and connects to the FTP. Returns an
// error string (empty if no error).
FtpClient.prototype.start =
function(hostname, port)
{
	var this_ = this;

	this.cleanUp();
	this.multiLineCode = false;
	this.lineBuffer = new LineBuffer(function(data) { this_.onCommandDataAvail(data); });
	this.closing = false;

	this.cmdConn = new MySocket();
	var rv = this.cmdConn.connect(hostname, port, { isSecure: this.isSecure });
	if (rv !== true)
		return "Could not connect to ftp " + hostname + ":" + port + ". Reason: " + rv;

	this.cmdConn.readAsync(
	{
		onStreamClose: function(socket, errorMessage)
		{
			this_.onStreamClose_cmdConn(errorMessage);
		},
		onStreamDataAvailable: function(socket, data)
		{
			this_.onStreamDataAvailable_cmdConn(data);
		},
	});

	return "";
}

// Called when the connection is closed
FtpClient.prototype.onStreamClose_cmdConn =
function(errorMessage)
{
	if (!this.closing)
		errorMessage = errorMessage || "Connection closed unexpectedly. Check user, password, IP, port settings.";
	if (this.lineBuffer)
		this.lineBuffer.flushData();
	if (errorMessage)
		return this.fatal(errorMessage);
}

FtpClient.prototype.fatal =
function(errorMessage)
{
	this.cleanUp();
	this.sendCommandsCompleted(errorMessage);
}

// Called when there's data to read
FtpClient.prototype.onStreamDataAvailable_cmdConn =
function(data)
{
	try
	{
		this.lineBuffer.addData(data);
	}
	catch (ex)
	{
		this.fatal("FtpClient.onStreamDataAvailable: ex: " + formatException(ex));
	}
}

// Called when a new line is received
FtpClient.prototype.onCommandDataAvail =
function(data)
{
	if (!this.multiLineCode)
	{
		var ary = data.match(/^(\d{3})/);
		if (!ary || (data[3] !== " " && data[3] !== "-"))
		{
			if (data.match(/^SSH/))
				this.fatal("FTP: You need to use an SSH tunnel. Google it! ;)");
			else
				this.fatal("FTP: Unknown reply: '" + data + "'");
			return;
		}

		this.code = ary[1];
		this.codeMessage = data;
		if (data[3] === "-")
		{
			this.multiLineCode = true;
			this.codeMessage += "\n";
			return;
		}
	}
	else
	{
		this.codeMessage += data;
		if (data.substr(0, 4) !== this.code + " ")
		{
			this.codeMessage += "\n";
			return;
		}
		this.multiLineCode = false;
	}

	message(5, "FTP: " + this.codeMessage, MT_STATUS);
	this.onCodeAvailable(this.code, this.codeMessage);
}

FtpClient.prototype.sendLowLevelCommand =
function(line)
{
	if (line.match(/^PASS /i))
		message(5, "FTP: PASS ****", MT_STATUS);
	else
		message(5, "FTP: " + line, MT_STATUS);

	this.cmdConn.writeAsync(line + "\r\n", function(socket, errorMessage, numBytesWritten)
	{
		if (errorMessage)
			return this.fatal("Could not send FTP command '" + line + "'. Error: " + errorMessage);
	});
}

FtpClient.prototype.addCommand =
function(command)
{
	if (this.isSendingCommands())
		throw "FtpClient.addCommand: can't add a command when sending commands";

	this.commands.push(command);
}

const STCONN_START = 0;
const STCONN_CONNECT_WAIT = 1;
const STCONN_SENT_USER = 2;
const STCONN_SENT_PASS = 3;
const STCONN_END = 4;

/**
 * Add a "connect to FTP" command. All other commands require this command.
 *
 * @param ftpSettings	Has user, password, hostname, port properties
 */
FtpClient.prototype.addConnect =
function(ftpSettings)
{
	this.addCommand(
	{
		name: "connect",
		state: STCONN_START,
		ftpSettings: ftpSettings,
		handler: this.connectHandler,
	});
}

FtpClient.prototype.connectHandler =
function(command, code, codeMessage)
{
	for (;;)
	{
		switch (command.state)
		{
		case STCONN_START:
			var rv = this.start(command.ftpSettings.hostname, command.ftpSettings.port);
			if (rv)
				return this.fatal(rv);
			command.state = STCONN_CONNECT_WAIT;
			return;

		case STCONN_CONNECT_WAIT:
			if (code[0] !== "2")
				return this.fatal("Could not connect to server " + command.ftpSettings.hostname + ":" + command.ftpSettings.port + ". Reason: " + codeMessage);
			this.sendLowLevelCommand("USER " + command.ftpSettings.user);
			command.state = STCONN_SENT_USER;
			return;

		case STCONN_SENT_USER:
			if (code[0] === "2")
			{
				command.state = STCONN_END;
				continue;
			}
			if (code !== "331")
				return this.fatal("Could not log in. Reason: " + codeMessage);
			this.sendLowLevelCommand("PASS " + command.ftpSettings.password);
			command.state = STCONN_SENT_PASS;
			return;

		case STCONN_SENT_PASS:
			if (code[0] !== "2")
				return this.fatal("Could not log in. Reason: " + codeMessage);
			command.state = STCONN_END;
			continue;

		case STCONN_END:
			return this.sendNextCommand();

		default:
			return this.fatal("Unknown state " + command.state + " (" + command.name + ")");
		}
	}
}

const STCD_START = 0;
const STCD_CD_SENT = 1;
const STCD_END = 2;

FtpClient.prototype.addChangeDirectory =
function(ftpDir)
{
	this.addCommand(
	{
		name: "change directory",
		ftpDir: ftpDir.replace(/\\/g, "/"),
		state: STCD_START,
		handler: this.changeDirHandler,
	});
}

FtpClient.prototype.changeDirHandler =
function(command, code, codeMessage)
{
	for (;;)
	{
		switch (command.state)
		{
		case STCD_START:
			this.sendLowLevelCommand("CWD " + command.ftpDir);
			command.state = STCD_CD_SENT;
			return;

		case STCD_CD_SENT:
			if (code[0] !== "2")
				return this.sendNextCommand("Could not change directory to '" + command.ftpDir + "'. Reason: " + codeMessage);
			command.state = STCD_END;
			continue;

		case STCD_END:
			return this.sendNextCommand();

		default:
			return this.fatal("Unknown state " + command.state + " (" + command.name + ")");
		}
	}
}

const STSF_START = 0;
const STSF_SENT_TYPE = 1;
const STSF_SENT_PASV = 2;
const STSF_CONNECT_TO_DATA_PORT = 3;
const STSF_CONNECTED_DATA_PORT = 4;
const STSF_SENDING_DATA = 5;
const STSF_DATA_SENT = 6;
const STSF_DATA_SENT_WAIT = 7;
const STSF_END = 20;

FtpClient.prototype.addSendFile =
function(filename, readDataFunc, ctx)
{
	this.addCommand(
	{
		name: "send file",
		filename: filename,
		readDataFunc: readDataFunc,
		ctx: ctx,
		state: STSF_START,
		handler: this.sendFileHandler,
	});
}

FtpClient.prototype.sendFileHandler =
function(command, code, codeMessage)
{
	for (;;)
	{
		switch (command.state)
		{
		case STSF_START:
			this.sendLowLevelCommand("TYPE I");
			command.state = STSF_SENT_TYPE;
			return;
			
		case STSF_SENT_TYPE:
			if (code[0] !== "2")
				return this.sendNextCommand("Could not set binary mode. Reason: " + codeMessage);
			this.sendLowLevelCommand("PASV");
			command.state = STSF_SENT_PASV;
			return;

		case STSF_SENT_PASV:
			var ary = codeMessage.match(/(\d+),(\d+),(\d+),(\d+),(\d+),(\d+)/);
			if (code !== "227" || !ary)
				return this.sendNextCommand("Passive mode failed. Reason: " + codeMessage);
			command.pasvPort = (parseInt(ary[5], 10) << 8) + parseInt(ary[6], 10);
			command.pasvIp = ary[1] + "." + ary[2] + "." + ary[3] + "." + ary[4];
			this.sendLowLevelCommand("STOR " + command.filename);
			command.state = STSF_CONNECT_TO_DATA_PORT;
			continue;

		case STSF_CONNECT_TO_DATA_PORT:
			command.dataConn = new MySocket();
			var rv = command.dataConn.connect(command.pasvIp, command.pasvPort, { isSecure: this.isSecure });
			if (rv !== true)
				return this.sendNextCommand("Could not connect to ftp data port " + command.pasvIp + ":" + command.pasvPort + ". Reason: " + rv);
			command.state = STSF_CONNECTED_DATA_PORT;
			return;

		case STSF_CONNECTED_DATA_PORT:
			if (code[0] !== "1")
				return this.sendNextCommand("Passive mode STOR failed. Reason: " + codeMessage);

			command.state = STSF_SENDING_DATA;
			var this_ = this;
			command.socketSendDataAsync = new SocketSendDataAsync(command.dataConn, command.readDataFunc, command.ctx, function(socketSendDataAsync, errorMessage)
			{
				command.state = STSF_DATA_SENT;
				this_.sendFileHandler(command, "", errorMessage);
			});
			command.socketSendDataAsync.start();
			return;

		case STSF_SENDING_DATA:
			if (!command.socketSendDataAsync)
				return;
			command.socketSendDataAsync.abort("Got unexpected reply: " + codeMessage);
			delete command.socketSendDataAsync;
			return;

		case STSF_DATA_SENT:
			var errorMessage = codeMessage;
			delete command.socketSendDataAsync;
			command.dataConn.close(errorMessage);
			delete command.dataConn;

			if (errorMessage)
				return this.sendNextCommand("Error sending data: " + errorMessage);

			command.state = STSF_DATA_SENT_WAIT;
			return;

		case STSF_DATA_SENT_WAIT:
			if (code[0] !== "2")
				return this.sendNextCommand("Could not send the file. Reason: " + codeMessage);
			command.state = STSF_END;
			continue;

		case STSF_END:
			return this.sendNextCommand();

		default:
			return this.fatal("Unknown state " + command.state + " (" + command.name + ")");
		}
	}
}

const STRN_START = 50;
const STRN_RNFR_SENT = 51;
const STRN_RNTO_SENT = 52;
const STRN_END = 59;

FtpClient.prototype.addRename =
function(oldName, newName)
{
	this.addCommand(
	{
		name: "rename",
		oldName: oldName,
		newName: newName,
		state: STRN_START,
		handler: this.renameHandler,
	});
}

FtpClient.prototype.renameHandler =
function(command, code, codeMessage)
{
	for (;;)
	{
		switch (command.state)
		{
		case STRN_START:
			this.sendLowLevelCommand("RNFR " + command.oldName);
			command.state = STRN_RNFR_SENT;
			return;

		case STRN_RNFR_SENT:
			if (code[0] !== "3") {
				return this.sendNextCommand("Could not rename '" + command.oldName + "' -> '" + command.newName + "'. Reason: " + codeMessage);
			}
			this.sendLowLevelCommand("RNTO " + command.newName);
			command.state = STRN_RNTO_SENT;
			return;

		case STRN_RNTO_SENT:
			if (code[0] !== "2") {
				return this.sendNextCommand("Could not rename '" + command.oldName + "' -> '" + command.newName + "'. Reason: " + codeMessage);
			}
			command.state = STRN_END;
			continue;

		case STRN_END:
			return this.sendNextCommand();

		default:
			return this.fatal("Unknown state " + command.state + " (" + command.name + ")");
		}
	}
}

FtpClient.prototype.addQuit =
function()
{
	this.addCommand(
	{
		name: "quit",
		state: 0,
		handler: this.quitHandler,
	});
}

FtpClient.prototype.quitHandler =
function(command, code, codeMessage)
{
	if (command.state === 0)
	{
		this.closing = true;
		this.sendLowLevelCommand("QUIT");
		command.state++;
	}
	else if (command.state === 1)
	{
		return this.sendNextCommand();
	}
	else
		return this.fatal("Unknown state " + command.state + " (" + command.name + ")");
}

FtpClient.prototype.sendCommands =
function(callback)
{
	if (this.isSendingCommands())
		throw "FtpClient.sendCommands: Already sending commands!";

	try
	{
		this.sendingInfo =
		{
			callback: callback,
			commandIndex: -1,
		};
		this.sendNextCommand();
	}
	catch (ex)
	{
		return this.fatal("FtpClient.sendCommands: ex: " + formatException(ex));
	}
}

FtpClient.prototype.onCodeAvailable =
function(code, codeMessage)
{
	try
	{
		this.sendingInfo.command.handler.call(this, this.sendingInfo.command, code, codeMessage);
	}
	catch (ex)
	{
		return this.fatal("FtpClient.onCodeAvailable: ex: " + formatException(ex));
	}
}

FtpClient.prototype.sendNextCommand =
function(errorMessage)
{
	if (errorMessage)
		return this.sendCommandsCompleted(errorMessage);

	try
	{
		this.sendingInfo.commandIndex++;
		if (this.sendingInfo.commandIndex >= this.commands.length)
			return this.sendCommandsCompleted("");

		var command = this.commands[this.sendingInfo.commandIndex];
		this.sendingInfo.command = command;
		if (command.name !== "connect" && !this.isConnected())
			return this.sendCommandsCompleted("FTP command '" + command.name + "' requires a connection.");
		command.handler.call(this, this.sendingInfo.command);
	}
	catch (ex)
	{
		return this.fatal("FtpClient.sendNextCommand: ex: " + formatException(ex));
	}
}

FtpClient.prototype.sendCommandsCompleted =
function(errorMessage)
{
	if (!this.sendingInfo)
		return;

	this.commands = [];
	var callback = this.sendingInfo.callback;
	delete this.sendingInfo;
	delete this.lineBuffer;	// Prevent a memory leak since the callback holds a ref to us

	this.cleanUp();

	try
	{
		callback(errorMessage);
	}
	catch (ex)
	{
		message(0, "FtpClient.sendCommandsCompleted: ex: " + formatException(ex), MT_ERROR);
	}
}

// Should be the last statement in the file to indicate it loaded successfully
true;
