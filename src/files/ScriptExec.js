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

//TODO: Put this func someplace else. There's simliar code in maybe torrent downloader
function getLocalFile(basePath, relativePath)
{
	if (!basePath)
		throw "Invalid basePath (empty)";

	var localFile = nsLocalFile(basePath);

	if (relativePath)
	{
		var ary = relativePath.split("/");
		for (var i = 0; i < ary.length; i++)
			localFile.append(ary[i]);
	}

	return localFile;
}

//TODO: Move these classes someplace else
//TODO: Some of your other code could possibly use this also, like the code reading an XML file.
function ReadableBinaryFile(localFile)
{
	var baseInputStream = Components.classes["@mozilla.org/network/file-input-stream;1"].createInstance(Components.interfaces.nsIFileInputStream);
	baseInputStream.init(localFile, -1, -1, 0);
	this.inputStream = createBinaryInputStream(baseInputStream);
}

// Returns the maximum number of bytes we can read at this time. Note that it may be less than
// file size if the file is > 2GB.
ReadableBinaryFile.prototype.availableRead =
function()
{
	return this.inputStream.available();
}

// Read a string from the file. Don't read more than what availableRead() returns.
ReadableBinaryFile.prototype.read =
function(size)
{
	if (size === undefined)
		size = this.availableRead();
	return this.inputStream.readBytes(size);
}

ReadableBinaryFile.prototype.close =
function()
{
	if (this.inputStream)
	{
		this.inputStream.close();
		delete this.inputStream;
	}
}

function WritableBinaryFile(localFile)
{
	var baseOutputStream = Components.classes["@mozilla.org/network/file-output-stream;1"].createInstance(Components.interfaces.nsIFileOutputStream);
	baseOutputStream.init(localFile, -1, -1, 0);
	this.outputStream = createBinaryOutputStream(baseOutputStream);
}

// Writes a string to the file
WritableBinaryFile.prototype.write =
function(s)
{
	this.outputStream.writeBytes(s, s.length);
}

WritableBinaryFile.prototype.close =
function()
{
	if (this.outputStream)
	{
		this.outputStream.close();
		delete this.outputStream;
	}
}

//TODO: You're not using this anymore
function MultiDiskIoJob()
{
	this.jobs = [];
	this.currentJobIndex = 0;

	this.success = true;
	this.errorMessage = "";
}

MultiDiskIoJob.prototype.jobsLeft =
function()
{
	return this.currentJobIndex < this.jobs.length;
}

// All async jobs must call this method once the async job has completed.
MultiDiskIoJob.prototype.asyncCompleted =
function(rv)
{
	rv = this.handleJobReturnValue(rv);
	plugin.diskIoQueue.asyncJobCompleted(rv);
}

MultiDiskIoJob.prototype.handleJobReturnValue =
function(rv)
{
	if (rv === DiskIoQueue.FINISHED)
	{
		this.currentJobIndex++;

		if (!this.jobsLeft())
		{
			rv = DiskIoQueue.FINISHED;
		}
		else
			rv = DiskIoQueue.YIELD;
	}

	return rv;
}

MultiDiskIoJob.prototype.handler =
function()
{
	if (!this.jobsLeft() || !this.success)
		return DiskIoQueue.FINISHED;

	var job = this.jobs[this.currentJobIndex];

	try
	{
		var rv = job.handler();
	}
	catch (ex)
	{
		if (typeof ex === "string")
			rv = ex;
		else
			rv = "MultiDiskIoJob.handler(): got exception: " + formatException(ex);
	}

	rv = this.handleJobReturnValue(rv);
	return rv;
}

MultiDiskIoJob.prototype.add =
function(job)
{
	this.jobs.push(job);
}

/**
 * @param scriptName	Name of the script to execute
 * @param hash	info_hash as a hex string
 * @param ti	Torrent info (see torrent downloader)
 * @param torrentFiles	A TorrentFiles instance
 * @param eventHandler	Notified when starting/stopping the script. Called as eventHandler(event)
 *						event.name is "started" or "stopped", event.scriptExec is this,
 *						event.errorMessage is the error message (if "stopped" event) or "" if
 *						no error.
 */
