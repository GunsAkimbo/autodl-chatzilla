This is an auto downloader for ChatZilla.

Download it here: http://sourceforge.net/projects/autodl/

[*] Works on a lot of different trackers. Including this one!!!!! :D
[*] For Windows, Mac, Linux or any other OS that has FireFox or XULRunner.
[*] Can filter on pretty much anything, including size, name, tracker, category, music format, TV resolution, etc.
[*] TV, Movie, and Music filters don't require wildcards so very easy to use.
[*] FTP support, uTorrent Webui support
[*] Can save torrent files to dated folders (eg. 0322), or any other dynamic folder name you wish.
[*] Installer for Windows.
[*] Duplicate releases are not downloaded by default.
[*] Force SSL download option.


Use the latest version of FireFox or XUL Runner. Requires Gecko 1.9.1 or later (eg. FireFox 3.5 or later).


How to use it
-------------

First install it then start ChatZilla. The auto downloader will print messages to the *client* window. You can disable all messages in Auto Downloader -> Preferences -> Advanced, but it's best to leave it as it is.

Connect to IRC and join a supported announcer channel. Add some filters and wait.

To disable the auto downloader, type "/disable-plugin autodl" (without the quotes) and to enable it again, type "/enable-plugin autodl" (without the quotes). If you don't see the Auto Downloader menu, the auto downloader is disabled or not installed properly. To reload the auto downloader (for example, after you upgrade it), type "/reload-plugin autodl" (without the quotes). This will disable it, re-load it from disk, and enable it again.

How to install it
-----------------

There's an installer for Windows. If you don't have Windows, then you'll have to install it manually.

There's a nice installation and configuration tutorial @ http://filesharefreak.com/2010/01/10/private-tracker-irc-torrent-auto-downloader-made-easy/ or you can read below.

[*] First install ChatZilla. It requires FireFox or XULRunner. If you use XULRunner, you don't need FireFox opened to use ChatZilla. Make sure you have the latest version of FireFox or XULRunner.

[*] Next, type "/pref profilePath" (without the quotes) in ChatZilla to get the profile path. Go to that folder and you should see a scripts folder. Double click the scripts folder.

[*] Extract the contents of this auto downloader plugin in the scripts folder. You should now have an autodl folder inside the scripts folder. And in the autodl folder, there should be an init.js file. If you can't see it, then you did something wrong.

[*] Restart ChatZilla.

[*] If you can see
	Initializing autodl v1.XX
in the *client* tab window, then it is properly installed. If you can't see the Auto Downloader menu, then the auto downloader is disabled. Type "/enable-plugin autodl" (without the quotes) to enable it again.

[*] Choose what to do with the torrent file, save to watch folder, webui upload, ftp upload, run program, or save to dynamic folder: Auto Downloader -> Preferences -> Torrent Uploads.

[*] Initialize trackers: Auto Downloader -> Preferences -> Trackers

[*] Add your filters: Auto Downloader -> Filters -> add your filters
