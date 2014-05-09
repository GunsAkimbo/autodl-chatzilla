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

// Returns an instance supporting the nsIProcess interface + runAsync() method. Requires
// Gecko 1.9.1 or later (eg. FireFox 3.5 or later)
// The runAsync() method is part of the nsIProcess2 interface (Gecko 1.9.1) or the nsIProcess
// interface (Gecko 1.9.2 or later).
function get_nsIProcess()
{
	var cls = Components.classes["@mozilla.org/process/util;1"];

	function getInterface(itf)
	{
		try
		{
			var process = cls.createInstance(itf);
			if ("runAsync" in process)
				return process;
		}
		catch (ex)
		{
		}
		return null;
	}

	return getInterface(Components.interfaces.nsIProcess) ||
		   getInterface(Components.interfaces.nsIProcess2);
}

// Execute a program
//	execInfo.program	- The program to execute
//	execInfo.arguments	- The arguments passed to the program
//	execInfo.callback	- Optional. Notified whenever the program has stopped. Args:
//							success	- true if we could execute it, false otherwise
//							exitValue - the program exit code if success is true; undefined otherwise
function Exec(execInfo)
{
	try
	{
		execInfo.arguments = execInfo.arguments || "";
		var process = get_nsIProcess();
		if (!process)
		{
			message(0, "Could not execute process because you're using an old version of FireFox. Requires v3.5 or later version.", MT_ERROR);
			return false;
		}

		var env = Components.classes["@mozilla.org/process/environment;1"].createInstance(Components.interfaces.nsIEnvironment);

		// ComSpec contains the path to cmd.exe (Windows). Use it to start the program minimized,
		// which is possible if we use the "start /MIN" built-in command. There's one problem with
		// this method and that is cmd.exe will remove the first and last quote characters it finds,
		// which means that if the command line is '"some path with spaces.exe" "arg #1"' then it
		// will be changed to 'some path with spaces.exe" "arg #1'. The solution to this problem is
		// to place a quote character at the start end end like '""some path with spaces.exe" "arg #1""'.
		// Well it would've been a solution unless XPCOM was retarded. XPCOM will change " => \".
		// So it's impossible to start a program minimized if the path to the program contains spaces.
		var comspec;
		if (!execInfo.callback &&
			client.platform.toLowerCase() === "windows" &&
			execInfo.program.indexOf(" ") === -1 &&
			(comspec = env.get("ComSpec")))
		{
			var processName = comspec;

			// cmd.exe /C => run command then exit immediately
			// start /MIN => start program minimized. The " " argument is there so we can give it
			// a title in quotes, which is required if there are any other arguments in quotes.
			var args = ["/C", "start", " ", "/MIN", execInfo.program];
		}
		else
		{
			var processName = execInfo.program;
			var args = [];
		}

		process.init(nsLocalFile(processName));

		var userArgs = execInfo.arguments.match(/"[^"]*"|[^"\s]+|".*/g) || [];
		for (var i = 0; i < userArgs.length; i++)
		{
			var arg = userArgs[i];
			var i1 = arg[0] === '"' ? 1 : 0;
			var i2 = arg.length-1 > 0 && arg[arg.length-1] === '"' ? arg.length-1 : arg.length;
			args.push(arg.substring(i1, i2));
		}

		message(5, "Exec: '" + processName + "' args: " + args, MT_STATUS);
		if (!execInfo.callback)
			process.run(false, args, args.length);
		else
		{
			process.runAsync(args, args.length,
			{
				observe: function(subject, topic, data)
				{
					var success = topic === "process-finished";
					if (success || topic === "process-failed")
						execInfo.callback(success, success ? process.exitValue : undefined);
				},
			}, false);
		}
	}
	catch (ex)
	{
		return false;
	}

	return true;
}

// Should be the last statement in the file to indicate it loaded successfully
true;
