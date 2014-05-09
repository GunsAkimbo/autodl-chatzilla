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

function createBinaryInputStream(stream)
{
	if (!stream)
		return null;

	var binaryStream = Components.classes["@mozilla.org/binaryinputstream;1"].createInstance(Components.interfaces.nsIBinaryInputStream);
	binaryStream.setInputStream(stream);
	return binaryStream;
}

function createBinaryOutputStream(stream)
{
	if (!stream)
		return null;

	var binaryStream = Components.classes["@mozilla.org/binaryoutputstream;1"].createInstance(Components.interfaces.nsIBinaryOutputStream)
	binaryStream.setOutputStream(stream);
	return binaryStream;
}

function toHexString(s)
{
	var rv = "";

	for (var i = 0; i < s.length; i++)
		rv += ("0" + s.charCodeAt(i).toString(16)).slice(-2);

	return rv;
}

function copyObj(source, dest)
{
	dest = dest || {};
	for (var p in source)
		dest[p] = source[p];
	return dest;
}

function appendUrlQuery(url, query)
{
	if (url.indexOf("?") === -1)
		return url + "?" + query;
	return url + "&" + query;
}

function stringTrim(s)
{
	return s.replace(/^\s+|\s+$/g, "");
}

function stringCompare(a, b)
{
	if (a < b)
		return -1;
	if (a > b)
		return 1;
	return 0;
}

// URL-encode a string
function toUrlEncode(s)
{
	// Don't use encodeURIComponent() since it converts the data to a utf-8 string. The trackers
	// don't like it when the info_hash is eg. 27 bytes instead of 20...

	var str = "";
	for (var i = 0; i < s.length; i++)
	{
		var c = s.charCodeAt(i);
		if ((0x30 <= c && c <= 0x39) || (0x41 <= c && c <= 0x5A) || (0x61 <= c && c <= 0x7A) || c === 0x2D || c === 0x2E || c === 0x5F || c === 0x7E)
			str += String.fromCharCode(c);
		else
			str += "%" + ("0" + c.toString(16)).slice(-2);
	}
	return str;
}