function ScriptExec(scriptName, hash, ti, torrentFiles, eventHandler)
{
	this.scriptName = scriptName;
	this.hash = hash;
	this.ti = ti;
	this.torrentFiles = torrentFiles;
	this.eventHandler = eventHandler;
}

ScriptExec.DISKIO_BUFFER_SIZE = 0x8000;

ScriptExec.prototype.sendEvent =
function(name, event)
{
	if (!event)
		event = {};
	event.scriptExec = this;
	event.name = name;
	try
	{
		if (this.eventHandler)
			this.eventHandler(event);
	}
	catch (ex)
	{
		message(0, "ScriptExec.sendEvent: ex: " + formatException(ex), MT_ERROR);
	}
}

//TODO: This method doesn't belong here. Could be its own function someplace else
ScriptExec.prototype.findScript =
function(scriptName)
{
	var scripts = plugin.scripts;
	for (var i = 0; i < scripts.length; i++)
	{
		var script = scripts[i];
		if (script.name === scriptName)
			return script;
	}

	return null;
}

ScriptExec.prototype.getParsedScript =
function()
{
	var script = this.findScript(this.scriptName);
	if (!script)
	{
		this.execScriptDone("Could not find script '" + this.scriptName + "'");
		return null;
	}

	var scriptParser = new ScriptParser();
	var commandsAry = scriptParser.parse(script);
	if (!commandsAry)
	{
		this.execScriptDone("Could not parse script '" + this.scriptName + "'");
		return null;
	}

	return commandsAry;
}

// Execute the script asynchronously
ScriptExec.prototype.exec =
function()
{
	try
	{
		this.startTime = +newDate();
		this.sendEvent("started");

		this.commandsAry = this.getParsedScript();
		if (!this.commandsAry)
			return;	// this.execScriptDone() has already been called

		this.scriptIndex = -1;
		this.nextCommand("");
	}
	catch (ex)
	{
		return this.execScriptDone("ScriptExec.exec: exception: " + formatException(ex));
	}
}

// Next script command will be executed asynchronously unless there was an error
ScriptExec.prototype.nextCommand =
function(errorMessage)
{
	if (errorMessage)
		return this.execScriptDone(errorMessage);

	try
	{
		if (this.scriptIndex >= 0)
			this.commandsAry[this.scriptIndex] = null;

		this.scriptIndex++;
		if (this.scriptIndex >= this.commandsAry.length)
			return this.execScriptDone("");

		var command = this.commandsAry[this.scriptIndex];
		this.tmp = { command: command };
		switch (command.name)
		{
		case "extract":	this.doCommandExtract(); break;
		case "copy":	this.doCommandCopy(); break;
		case "move":	this.doCommandMove(); break;
		case "delete":	this.doCommandDelete(); break;
		case "exec":	this.doCommandExec(); break;
		case "webui":	this.doCommandWebui(); break;
		default: return this.execScriptDone("Internal error: Command '" + command.name + "' is not supported yet.");
		}
	}
	catch (ex)
	{
		return this.execScriptDone("ScriptExec.nextCommand(): ex: " + formatException(ex));
	}
}

// Called when all commands have been executed or an error occurred
ScriptExec.prototype.execScriptDone =
function(errorMessage)
{
	delete this.commandsAry;
	delete this.tmp;

	this.sendEvent("stopped", { errorMessage: errorMessage, totalTimeMs: (+newDate()) - this.startTime });
}

