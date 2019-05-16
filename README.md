<h1 align="center">
  <a href="https://www.arewecontentprocesswin32kyet.com">A(re)W(e)C(ontent)W(in)32KY(et)-Client</a>
</h1>

## about

A whole lot of complexity neatly wrapped up into a few javascript files running across a few separate javascript runtimes.

Interacts with a [log server](https://www.github.com/metalcanine/arewecontentwin32kyet) to run specified tests in the Firefox test suite based on try pushes. This will help the Platform Security team isolate and remove Win32K system calls in content processes and remote them with the ultimate goal of turning on Windows' Win32K deny policy.

## setup

This is mostly the same as setting up a Windows machine to build Firefox, so if you already have that working all you should need is the `Windows SDK 10.0.18362.0` (for WinDbg). For best results, run inside of mozillabuild's shell.

## usage

There are two ways to use this project, as a
  1. test stand to obtain win32k usage logs
  2. client for [arewecontentwin32kyet](https:://github.com/metalcanine/arewecontentwin32kyet)

### standalone

Create a `.env` file in the base repo directory with `cp .env.sample .env`. The main piece of info that you'll need to fill out is the LOCAL_FIREFOX_REPO variable which should be the full path to your copy of mozilla-central. Any environment variables defined here will also be passed on to Firefox at runtime.

You will also need to set any prefs required for your patches before start up, as this usage mode does not automatically set prefs like the client mode does.

`npm run start:s` to start the browser normally under WinDbg. The resulting log will be in `logs/stand/`.

### client

`npm run start:c` will start in client mode and listen for jobs from the web server.

## environment

| Variable                      | Example Value                        | Explanation                                    |
| ----------------------------- | ------------------------------------ | ---------------------------------------------- |
| LOCAL_FIREFOX_REPO            | c:/Users/june/Source/mozilla-central | location on disk of mozilla-central repo       |
| MOZ_IGNORE_NSS_SHUTDOWN_LEAKS | true                                 | ignore shutdowns leaks in NSS                  |

## misc

If you would like to generate nt call stubs you can run

```/c/Program\ Files\ \(x86\)/Microsoft\ Visual\ Studio/2017/Community/VC/Tools/MSVC/14.10.25017/bin/HostX64/x64/dumpbin.exe //EXPORTS /c/Windows/System32/{win32kfull.sys,gdi32full.dll,user32.dll,win32k.sys,win32kbase.sys,win32u.sys} | grep -E “Nt(User|Gdi|DC)” | awk ‘{print $4}’ | grep -v “^__win32kstub” | sort | uniq > calls.txt```

## prior art

Special thanks to Alex Gaynor and his work [here.](https://github.com/alex/win32k-stuff)