var decodeHtmlEntitiesTable =
{
	"&quot;":	"\x22",
	"&amp;":	"\x26",
	"&apos;":	"\x27",
	"&lt;":		"\x3C",
	"&gt;":		"\x3E",
	"&nbsp;":	"\xA0",
	"&iexcl;":	"\xA1",
	"&cent;":	"\xA2",
	"&pound;":	"\xA3",
	"&curren;":	"\xA4",
	"&yen;":	"\xA5",
	"&brvbar;":	"\xA6",
	"&sect;":	"\xA7",
	"&uml;":	"\xA8",
	"&copy;":	"\xA9",
	"&ordf;":	"\xAA",
	"&laquo;":	"\xAB",
	"&not;":	"\xAC",
	"&shy;":	"\xAD",
	"&reg;":	"\xAE",
	"&macr;":	"\xAF",
	"&deg;":	"\xB0",
	"&plusmn;":	"\xB1",
	"&sup2;":	"\xB2",
	"&sup3;":	"\xB3",
	"&acute;":	"\xB4",
	"&micro;":	"\xB5",
	"&para;":	"\xB6",
	"&middot;":	"\xB7",
	"&cedil;":	"\xB8",
	"&sup1;":	"\xB9",
	"&ordm;":	"\xBA",
	"&raquo;":	"\xBB",
	"&frac14;":	"\xBC",
	"&frac12;":	"\xBD",
	"&frac34;":	"\xBE",
	"&iquest;":	"\xBF",
	"&Agrave;":	"\xC0",
	"&Aacute;":	"\xC1",
	"&Acirc;":	"\xC2",
	"&Atilde;":	"\xC3",
	"&Auml;":	"\xC4",
	"&Aring;":	"\xC5",
	"&AElig;":	"\xC6",
	"&Ccedil;":	"\xC7",
	"&Egrave;":	"\xC8",
	"&Eacute;":	"\xC9",
	"&Ecirc;":	"\xCA",
	"&Euml;":	"\xCB",
	"&Igrave;":	"\xCC",
	"&Iacute;":	"\xCD",
	"&Icirc;":	"\xCE",
	"&Iuml;":	"\xCF",
	"&ETH;":	"\xD0",
	"&Ntilde;":	"\xD1",
	"&Ograve;":	"\xD2",
	"&Oacute;":	"\xD3",
	"&Ocirc;":	"\xD4",
	"&Otilde;":	"\xD5",
	"&Ouml;":	"\xD6",
	"&times;":	"\xD7",
	"&Oslash;":	"\xD8",
	"&Ugrave;":	"\xD9",
	"&Uacute;":	"\xDA",
	"&Ucirc;":	"\xDB",
	"&Uuml;":	"\xDC",
	"&Yacute;":	"\xDD",
	"&THORN;":	"\xDE",
	"&szlig;":	"\xDF",
	"&agrave;":	"\xE0",
	"&aacute;":	"\xE1",
	"&acirc;":	"\xE2",
	"&atilde;":	"\xE3",
	"&auml;":	"\xE4",
	"&aring;":	"\xE5",
	"&aelig;":	"\xE6",
	"&ccedil;":	"\xE7",
	"&egrave;":	"\xE8",
	"&eacute;":	"\xE9",
	"&ecirc;":	"\xEA",
	"&euml;":	"\xEB",
	"&igrave;":	"\xEC",
	"&iacute;":	"\xED",
	"&icirc;":	"\xEE",
	"&iuml;":	"\xEF",
	"&eth;":	"\xF0",
	"&ntilde;":	"\xF1",
	"&ograve;":	"\xF2",
	"&oacute;":	"\xF3",
	"&ocirc;":	"\xF4",
	"&otilde;":	"\xF5",
	"&ouml;":	"\xF6",
	"&divide;":	"\xF7",
	"&oslash;":	"\xF8",
	"&ugrave;":	"\xF9",
	"&uacute;":	"\xFA",
	"&ucirc;":	"\xFB",
	"&uuml;":	"\xFC",
	"&yacute;":	"\xFD",
	"&thorn;":	"\xFE",
	"&yuml;":	"\xFF",
	"&OElig;":	"\u0152",
	"&oelig;":	"\u0153",
	"&Scaron;":	"\u0160",
	"&scaron;":	"\u0161",
	"&Yuml;":	"\u0178",
	"&fnof;":	"\u0192",
	"&circ;":	"\u02C6",
	"&tilde;":	"\u02DC",
	"&Alpha;":	"\u0391",
	"&Beta;":	"\u0392",
	"&Gamma;":	"\u0393",
	"&Delta;":	"\u0394",
	"&Epsilon;":"\u0395",
	"&Zeta;":	"\u0396",
	"&Eta;":	"\u0397",
	"&Theta;":	"\u0398",
	"&Iota;":	"\u0399",
	"&Kappa;":	"\u039A",
	"&Lambda;":	"\u039B",
	"&Mu;":		"\u039C",
	"&Nu;":		"\u039D",
	"&Xi;":		"\u039E",
	"&Omicron;":"\u039F",
	"&Pi;":		"\u03A0",
	"&Rho;":	"\u03A1",
	"&Sigma;":	"\u03A3",
	"&Tau;":	"\u03A4",
	"&Upsilon;":"\u03A5",
	"&Phi;":	"\u03A6",
	"&Chi;":	"\u03A7",
	"&Psi;":	"\u03A8",
	"&Omega;":	"\u03A9",
	"&alpha;":	"\u03B1",
	"&beta;":	"\u03B2",
	"&gamma;":	"\u03B3",
	"&delta;":	"\u03B4",
	"&epsilon;":"\u03B5",
	"&zeta;":	"\u03B6",
	"&eta;":	"\u03B7",
	"&theta;":	"\u03B8",
	"&iota;":	"\u03B9",
	"&kappa;":	"\u03BA",
	"&lambda;":	"\u03BB",
	"&mu;":		"\u03BC",
	"&nu;":		"\u03BD",
	"&xi;":		"\u03BE",
	"&omicron;":"\u03BF",
	"&pi;":		"\u03C0",
	"&rho;":	"\u03C1",
	"&sigmaf;":	"\u03C2",
	"&sigma;":	"\u03C3",
	"&tau;":	"\u03C4",
	"&upsilon;":"\u03C5",
	"&phi;":	"\u03C6",
	"&chi;":	"\u03C7",
	"&psi;":	"\u03C8",
	"&omega;":	"\u03C9",
	"&thetasym;":"\u03D1",
	"&upsih;":	"\u03D2",
	"&piv;":	"\u03D6",
	"&ensp;":	"\u2002",
	"&emsp;":	"\u2003",
	"&thinsp;":	"\u2009",
	"&zwnj;":	"\u200C",
	"&zwj;":	"\u200D",
	"&lrm;":	"\u200E",
	"&rlm;":	"\u200F",
	"&ndash;":	"\u2013",
	"&mdash;":	"\u2014",
	"&lsquo;":	"\u2018",
	"&rsquo;":	"\u2019",
	"&sbquo;":	"\u201A",
	"&ldquo;":	"\u201C",
	"&rdquo;":	"\u201D",
	"&bdquo;":	"\u201E",
	"&dagger;":	"\u2020",
	"&Dagger;":	"\u2021",
	"&bull;":	"\u2022",
	"&hellip;":	"\u2026",
	"&permil;":	"\u2030",
	"&prime;":	"\u2032",
	"&Prime;":	"\u2033",
	"&lsaquo;":	"\u2039",
	"&rsaquo;":	"\u203A",
	"&oline;":	"\u203E",
	"&frasl;":	"\u2044",
	"&euro;":	"\u20AC",
	"&image;":	"\u2111",
	"&weierp;":	"\u2118",
	"&real;":	"\u211C",
	"&trade;":	"\u2122",
	"&alefsym;":"\u2135",
	"&larr;":	"\u2190",
	"&uarr;":	"\u2191",
	"&rarr;":	"\u2192",
	"&darr;":	"\u2193",
	"&harr;":	"\u2194",
	"&crarr;":	"\u21B5",
	"&lArr;":	"\u21D0",
	"&uArr;":	"\u21D1",
	"&rArr;":	"\u21D2",
	"&dArr;":	"\u21D3",
	"&hArr;":	"\u21D4",
	"&forall;":	"\u2200",
	"&part;":	"\u2202",
	"&exist;":	"\u2203",
	"&empty;":	"\u2205",
	"&nabla;":	"\u2207",
	"&isin;":	"\u2208",
	"&notin;":	"\u2209",
	"&ni;":		"\u220B",
	"&prod;":	"\u220F",
	"&sum;":	"\u2211",
	"&minus;":	"\u2212",
	"&lowast;":	"\u2217",
	"&radic;":	"\u221A",
	"&prop;":	"\u221D",
	"&infin;":	"\u221E",
	"&ang;":	"\u2220",
	"&and;":	"\u2227",
	"&or;":		"\u2228",
	"&cap;":	"\u2229",
	"&cup;":	"\u222A",
	"&int;":	"\u222B",
	"&there4;":	"\u2234",
	"&sim;":	"\u223C",
	"&cong;":	"\u2245",
	"&asymp;":	"\u2248",
	"&ne;":		"\u2260",
	"&equiv;":	"\u2261",
	"&le;":		"\u2264",
	"&ge;":		"\u2265",
	"&sub;":	"\u2282",
	"&sup;":	"\u2283",
	"&nsub;":	"\u2284",
	"&sube;":	"\u2286",
	"&supe;":	"\u2287",
	"&oplus;":	"\u2295",
	"&otimes;":	"\u2297",
	"&perp;":	"\u22A5",
	"&sdot;":	"\u22C5",
	"&lceil;":	"\u2308",
	"&rceil;":	"\u2309",
	"&lfloor;":	"\u230A",
	"&rfloor;":	"\u230B",
	"&lang;":	"\u2329",
	"&rang;":	"\u232A",
	"&loz;":	"\u25CA",
	"&spades;":	"\u2660",
	"&clubs;":	"\u2663",
	"&hearts;":	"\u2665",
	"&diams;":	"\u2666",
};