ScriptExec.prototype.doCommandExecInitialize =
function()
{
	var allFiles = this.torrentFiles.files.concat();
	allFiles.sort(function(a, b)
	{
		a = a.relativePath.toLowerCase();
		b = b.relativePath.toLowerCase();
		return stringCompare(a, b);
	});

	this.tmp.nonArchiveFiles = [];	// All non-archive files
	this.tmp.archiveFiles = [];	// Contains all archive files (eg. *.rar, *.r00, etc)
	this.tmp.archiveFiles1st = [];	// Contains the first file in multi-archive files (eg. *.rar, and not *.r00, etc)

	for (var i = 0; i < allFiles.length; i++)
	{
		var file = allFiles[i];
		var fileLower = file.relativePath.toLowerCase();

		if (fileLower.match(/\.(?:part0*1\.rar|001)$/))
		{
			this.tmp.archiveFiles.push(file);
			this.tmp.archiveFiles1st.push(file);
		}
		else if (fileLower.match(/\.(?:r\d{2}|part\d+\.rar|\d{3})$/))
		{
			this.tmp.archiveFiles.push(file);
		}
		else if (ary = fileLower.match(/\.(?:rar|zip)$/))
		{
			this.tmp.archiveFiles.push(file);
			this.tmp.archiveFiles1st.push(file);
		}
		else
		{
			this.tmp.nonArchiveFiles.push(file);
		}
	}
}

ScriptExec.prototype.doCommandExtract =
function()
{
	this.doCommandExecInitialize();

	var this_ = this;
	this.createExtractJob(this.tmp.archiveFiles1st, function(errorMessage) { this_.extract_onExtractCompleted(errorMessage); });
}

ScriptExec.prototype.extract_onExtractCompleted =
function(errorMessage)
{
	if (errorMessage)
		return this.nextCommand(errorMessage);

	if (!this.tmp.command.copyNonArchive)
		return this.extract_onCopyCompleted("");

	var this_ = this;
	this.createCopyJob(this.tmp.nonArchiveFiles, this.tmp.command.dontCopy, function(errorMessage) { this_.extract_onCopyCompleted(errorMessage); });
}

ScriptExec.prototype.extract_onCopyCompleted =
function(errorMessage)
{
	if (errorMessage)
		return this.nextCommand(errorMessage);

	if (!this.tmp.command.deleteArchives)
		return this.extract_onDeleteCompleted("");

	var this_ = this;
	this.createDeleteJob(this.tmp.archiveFiles, [], function(errorMessage) { this_.extract_onDeleteCompleted(errorMessage); });
}

ScriptExec.prototype.extract_onDeleteCompleted =
function(errorMessage)
{
	this.nextCommand(errorMessage);
}

ScriptExec.prototype.getSourcePath =
function()
{
	// Override sourcePath if we already know the local path
	return this.ti.torrentDataPath || this.tmp.command.sourcePath;
}

ScriptExec.prototype.getSourceFile =
function(sourceRelativePath)
{
	return getLocalFile(this.getSourcePath(), sourceRelativePath);
}

ScriptExec.prototype.prependTorrentDir =
function(relPath)
{
	var directoryName = this.torrentFiles.directoryName;
	return directoryName ? directoryName + "/" + relPath : relPath;
}

// Returns true if all files should be put in the same dest dir and not relative to some base dir
ScriptExec.prototype.allFilesInSameDir =
function()
{
	return this.tmp.command.destPath.slice(0, 2) !== "[]";
}

ScriptExec.prototype.getDestinationFile =
function(destRelativePath)
{
	var command = this.tmp.command;

	var ary = command.destPath.match(/^\[([^\]]*)\](.*)/)
	if (!ary)
		throw "Invalid dest path: " + command.destPath;

	var filename = destRelativePath.split("/").pop();
	var baseDir = ary[2] === "$source" ? this.getSourcePath() : ary[2];
	switch (ary[1])
	{
	case "":
		return getLocalFile(baseDir, destRelativePath);

	case "root":
		return getLocalFile(baseDir, this.prependTorrentDir(filename));

	case "parent":
		var localFile = getLocalFile(baseDir, this.torrentFiles.directoryName);

		// For single-file torrents, use its current directory.
		if (this.torrentFiles.directoryName !== "")
			localFile = localFile.parent;

		localFile.append(filename);
		return localFile;

	default:
		throw "Invalid dest path: " + command.destPath;
	}
}

ScriptExec.prototype.getSourceDestFileInfo =
function(sourceRelativePath)
{
	var fileInfo = {};

	fileInfo.sourceFile = this.getSourceFile(sourceRelativePath);
	fileInfo.destFile = this.getDestinationFile(sourceRelativePath);

	return fileInfo;
}

