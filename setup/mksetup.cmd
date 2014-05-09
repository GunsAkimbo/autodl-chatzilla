@echo off
REM ***** BEGIN LICENSE BLOCK *****
REM Version: MPL 1.1
REM
REM The contents of this file are subject to the Mozilla Public License Version
REM 1.1 (the "License"); you may not use this file except in compliance with
REM the License. You may obtain a copy of the License at
REM http://www.mozilla.org/MPL/
REM
REM Software distributed under the License is distributed on an "AS IS" basis,
REM WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
REM for the specific language governing rights and limitations under the
REM License.
REM
REM The Original Code is IRC Auto Downloader.
REM
REM The Initial Developer of the Original Code is
REM David Nilsson.
REM Portions created by the Initial Developer are Copyright (C) 2010
REM the Initial Developer. All Rights Reserved.
REM
REM Contributor(s):
REM
REM ***** END LICENSE BLOCK ***** */

REM
REM Execute this script to create setup.exe. You may have to edit this file
REM so it can find ISCC (Inno Setup Compiler). Install the QuickStart Pack
REM or the compilation may fail.
REM
set ISCC="C:\Program Files (x86)\Inno Setup 5\ISCC.exe"

if not exist %ISCC% goto noiscc

%ISCC% setup.iss
if errorlevel 1 goto errorcompiling
goto exit

:errorcompiling
echo **************************************************************
echo Could not compile it. Make sure the QuickStart Pack is installed.
echo **************************************************************
goto exit

:noiscc
echo **************************************************************
echo Could not find ISCC (%ISCC%)!
echo You need to edit this file (%0).
echo **************************************************************
goto exit

:exit
set ISCC=