function decodeHtmlEntities(s)
{
	var rv = "";

	var ary = s.match(/&[^&;]*;?|[^&]+/g);
	if (!ary)
		return "";

	for (var i = 0; i < ary.length; i++)
	{
		var t = ary[i];
		if (t[0] !== "&" || t[t.length-1] !== ";")
		{
			rv += t;
			continue;
		}

		var newChar = decodeHtmlEntitiesTable[t];
		if (newChar)
		{
			rv += newChar;
			continue;
		}

		if (t.substr(1, 2) === "#x")
		{
			var val = parseInt(t.substr(3, t.length - 4), 16);
			if (!isNaN(val) && t.toLowerCase() === ("&#x" + val.toString(16) + ";").toLowerCase())
			{
				rv += String.fromCharCode(val);
				continue;
			}
		}
		else if (t[1] === "#")
		{
			var val = parseInt(t.substr(2, t.length - 3), 10);
			if (!isNaN(val) && t.toLowerCase() === ("&#" + val.toString(10) + ";"))
			{
				rv += String.fromCharCode(val);
				continue;
			}
		}

		rv += t;
	}

	return rv;
}

// path is either a string or an nsIFile. Returns true if successful
function createDirectory(path)
{
	try
	{
		var localFile = typeof path === "string" ? nsLocalFile(path) : path;
		localFile.create(localFile.DIRECTORY_TYPE, 0777);
		return true;
	}
	catch (ex)
	{
		return ex.name === "NS_ERROR_FILE_ALREADY_EXISTS";
	}
}