ScriptExec.prototype.getAllFiles =
function()
{
	var allFiles = this.torrentFiles.files.concat();
	allFiles.sort(function(a, b)
	{
		a = a.relativePath.toLowerCase();
		b = b.relativePath.toLowerCase();
		return stringCompare(a, b);
	});
	return allFiles
}

ScriptExec.prototype.doCommandCopy =
function()
{
	var this_ = this;
	this.createCopyJob(this.getAllFiles(), this.tmp.command.dontCopy, function(errorMessage) { this_.copy_onCopyCompleted(errorMessage); });
}

ScriptExec.prototype.copy_onCopyCompleted =
function(errorMessage)
{
	this.nextCommand(errorMessage);
}

ScriptExec.prototype.doCommandMove =
function()
{
	var this_ = this;
	this.createMoveJob(this.getAllFiles(), this.tmp.command.dontMove, function(errorMessage) { this_.move_onMoveCompleted(errorMessage); });
}

ScriptExec.prototype.move_onMoveCompleted =
function(errorMessage)
{
	this.nextCommand(errorMessage);
}

ScriptExec.prototype.doCommandDelete =
function()
{
	var this_ = this;
	this.createDeleteJob(this.getAllFiles(), this.tmp.command.dontDelete, function(errorMessage) { this_.delete_onDeleteCompleted(errorMessage); });
}

ScriptExec.prototype.delete_onDeleteCompleted =
function(errorMessage)
{
	this.nextCommand(errorMessage);
}

ScriptExec.prototype.doCommandExec =
function()
{
	var this_ = this;
	this.createExecJob(this.tmp.command, function(errorMessage) { this_.exec_onExecCompleted(errorMessage); });
}

ScriptExec.prototype.exec_onExecCompleted =
function(errorMessage)
{
	this.nextCommand(errorMessage);
}

ScriptExec.prototype.doCommandWebui =
function()
{
	var this_ = this;
	this.createWebuiJob(this.tmp.command, this.hash, function(errorMessage) { this_.webui_onWebuiCompleted(errorMessage); });
}

ScriptExec.prototype.webui_onWebuiCompleted =
function(errorMessage)
{
	this.nextCommand(errorMessage);
}

