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

function Benc()
{
}

Benc.DICTIONARY = 0;
Benc.LIST = 1;
Benc.STRING = 2;
Benc.INTEGER = 3;

Benc.prototype.isDictionary =
function()
{
	return this.type === Benc.DICTIONARY;
}

Benc.prototype.isList =
function()
{
	return this.type === Benc.LIST;
}

Benc.prototype.isString =
function()
{
	return this.type === Benc.STRING;
}

Benc.prototype.isInteger =
function()
{
	return this.type === Benc.INTEGER;
}

Benc.prototype.readDictionary =
function(name)
{
	if (!this.isDictionary())
		return undefined;
	return this.dict[name];
}

function parseBencodedString(s)
{
	try
	{
		var benc = parseBencodedStringInternal(s, 0, 0);
		if (!benc.isDictionary())
			throw "Root of bencoded data must be a dictionary";
	}
	catch (ex)
	{
		return null;
	}

	return benc;
}

function parseBencodedStringInternal(s, index, level)
{
	function nextChar()
	{
		if (index >= s.length)
			throw "Bencoded string is missing data";
		return s.charAt(index++);
	}
	function peekChar()
	{
		var c = nextChar();
		index--;
		return c;
	}
	function isInteger(c)
	{
		var i = c.charCodeAt(0);
		return 0x30 <= i && i <= 0x39;
	}

	if (level++ >= 100)
		throw "Too many recursive calls";

	var benc = new Benc();
	benc.start = index;

	var c = peekChar();
	if (c === "d")
	{
		nextChar();

		benc.type = Benc.DICTIONARY;
		benc.dict = {};

		while (peekChar() !== "e")
		{
			var key = parseBencodedStringInternal(s, index, level);
			index = key.end;
			var value = parseBencodedStringInternal(s, index, level);
			index = value.end;

			if (!key.isString())
				throw "Invalid dictionary element; key part must be a string";

			benc.dict[key.string] = value;
		}
		nextChar();
	}
	else if (c === "l")
	{
		nextChar();

		benc.type = Benc.LIST;
		benc.list = [];

		while (peekChar() !== "e")
		{
			var elem = parseBencodedStringInternal(s, index, level);
			index = elem.end;
			benc.list.push(elem);
		}
		nextChar();
	}
	else if (isInteger(c))
	{
		benc.type = Benc.STRING;

		var colon = s.indexOf(":", index);
		if (colon === -1)
			throw "Missing colon";
		var len = s.substr(index, colon - index);
		index = colon + 1;
		var ilen = parseInt(len, 10);
		if (ilen < 0 || ("" + ilen) !== len || index + ilen > s.length)
			throw "Byte string with invalid length";
		benc.string = s.substr(index, ilen);
		index += ilen;
	}
	else if (c === "i")
	{
		nextChar();

		benc.type = Benc.INTEGER;

		var eindex = s.indexOf("e", index);
		if (eindex === -1)
			throw "Missing terminating 'e'";
		benc.integer = s.substr(index, eindex - index);
		index = eindex + 1;
	}
	else
	{
		throw "Invalid character found at index " + index;
	}

	benc.end = index;
	return benc;
}

// Should be the last statement in the file to indicate it loaded successfully
true;
