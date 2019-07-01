<h1 align="center">
  <a href="https://www.arewecontentprocesswin32kstill.com">A(re)W(e)C(ontent)W(in)32KS(til)-Client</a>
</h1>

## about

A whole lot of complexity neatly wrapped up into a few javascript files running across a few separate javascript runtimes (now with python!).

Interacts with a [log server](https://www.github.com/metalcanine/arewecontentwin32kstill) to run specified tests in the Firefox test suite based on try pushes. This will help the Platform Security team isolate and remove Win32K system calls in content processes and remote them with the ultimate goal of turning on Windows' System Call Disable Policy.

## setup

[mozillabuild](https://wiki.mozilla.org/MozillaBuild) has half of the needed software and if it is already installed on the client machine adding mozillabuild's binaries to the PATH is a decent option.
The needed software is:
- Visual Studio 2017 or 2019 with the options described [here.](https://developer.mozilla.org/en-US/docs/Mozilla/Developer_guide/Build_Instructions/Windows_Prerequisites)
- WinDbg from the latest Windows SDK (currently `Windows SDK 10.0.18362.0` be sure to download and install it outside of Visual Studio's installer)
- Node.js (any recent version should do)
- Python > 2.7 but < 3
- Git for Windows (for bash and gnu utils)

## usage

Using the awcw32ks-client should only be done under Git for Windows' bash shell. WSL and MinGW may work but are untested and mozillabuild's shell doesn't have access to needed software, i.e. PowerShell.

There are two ways to use this project:

1. as a test stand to obtain win32k usage logs (standalone mode)
2. as a client for [arewecontentwin32kstill](https:://github.com/metalcanine/arewecontentwin32kstil) (client mode)

Running the client directly with `node src/app.js` is also a viable option, and more option flags are available such as `node src/app.js -h`. This is preferable to `npm start` as it avoids npm's process startup overhead.

Create a `.env` file in the base repo directory with `cp .env.sample .env`. Different variables are suggested for running in client and standalone mode but it's important to keep in mind that any environment variables defined here are not only used by Node.js but also eventually utilized by WinDbg, python, mach, mozharness, and Firefox.

### standalone

It is recommended to set any prefs required for your builds before start up. There is an `user.js` file in the `src` directory with recommended prefs already set that will be copied into the object directory before startup for standalone mode.

`npm install --production` will get you just the npm packages needed for running.

`npm run start:s` will start the browser normally under WinDbg and the resulting log will be in `logs/stand/`.

### client

While standalone mode has a way to set prefs up locally client mode relies on prefs set in try pushes.

`npm run start:c` will start in client mode and listen for jobs from the web server.

Once it finds a job the logs, mozharness, and debugging symbols will be under the `logs/client/` folder under in a folder named after the corresponding task.

## environment

| Variable                      | Example Value                                                                             | Explanation                                  |
| ----------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------- |
| LOCAL_FIREFOX_REPO            | c:/Users/june/Source/mozilla-central                                                      | location on disk of mozilla-central repo     |
| LOCAL_FIREFOX_OBJDIR          | c:/Users/jewilde/Source/mozilla-central/obj-x86_64-pc-mingw32                             | location on disk of your Firefox build       |
| SERVER_ADDRESS                | http://www.arewecontentwin32kstill.com/                                                   | ip address or base url for awcw32ks server   |
| CLIENT_POLLING_INTERVAL       | 1000                                                                                      | interval in ms at which to poll for new jobs |
| _NT_SYMBOL_PATH               | SRV*c:\Users\jewilde\Source\awcw32ks-client\temp\symbols\*https://symbols.mozilla.org/try | URLs for downloading debug symbols           |
| MOZ_IGNORE_NSS_SHUTDOWN_LEAKS | 1                                                                                         | ignore shutdowns leaks in NSS                |
| MOZ_CRASHREPORTER_SHUTDOWN    | 0                                                                                         | suggest ignoring Crashreporter shutdown      |
| XPCOM_DEBUG_BREAK             | warn                                                                                      | action to take at xpcom interrupt            |

## misc

If you would like to generate nt call stubs you can run

`/c/Program\ Files\ \(x86\)/Microsoft\ Visual\ Studio/2017/Community/VC/Tools/MSVC/14.10.25017/bin/HostX64/x64/dumpbin.exe //EXPORTS /c/Windows/System32/{win32kfull.sys,gdi32full.dll,user32.dll,win32k.sys,win32kbase.sys,win32u.sys} | grep -E “Nt(User|Gdi|DC)” | awk ‘{print $4}’ | grep -v “^__win32kstub” | sort | uniq > calls.txt`

## prior art

Special thanks to Alex Gaynor and his work [here.](https://github.com/alex/win32k-stuff)
