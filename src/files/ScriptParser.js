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

function ScriptParser()
{
}

ScriptParser.prototype.allCommands =
{
	"extract":
	{
		args:
		{
			"--source-path":
			{
				name: "sourcePath",
				type: "string",
			},
			"--destination-path":
			{
				name: "destPath",
				type: "string",
			},
			"--dont-copy":
			{
				name: "dontCopy",
				type: "string",
			},
			"--copy-non-archive":
			{
				name: "copyNonArchive",
				type: "boolean",
			},
			"--delete-archives":
			{
				name: "deleteArchives",
				type: "boolean",
			},
		},
	},
	"copy":
	{
		args:
		{
			"--source-path":
			{
				name: "sourcePath",
				type: "string",
			},
			"--destination-path":
			{
				name: "destPath",
				type: "string",
			},
			"--dont-copy":
			{
				name: "dontCopy",
				type: "string",
			},
		},
	},
	"move":
	{
		args:
		{
			"--source-path":
			{
				name: "sourcePath",
				type: "string",
			},
			"--destination-path":
			{
				name: "destPath",
				type: "string",
			},
			"--dont-move":
			{
				name: "dontMove",
				type: "string",
			},
		},
	},
	"delete":
	{
		args:
		{
			"--source-path":
			{
				name: "sourcePath",
				type: "string",
			},
			"--dont-delete":
			{
				name: "dontDelete",
				type: "string",
			},
		},
	},
	"exec":
	{
		args:
		{
			"--command":
			{
				name: "command",
				type: "string",
			},
			"--arguments":
			{
				name: "arguments",
				type: "string",
			},
			"--ignore-exit-code":
			{
				name: "ignoreExitCode",
				type: "boolean",
			},
		},
	},
	"webui":
	{
		args:
		{
			"--command":
			{
				name: "command",
				type: "string",
			},
			"--argument":
			{
				name: "argument",
				type: "string",
			},
		},
	},
};

ScriptParser.prototype.parseLine =
function(line)
{
	var rv = {};

	var ary = line.match(/^\s*(\w+)?\s*(.*)/);
	if (!ary)
		return null;
	rv.commandString = ary[1] || "";

	var argsLine = ary[2];
	rv.args = [];
	for (;;)
	{
		argsLine = argsLine.match(/^\s*(.*)/)[1];
		if (argsLine.length === 0)
			break;

		var arg;
		if (argsLine[0] === "#")
			break;
		else if (argsLine[0] === "\"")
		{
			for (var endQuote = 1;;)
			{
				var next = argsLine.indexOf("\"", endQuote);
				if (next === -1)
				{
					endQuote = argsLine.length;
					break;
				}
				if (argsLine[next-1] !== "\\")
				{
					endQuote = next;
					break;
				}
				endQuote = next + 1;
			}
			arg = argsLine.substr(1, endQuote-1);
			argsLine = argsLine.substr(endQuote + 1);
		}
		else
		{
			ary = argsLine.match(/^(\S+)(.*)/)
			if (!ary)
				return null;
			arg = ary[1];
			argsLine = ary[2];
		}
		arg = arg.replace(/\\"/g, "\"");
		rv.args.push(arg);
	}

	return rv;
}

ScriptParser.prototype.parse =
function(script)
{
	var lines = script.contents.split(/\r?\n/);

	var commandsAry = [];
	for (var i = 0; i < lines.length; i++)
	{
		function error(msg)
		{
			message(0, "Script '" + script.name + "': line: " + (i+1) + ": " + msg + ": '" + line + "'", MT_ERROR);
			return null;
		}

		var line = lines[i];
		var lineInfo = this.parseLine(line);
		if (!lineInfo)
			return error("Could not parse line");
		if (!lineInfo.commandString)
			continue;	// Comment

		var commandInfo = this.allCommands[lineInfo.commandString];
		if (!commandInfo)
			return error("invalid command '" + lineInfo.commandString + "'");

		var command = this.createCommand(lineInfo.commandString, commandInfo);
		for (var j = 0; j < lineInfo.args.length; j++)
		{
			var argInfo = commandInfo.args[lineInfo.args[j]];
			if (!argInfo)
				return error("invalid arg '" + lineInfo.args[j] + "'");
			switch (argInfo.type)
			{
			case "string":
				if (j+1 >= lineInfo.args.length || lineInfo.args[j+1][0] === "-")
					return error("Missing string argument after " + lineInfo.commandString);
				j++;
				command[argInfo.name] = lineInfo.args[j];
				break;

			case "boolean":
				command[argInfo.name] = true;
				break;

			default:
				return error("Internal error: unknown argInfo.type: " + argInfo.type);
			}
		}

		commandsAry.push(command);
	}

	return commandsAry;
}

ScriptParser.prototype.createCommand =
function(commandString, commandInfo)
{
	var command = { name: commandString };
	for (var argName in commandInfo.args)
	{
		var argInfo = commandInfo.args[argName];

		switch (argInfo.type)
		{
		case "string":
			command[argInfo.name] = "";
			break;

		case "boolean":
			command[argInfo.name] = false;
			break;

		default:
			message(0, "Internal error: unknown argInfo.type: " + argInfo.type, MT_ERROR);
			break;
		}
	}

	return command;
}

// Should be the last statement in the file to indicate it loaded successfully
true;