ScriptExec.prototype.createExtractJob =
function(theFiles, callback)
{
	var job =
	{
		scriptExec: this,
		theFiles: theFiles,
		currentIndex: 0,

		nextFile: function()
		{
			this.currentIndex++;
			return DiskIoQueue.YIELD;
		},

		handler: function()
		{
			var job = this;

			if (job.currentIndex >= job.theFiles.length)
				return DiskIoQueue.FINISHED;

			if (job.unzip)
				return job.doUnzip();

			var file = job.theFiles[job.currentIndex];
			var fileExtension = file.relativePath.split(".").pop().toLowerCase();
			if (fileExtension === "zip")
				return job.doUnzip();
			return job.doUnrar();
		},

		doUnrar: function()
		{
			var job = this;

			var fileInfo = job.scriptExec.getSourceDestFileInfo(job.theFiles[job.currentIndex].relativePath);

			job.sourceFile = fileInfo.sourceFile;
			job.destDir = fileInfo.destFile.parent;

			createDirectory(job.destDir);

			var arguments = "x -c- -y -p-";
			if (job.scriptExec.allFilesInSameDir())
				arguments += " -ep";
			arguments += " \"" + job.sourceFile.path + "\" \"" + job.destDir.path + "\"";
			var execInfo =
			{
				program: plugin.options.pathToUnrar,
				arguments: arguments,
				callback: function(success, exitValue)
				{
					var rv;
					if (success && exitValue === 0)
						rv = job.nextFile();
					else
						rv = "Could not extract archive " + job.sourceFile.path + ", exit code: " + exitValue;
					plugin.diskIoQueue.asyncJobCompleted(rv);
				},
			};

			message(4, "\x02EXTRACT\x02: file: \x02\x0302" + job.sourceFile.path + "\x03\x02, destination: \x02\x0303" + job.destDir.path + "\x03\x02", MT_STATUS);
			if (!execInfo.program)
				return "Path of rar or unrar executable has not been set! Can't unrar!";
			if (Exec(execInfo))
				return DiskIoQueue.ASYNC;
			else
				return "Could not execute unrar, path: '" + execInfo.program + "'";
		},

		doUnzip: function()
		{
			var job = this;

			function nextUnzipFile()
			{
				job.unzip.index++;
				if (job.unzip.index >= job.unzip.files.length)
				{
					job.unzip.reader.close();
					delete job.unzip;
					return job.nextFile();
				}
				return DiskIoQueue.YIELD;
			}

			try
			{
				if (!job.unzip)
				{
					job.unzip =
					{
						index: 0,
						sourceFile: job.scriptExec.getSourceFile(job.theFiles[job.currentIndex].relativePath),
						reader: Components.classes["@mozilla.org/libjar/zip-reader;1"].createInstance(Components.interfaces.nsIZipReader),
						files: [],
					};

					job.unzip.reader.open(job.unzip.sourceFile);

					var zipEnumerator = job.unzip.reader.findEntries("*");
					while (zipEnumerator.hasMore())
						job.unzip.files.push(zipEnumerator.getNext());

					message(4, "\x02EXTRACT\x02: file: \x02\x0302" + job.unzip.sourceFile.path + "\x03\x02, num files: \x02" + job.unzip.files.length + "\x02", MT_STATUS);
				}

				if (job.unzip.index >= job.unzip.files.length)
					return nextUnzipFile();

				var zipEntry = job.unzip.files[job.unzip.index];
				if (zipEntry.slice(-1) === "/")	// Don't extract directories
					return nextUnzipFile();
				var relPath = job.scriptExec.prependTorrentDir(zipEntry);
				var zipFile = job.scriptExec.getDestinationFile(relPath);
				createDirectory(zipFile.parent);
				zipReaderExtractFile(job.unzip.reader, zipEntry, zipFile)

				return nextUnzipFile();
			}
			catch (ex)
			{
				if (ex.name === "NS_ERROR_FILE_CORRUPTED")
					return "Can't unzip corrupted zip file '" + job.unzip.sourceFile.path + "'";
				return "Could not unzip file '" + job.unzip.sourceFile.path + "'";
			}
		},
	};

	plugin.diskIoQueue.enqueue(job, callback);
}

ScriptExec.prototype.createCopyJob =
function(theFiles, dontCopy, callback)
{
	var job =
	{
		scriptExec: this,
		theFiles: theFiles,
		currentIndex: 0,
		dontCopy: regexEscapeWildcardString(dontCopy).split(","),
		numBytesLeft: 0,

		handler: function()
		{
			var job = this;

			function nextFile()
			{
				job.currentIndex++;

				if (job.destBinaryFile)
				{
					job.destBinaryFile.close();
					delete job.destBinaryFile;
				}

				if (job.sourceBinaryFile)
				{
					job.sourceBinaryFile.close();
					delete job.sourceBinaryFile;
				}

				return DiskIoQueue.YIELD;
			}

			if (job.currentIndex >= job.theFiles.length)
				return DiskIoQueue.FINISHED;

			if (!job.sourceBinaryFile)
			{
				var file = job.theFiles[job.currentIndex];
				if (checkRegexArray(file.relativePath, job.dontCopy))
					return nextFile();
				job.numBytesLeft = file.fileSize;

				var fileInfo = job.scriptExec.getSourceDestFileInfo(file.relativePath);

				job.sourceFile = fileInfo.sourceFile;
				job.destFile = fileInfo.destFile;

				if (job.sourceFile.equals(job.destFile))
					return nextFile();

				message(4, "\x02COPY\x02: file: \x02\x0302" + job.sourceFile.path + "\x03\x02 ==> \x02\x0303" + job.destFile.path + "\x03\x02", MT_STATUS);

				createDirectory(job.destFile.parent);

				try
				{
					job.sourceBinaryFile = new ReadableBinaryFile(job.sourceFile);
				}
				catch (ex)
				{
					return "Could not open file '" + job.sourceFile.path + "' for reading";
				}

				try
				{
					job.destBinaryFile = new WritableBinaryFile(job.destFile);
				}
				catch (ex)
				{
					return "Could not open file '" + job.destFile.path + "' for writing";
				}
			}

			var maxBytes = job.numBytesLeft;
			if (maxBytes === 0)
				return nextFile();

			maxBytes = Math.min(maxBytes, ScriptExec.DISKIO_BUFFER_SIZE);
			var data = job.sourceBinaryFile.read(maxBytes);
			job.destBinaryFile.write(data);
			job.numBytesLeft -= maxBytes;

			return DiskIoQueue.YIELD;
		},
	};

	plugin.diskIoQueue.enqueue(job, callback);
}

