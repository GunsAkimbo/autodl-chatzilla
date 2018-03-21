Goal of this repository is to make the autodl-plugin work with ChatZilla 0.9.90 and FireFox v19 and above, as well as add integrate support for Sonarr and Radarr

Fixed bugs:

- Settings.js: "XML is not defined @ ...\Settings.js"
- HttpRequest.js: "HttpRequest.sendGetRequestInternal: ex: Not Connected"
- Browse button wouldn't open the Windows file picker

Added Features:

- New torrent actions: Announce to Sonarr or Radarr
- If enabled, matched torrents won't be downloaded by Chatzilla, but forwarded to Sonarr/Radarr and handled from there.
- Option to recreate a scene-esque release name to send to Sonarr/Radarr. Useful for trackers that don't announce them.
- Option to delay announces of some content. HDTV releases under 720p, as well as WEB releases under 1080p.
- The idea here is you can have Sonarr allow lower quality releases, but it won't grab them unless higher quality releases are never announced.

Installation:

1. Download the source as a zip from GitHub and extract the "src" folder
2. Install ChatZilla, there's an easy Windows installer here: http://chatzilla.rdmsoft.com/xulrunner/
3. Run ChatZilla, the go to "ChatZilla > Install Plugin", point it at the "src" folder you extracted earlier, and hit OK
4. Plugin should load. Be sure to configure your trackers in the "Auto Downloader > Trackers" menu.