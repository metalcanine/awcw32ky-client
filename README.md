<h1 align="center">
  <a href="https://www.arewecontentprocesswin32kyet.com">A(re)W(e)C(ontent)W(in)32KY(et)-Client</a>
</h1>

## about

A whole lot of complexity neatly wrapped up into a few javascript files running across a few separate javascript runtimes.

Interacts with a [log server](https://www.github.com/metalcanine/arewecontentwin32kyet) to run specified tests in the Firefox test suite based on try pushes. This will help the Platform Security team isolate and remove Win32K system calls in content processes and remote them with the ultimate goal of turning on Windows' Win32K deny policy.

## setup

The setup for this project is mostly the same as setting up a Windows machine to build Firefox.

The prerequisite software are:
* mozillabuild
* Visual Studio 2017 (at least Community Edition)
* Git for Windows
* WinDbg (WinDbgX Preview hasn't been tested but should mostly work)
* NodeJS
* Python