// Returns true if both files are on the same partition, false otherwise
function isOnSamePartition(file1, file2)
{
	switch (client.platform.toLowerCase())
	{
	case "windows":
		// Assume there are no mapped partitions
		return file1.path[0].toLowerCase() === file2.path[0].toLowerCase();

	case "linux":
		//TODO: Check /etc/fstab
		return false;

	case "mac":
		//TODO:
		return false;

	default:
		return false;
	}

	return false;
}

ScriptExec.prototype.createMoveJob =
function(theFiles, dontMove, callback)
{
	var job =
	{
		scriptExec: this,
		theFiles: theFiles,
		currentIndex: 0,
		dontMove: regexEscapeWildcardString(dontMove).split(","),
		deletingDirs: false,
		emulateMove: undefined,
		numBytesLeft: 0,

		nextFile: function()
		{
			job.currentIndex++;

			if (job.destBinaryFile)
			{
				job.destBinaryFile.close();
				delete job.destBinaryFile;
			}

			if (job.sourceBinaryFile)
			{
				job.sourceBinaryFile.close();
				delete job.sourceBinaryFile;
			}

			return DiskIoQueue.YIELD;
		},

		handler: function()
		{
			var job = this;

			if (job.currentIndex >= job.theFiles.length)
			{
				if (job.deletingDirs)
					return DiskIoQueue.FINISHED;
				job.deletingDirs = true;
				job.currentIndex = 0;
				job.theFiles.sort(deleteDirsSort);
			}

			if (job.sourceBinaryFile)
				return job.doEmulateMove();

			var file = job.theFiles[job.currentIndex];
			if (checkRegexArray(file.relativePath, job.dontMove))
				return job.nextFile();
			job.numBytesLeft = file.fileSize;

			var fileInfo = job.scriptExec.getSourceDestFileInfo(file.relativePath);
			job.sourceFile = fileInfo.sourceFile;
			job.destFile = fileInfo.destFile;

			if (job.deletingDirs)
			{
				var isNewDir = job.currentIndex === 0 || !job.scriptExec.getSourceFile(job.theFiles[job.currentIndex - 1].relativePath).parent.equals(job.sourceFile.parent);
				if (isNewDir && tryRemove(job.sourceFile.parent))
					message(4, "\x02DELETE\x02: directory: \x02\x0302" + job.sourceFile.parent.path + "\x03\x02", MT_STATUS);
				return job.nextFile();
			}

			createDirectory(job.destFile.parent);

			// If the files are not on the same partition, the nsIFile.moveTo() method will
			// emulate the move (copy and delete), which means the UI could hang for a long time
			// if we're moving a big file. If they're not on the same partition, we emulate the
			// move ourselves and yield so the UI won't hang.
			if (job.emulateMove === undefined)
				job.emulateMove = !isOnSamePartition(job.sourceFile, job.destFile);
			if (job.emulateMove)
				return job.doEmulateMove();
			return job.doMove();
		},

		doMove: function()
		{
			message(4, "\x02MOVE\x02: file: \x02\x0302" + job.sourceFile.path + "\x03\x02 ==> \x02\x0303" + job.destFile.path + "\x03\x02", MT_STATUS);

			try
			{
				job.sourceFile.moveTo(job.destFile.parent, job.destFile.leafName)
			}
			catch (ex)
			{
				return "Could not move '" + job.sourceFile.path + "' to '" + job.destFile.path + "'";
			}

			return job.nextFile();
		},

		doEmulateMove: function()
		{
			if (!job.sourceBinaryFile)
			{
				message(4, "\x02MOVE (copy&delete)\x02: file: \x02\x0302" + job.sourceFile.path + "\x03\x02 ==> \x02\x0303" + job.destFile.path + "\x03\x02", MT_STATUS);

				try
				{
					job.sourceBinaryFile = new ReadableBinaryFile(job.sourceFile);
				}
				catch (ex)
				{
					return "Could not open file '" + job.sourceFile.path + "' for reading";
				}

				try
				{
					job.destBinaryFile = new WritableBinaryFile(job.destFile);
				}
				catch (ex)
				{
					return "Could not open file '" + job.destFile.path + "' for writing";
				}
			}

			var maxBytes = job.numBytesLeft;
			if (maxBytes === 0)
			{
				job.sourceBinaryFile.close();	// Need to close it before we can delete it
				if (!tryRemove(job.sourceFile))
					return "Could not delete file '" + job.sourceFile.path + "'";
				return job.nextFile();
			}

			maxBytes = Math.min(maxBytes, ScriptExec.DISKIO_BUFFER_SIZE);
			var data = job.sourceBinaryFile.read(maxBytes);
			job.destBinaryFile.write(data);
			job.numBytesLeft -= maxBytes;

			return DiskIoQueue.YIELD;
		},
	};

	plugin.diskIoQueue.enqueue(job, callback);
}