// Returns the SHA-1 hash of the array as a string
function getSha1Hash(s)
{
	var sstream = Components.classes["@mozilla.org/io/string-input-stream;1"].createInstance(Components.interfaces.nsIStringInputStream);
	sstream.setData(s, s.length);
	var cryptoHash = Components.classes["@mozilla.org/security/hash;1"].createInstance(Components.interfaces.nsICryptoHash);
	cryptoHash.init(cryptoHash.SHA1);
	cryptoHash.updateFromStream(sstream, sstream.available());
	return cryptoHash.finish(false);
}

function convertStringToBoolean(s)
{
	s = s.toLowerCase();
	return !(s === "false" || s === "off" || s === "no" || s === "0");
}

function convertStringToNumber(valueStr, defaultValue, minValue, maxValue)
{
	var value = parseFloat(valueStr);
	if (isNaN(value))
		value = defaultValue;
	if (value === undefined)
		return value;
	if (minValue !== undefined && value < minValue)
		value = minValue;
	if (maxValue !== undefined && value > maxValue)
		value = maxValue;
	return value;
}

function convertStringToInteger(valueStr, defaultValue, minValue, maxValue)
{
	return Math.floor(convertStringToNumber(valueStr, defaultValue, minValue, maxValue));
}

function trimMultiLineString(s)
{
	function isWhiteSpace(c)
	{
		return c === " " || c === "\t" || c === "\r" || c === "\n";
	}

	var startIndex = 0;
	while (startIndex < s.length && isWhiteSpace(s.charAt(startIndex)))
		startIndex++;

	var endIndex = s.length - 1;
	while (endIndex > startIndex && isWhiteSpace(s.charAt(endIndex)))
		endIndex--;

	return s.substr(startIndex, endIndex - startIndex + 1);
}

// Strips off any mIRC color codes from the string
function stripMircColorCodes(s)
{
	return s.replace(/\x03\d\d?,\d\d?/g, "").
			 replace(/\x03\d\d?/g, "").
			 replace(/[\x01-\x1F]/g, "");
}

// Removes invisible chars and replaces them with spaces
function removeInvisibleChars(s)
{
	var rv = "";

	var bg = -1, fg = -2;
	for (var i = 0; i < s.length; i++)
	{
		var c = s[i];

		if (c === "\x03")
		{
			var ary = s.substr(i).match(/^\x03(?:(\d{1,2})(?:,(\d{1,2}))?)?/);
			var fg2 = parseInt(ary[1] || "", 10);
			var bg2 = parseInt(ary[2] || "", 10);
			if (!isNaN(bg2))
				bg = bg2;
			if (!isNaN(fg2))
				fg = fg2;
			c = ary[0];
			i += c.length - 1;
		}
		else if (c.charCodeAt(0) > 0x1F && bg === fg)
			c = " ";

		rv += c;
	}

	return rv;
}