function deleteDirsSort(a, b)
{
	// Files closer to the root is at the end of the sorted array so we can delete
	// all directories (must be empty).
	a = a.relativePath.split("/").length;
	b = b.relativePath.split("/").length;
	if (a > b)
		return -1;
	if (a < b)
		return 1;
	return 0;
}

function tryRemove(file)
{
	try
	{
		file.remove(false);
		return true;
	}
	catch (ex)
	{
		return !file.exists();
	}
}

ScriptExec.prototype.createDeleteJob =
function(theFiles, dontDelete, callback)
{
	var job =
	{
		scriptExec: this,
		theFiles: theFiles,
		currentIndex: 0,
		dontDelete: regexEscapeWildcardString(dontDelete).split(","),
		deletingDirs: false,

		handler: function()
		{
			var job = this;

			function nextFile()
			{
				job.currentIndex++;
				return DiskIoQueue.YIELD;
			}

			if (job.currentIndex >= job.theFiles.length)
			{
				if (job.deletingDirs)
					return DiskIoQueue.FINISHED;
				job.deletingDirs = true;
				job.currentIndex = 0;
				job.theFiles.sort(deleteDirsSort);
			}

			var file = job.theFiles[job.currentIndex];
			if (checkRegexArray(file.relativePath, job.dontDelete))
				return nextFile();

			job.sourceFile = job.scriptExec.getSourceFile(job.theFiles[job.currentIndex].relativePath)

			if (job.deletingDirs)
			{
				var isNewDir = job.currentIndex === 0 || !job.scriptExec.getSourceFile(job.theFiles[job.currentIndex - 1].relativePath).parent.equals(job.sourceFile.parent);
				if (isNewDir && tryRemove(job.sourceFile.parent))
					message(4, "\x02DELETE\x02: directory: \x02\x0302" + job.sourceFile.parent.path + "\x03\x02", MT_STATUS);
			}
			else
			{
				message(4, "\x02DELETE\x02: file: \x02\x0302" + job.sourceFile.path + "\x03\x02", MT_STATUS);
				if (!tryRemove(job.sourceFile))
					return "Could not delete file '" + job.sourceFile.path + "'";
			}

			return nextFile();
		},
	};

	plugin.diskIoQueue.enqueue(job, callback);
}

ScriptExec.prototype.createExecJob =
function(command, callback)
{
	try
	{
		var macroReplacer = plugin.getMacroReplacer(this.ti);

		var execInfo =
		{
			program: macroReplacer.replace(command.command),
			arguments: macroReplacer.replace(command.arguments),
			callback: function(success, exitValue)
			{
				var rv;
				if (success)
				{
					if (exitValue === 0 || command.ignoreExitCode)
						rv = "";
					else
						rv = "Program '" + execInfo.program + "' returned exit code: " + exitValue;
				}
				else
					rv = "Could not execute '" + execInfo.program + "', arguments: '" + execInfo.arguments + "'";
				callback(rv);
			},
		};

		message(4, "\x02EXEC\x02: command: \x02\x0302" + execInfo.program + "\x03\x02, arguments: '\x0303\x02" + execInfo.arguments + "\x02\x03'", MT_STATUS);
		if (Exec(execInfo))
			return DiskIoQueue.ASYNC;
		else
			return "Could not execute '" + execInfo.program + "', arguments: '" + execInfo.arguments + "'";
	}
	catch (ex)
	{
		if (typeof ex === "string")
			callback(ex);
		else
			callback("ScriptExec.createExecJob: ex: " + formatException(ex));
	}
}

ScriptExec.prototype.createWebuiJob =
function(command, hash, callback)
{
	try
	{
		var webui = new UtorrentWebui(plugin.options.webui);
		var argument = command.argument;
		switch (command.command)
		{
		case WEBUI_SETMAXUL:
			argument = parseInt(argument) * 1024;
			webui.addSetMaxUploadSpeedCommand(hash, argument);
			break;

		case WEBUI_SETMAXDL:
			argument = parseInt(argument) * 1024;
			webui.addSetMaxDownloadSpeedCommand(hash, argument);
			break;

		case WEBUI_SETLABEL:
			var macroReplacer = plugin.getMacroReplacer(this.ti);
			argument = macroReplacer.replace(argument);
			webui.addSetLabelCommand(hash, argument);
			break;

		case WEBUI_START:
			webui.addStartCommand(hash, argument);
			break;

		case WEBUI_STOP:
			webui.addStopCommand(hash, argument);
			break;

		case WEBUI_PAUSE:
			webui.addPauseCommand(hash, argument);
			break;

		case WEBUI_UNPAUSE:
			webui.addUnpauseCommand(hash, argument);
			break;

		case WEBUI_FORCESTART:
			webui.addForceStartCommand(hash, argument);
			break;

		case WEBUI_RECHECK:
			webui.addRecheckCommand(hash, argument);
			break;

		case WEBUI_REMOVE:
			webui.addRemoveCommand(hash, argument);
			break;

		case WEBUI_REMOVEDATA:
			webui.addRemoveDataCommand(hash, argument);
			break;

		case WEBUI_QUEUEBOTTOM:
			webui.addQueueBottomCommand(hash, argument);
			break;

		case WEBUI_QUEUETOP:
			webui.addQueueTopCommand(hash, argument);
			break;

		case WEBUI_QUEUEUP:
			webui.addQueueUpCommand(hash, argument);
			break;

		case WEBUI_QUEUEDOWN:
			webui.addQueueDownCommand(hash, argument);
			break;

		default:
			throw "Unknown Webui command '" + command.command + "'";
		}

		var msg = "\x02WEBUI\x02: \x02\x0302" + command.command + "\x03\x02";
		if (argument !== "")
			msg += ", argument: '\x0303\x02" + argument + "\x02\x03'";
		message(4, msg, MT_STATUS);

		webui.sendCommands(function(errorMessage, commandResults)
		{
			var rv;

			if (errorMessage)
				rv = errorMessage;
			else if (commandResults.error)
				rv = "Webui returned error: " + commandResults.error;
			else
				rv = "";

			callback(rv);
		});
	}
	catch (ex)
	{
		if (typeof ex === "string")
			callback(ex);
		else
			callback("ScriptExec.createWebuiJob: ex: " + formatException(ex));
	}
}

// Should be the last statement in the file to indicate it loaded successfully
true;