// Decodes a JSON string, returning the objec or null if an error occurred.
function decodeJson(s)
{
	try
	{
		// Requires Firefox 3 or later
		var json = Components.classes["@mozilla.org/dom/json;1"].createInstance(Components.interfaces.nsIJSON);
		return json.decode(s);
	}
	catch (ex)
	{
		message(0, "decodeJson() exception. Need FireFox 3+: error: " + formatException(ex), MT_ERROR);
		return null;
	}
}

// Convert the path name (no path separators) to a valid file/dir name
function convertToValidPathName(s)
{
	return s.replace(/[\x00-\x1F\/\\\:\*\?\"\<\>\|]/g, "_");
}

// Converts a size string to a number which is size in bytes, eg. string = "123 MB", "5.5GB", etc.
// Returns null or the size in bytes
function convertByteSizeString(s)
{
	if (s === undefined || s === null)
		return null;
	var ary = s.match(/^\s*([\d\.,]+)\s*(\w+)?\s*$/);
	if (!ary)
		return null;

	var amountStr = ary[1].replace(/,/g, "");
	var sizePrefix = (ary[2] === undefined ? "B" : ary[2]).toUpperCase();
	var mult;
	if (sizePrefix === "B")
		mult = 1;
	else if (sizePrefix === "KB" || sizePrefix === "KIB")
		mult = 1024;
	else if (sizePrefix === "MB" || sizePrefix === "MIB")
		mult = 1024*1024;
	else if (sizePrefix === "GB" || sizePrefix === "GIB")
		mult = 1024*1024*1024;
	else
		return null;

	var size = parseFloat(amountStr);
	if (isNaN(size))
		return null;

	return Math.round(size * mult);
}

function convertToByteSizeString(size)
{
	if (size === null || size === undefined)
		return null;

	var sizePrefix;
	if (size >= 1024*1024*1000)
	{
		size /= 1024*1024*1024;
		sizePrefix = "GB";
	}
	else if (size >= 1024*1000)
	{
		size /= 1024*1024;
		sizePrefix = "MB";
	}
	else if (size >= 1000)
	{
		size /= 1024;
		sizePrefix = "KB";
	}
	else
		sizePrefix = "Bytes";

	var rv = "" + size;
	var dot = rv.indexOf(".");
	if (dot !== -1)
		rv = rv.substr(0, dot + 3);

	return rv + " " + sizePrefix;
}

// Converts a string like "5 mins, 2 secs" to time in seconds or null
function convertTimeSinceString(s)
{
	if (s === undefined || s === null)
		return null;
	var ary = s.match(/\d+\s*\w+/g)
	if (!ary)
		return null;

	var rv = 0;
	for (var i = 0; i < ary.length; i++)
	{
		var ary2 = ary[i].match(/(\d+)\s*(\w+)/);
		if (!ary2)
			return null;
		var numStr = ary2[1];
		var typeStr = ary2[2].toLowerCase();
		var mult;
		if (typeStr.match(/^sec/) || typeStr === "s")
			mult = 1;
		else if (typeStr.match(/^min/) || typeStr === "m")
			mult = 60;
		else if (typeStr.match(/^(?:hour|hr)/) || typeStr === "h")
			mult = 60*60;
		else if (typeStr.match(/^day/) || typeStr === "d")
			mult = 60*60*24;
		else if (typeStr.match(/^(?:week|wk)/) || typeStr === "w")
			mult = 60*60*24*7;
		else
			return null;

		rv += parseInt(numStr, 10) * mult;
	}

	return rv;
}

function convertToTimeSinceString(seconds)
{
	if (seconds === undefined || seconds === null)
		return null;

	var weeks = Math.floor(seconds / (60*60*24*7));
	var days = Math.floor(seconds / (60*60*24) % 7);
	var hours = Math.floor(seconds / (60*60) % 24);
	var mins = Math.floor(seconds / 60 % 60);
	var secs = Math.floor(seconds % 60);

	var ary = [];
	if (weeks > 0)
		ary.push("" + weeks + " week" + (weeks !== 1 ? "s" : ""));
	if (days > 0)
		ary.push("" + days + " day" + (days !== 1 ? "s" : ""));
	if (hours > 0)
		ary.push("" + hours + " hour" + (hours !== 1 ? "s" : ""));
	if (mins > 0)
		ary.push("" + mins + " minute" + (mins !== 1 ? "s" : ""));
	if (secs > 0 || ary.length === 0)
		ary.push("" + secs + " second" + (secs !== 1 ? "s" : ""));

	var rv = "";
	for (var i = 0; i < ary.length; i++)
	{
		if (i > 0)
			rv += " ";
		rv += ary[i];
	}

	return rv;
}

function checkFilterStrings(name, filter)
{
	return checkRegexArray(name, regexEscapeWildcardString(filter).split(","));
}

function regexEscapeWildcardString(s)
{
	s = s.replace(/([\^\$\.\+\=\!\:\|\\\/\(\)\[\]\{\}])/g, "\\$1");
	s = s.replace(/([*])/g, ".$1");
	s = s.replace(/([?])/g, ".{1}");
	return s;
}

// Returns true if name matches one of the words in filterWordsAry
//	@param name	The string to check
//	@param filterWordsAry	Array containing all regex strings
function checkRegexArray(name, filterWordsAry)
{
	for (var i = 0; i < filterWordsAry.length; i++)
	{
		var filterWord = stringTrim(filterWordsAry[i]);
		if (!filterWord)
			continue;
		if (name.match(new RegExp("^" + filterWord + "$", "i")))
			return true;
	}

	return false;
}

// Returns all child nodes where func(child) == true
function getChildNodes(node, func)
{
	var rv = [];

	for (var i = 0; i < node.childNodes.length; i++)
	{
		var child = node.childNodes[i];
		if (func(child))
			rv.push(child);
	}

	return rv;
}

// Returns all child elements of a certain tag name. Similar to getElementsByTagName() but not recursive
function getChildElementsByTagName(node, name)
{
	return getChildNodes(node, function(child)
	{
		return child.nodeType === 1 && child.nodeName === name;
	});
}

// Returns all child elements
function getChildElements(node)
{
	return getChildNodes(node, function(child)
	{
		return child.nodeType === 1;
	});
}

function getTheChildElement(elem, childElemName)
{
    var ary = getChildElementsByTagName(elem, childElemName);
	if (ary.length !== 1)
	    throw "Could not find one and only one child element named '" + childElemName + "'";
    return ary[0];
}

// Creates a child element containing a text node with value textValue. The child element is
// appended to elem.
function appendTextElement(doc, elem, childElemName, textValue)
{
	var child = doc.createElement(childElemName);
	child.appendChild(doc.createTextNode(textValue));
	elem.appendChild(child);
}

// Returns the value of the text node in a child element
function readTextNode(elem, childElemName, defaultValue)
{
	var ary = getChildElementsByTagName(elem, childElemName);
	if (ary.length === 0)
		return defaultValue;

	var elem = ary[0];
	var child = elem.firstChild;
	if (!child || child.nodeType !== 3)
		return defaultValue;

	// FireFox has a 4K limit on text nodes! It will split them up into multiple text
	// nodes, so we must combine them all.
	var s = "";
	for (var i = 0; i < elem.childNodes.length; i++)
	{
		var childNode = elem.childNodes[i];
		var nodeType = childNode.nodeType;
		if (nodeType === 3 || nodeType === 4)
			s += childNode.nodeValue;
	}

	// Trim the string, including newlines
	s = s.replace(/^\s+/m, "");
	s = s.replace(/\s+$/m, "");
	return s;
}

function readTextNodeBoolean(elem, childElemName, defaultValue)
{
	var strVal = readTextNode(elem, childElemName);
	if (strVal === undefined)
		return defaultValue;
	return convertStringToBoolean(strVal);
}

function readTextNodeNumber(elem, childElemName, defaultValue, minValue, maxValue)
{
	var strVal = readTextNode(elem, childElemName);
	if (strVal === undefined)
		return defaultValue;
	return convertStringToNumber(strVal, defaultValue, minValue, maxValue);
}

function readTextNodeInteger(elem, childElemName, defaultValue, minValue, maxValue)
{
	var strVal = readTextNode(elem, childElemName);
	if (strVal === undefined)
		return defaultValue;
	return convertStringToInteger(strVal, defaultValue, minValue, maxValue);
}

function readAttribute(elem, attrName, defaultValue)
{
	var attr = elem.attributes.getNamedItem(attrName);
	return attr === null ? defaultValue : attr.nodeValue;
}

function readAttributeBoolean(elem, attrName, defaultValue)
{
	var strVal = readAttribute(elem, attrName)
	if (strVal === undefined)
		return defaultValue;
	return convertStringToBoolean(strVal);
}

function readAttributeNumber(elem, attrName, defaultValue, minValue, maxValue)
{
	var strVal = readAttribute(elem, attrName)
	if (strVal === undefined)
		return defaultValue;
	return convertStringToNumber(strVal, defaultValue, minValue, maxValue);
}

function readAttributeInteger(elem, attrName, defaultValue, minValue, maxValue)
{
	var strVal = readAttribute(elem, attrName)
	if (strVal === undefined)
		return defaultValue;
	return convertStringToInteger(strVal, defaultValue, minValue, maxValue);
}

function toUtf8(s)
{
	var utf8Converter = Components.classes["@mozilla.org/intl/utf8converterservice;1"].getService(Components.interfaces.nsIUTF8ConverterService);
	return utf8Converter.convertURISpecToUTF8(s, "UTF-8");
}

// Returns the DOM if OK, null if empty file, or undefined if some error occurred
function readXmlFile(file, isUtf8)
{
	var localFile = new LocalFile(file, "<");
	var str = localFile.read(0x7FFFFFFF);
	localFile.close();

	if (isUtf8)
		str = toUtf8(str);

	return parseXmlString(str);
}

// Returns the DOM if OK, null if empty file, or undefined if some error occurred
function parseXmlString(str)
{
	if (!str)
		return null;

	var parser = new DOMParser();
	var dom = parser.parseFromString(str, "text/xml");
	if (dom.documentElement.nodeName === "parsererror")
		return undefined;

	return dom;
}

function getTrackerOptions(type, options)
{
	if (options === undefined)
		options = plugin.options;

	var trackerOptions = options.trackers[type];
	if (!trackerOptions)
		trackerOptions = options.trackers[type] = {};
	if (!trackerOptions.__isDefaultOption)
		trackerOptions.__isDefaultOption = {};
	return trackerOptions;
}

function getTrackerSetting(tracker, name)
{
	var settings = tracker.settings;
	for (var i = 0; i < settings.length; i++)
	{
		if (settings[i].name === name)
			return settings[i];
	}

	return undefined;
}

function readTrackerOption(tracker, name)
{
	var setting = getTrackerSetting(tracker, name);
	if (!setting)
		return undefined;

	var trackerOptions = getTrackerOptions(tracker.type);
	switch (setting.type)
	{
	case "bool":	return convertStringToBoolean(trackerOptions[name]);
	case "textbox":	return trackerOptions[name];
	case "integer":	return parseInt(trackerOptions[name], 10);

	case "description":
	default:
		return undefined;
	}
}

function writeTrackerOption(tracker, name, value, isDefaultValue)
{
	var setting = getTrackerSetting(tracker, name);
	if (!setting)
		return;

	var trackerOptions = getTrackerOptions(tracker.type);
	switch (setting.type)
	{
	case "bool":
	case "textbox":
	case "integer":
		trackerOptions[name] = value.toString();
		trackerOptions.__isDefaultOption[name] = !!isDefaultValue;
		break;

	case "description":
		break;

	default:
		message(0, "Invalid setting type: " + setting.type, MT_ERROR);
		break;
	}
}

// Returns a canonicalized server name
function canonicalizeServerName(serverName)
{
	var ary = serverName.match(/^([^:]*)/);
	return ary[1].toLowerCase();
}

// Returns a canonicalized network name
function canonicalizeNetworkName(networkName)
{
	if (networkName === undefined || networkName === null)
		return "";
	return "NETWORK-" + networkName.toLowerCase();
}

function isCanonicalizedNetworkName(name)
{
	return !!name.match(/^NETWORK-/);
}

// Should be the last statement in the file to indicate it loaded successfully
true;
