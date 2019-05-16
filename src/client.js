#!/usr/bin/env node

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const program = require("commander");

// commander setup
program.version(process.env.npm_package_version)
  .option('-s, standalone', 'start firefox under windbg')
  .option('-c, client', 'start client package for running awcw32ky jobs')
  .parse(process.argv);

// generate a slightly random alphanumeric id
const makeId = (length) => {
  return 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    .split('')
    .sort(() => { return 0.5 - Math.random(); })
    .slice(0, length)
    .join('');
}

const convertLogToJSON = data => {
  let log = [];
  let stack = [];

  // convert text lines into stack arrays breaking on empty lines
  data.split("\n").forEach(line => {
    line = line.trim();

    // if line isn't empty add it to our stack
    if (line !== "") {
      // clean up whitespace and memory addresses as well
      stack.push(line.split("+")[0]);
    }
    // if line is empty and stack is not empty push it into log array
    else if (line === "" && stack.length > 0) {
      log.push(stack);
      stack = [];
    }
  });

  // convert array of stacks into array of objects with frequency and frames
  return JSON.stringify(
    log.map(arr => {
      let frequency = parseInt(arr.splice(0, 1));

      return { frequency: frequency, frames: arr };
    })
  );
};

const findAndProcessLogs = () => {
  fs.readdirSync(path.join(process.cwd(), "/logs/win32k/")).forEach(file => {
    fs.writeFileSync(
      path.join(process.cwd(), "/logs/win32k/", file.split(".")[0] + ".json"),
      convertLogToJSON(
        fs.readFileSync(path.join(process.cwd(), "/logs/win32k/", file), "utf8")
      ),
      "utf8"
    );
  });
};

const extractFrames = (stack, xul_frames) => {
  // Skip the first two lines, which aren't frames at all.
  let idx = 2;

  // Set to true once we see our first `xul` frame.
  let xul_found = false;
  let frames = [];

  while ((xul_frames === [] || xul_frames.length > 0) && idx < stack.length) {
    let line = stack[idx].split();

    ++idx;

    if (line[1] === "(Inline" && line[3] === "Function)") {
      frames += line[4];
    } else {
      frames += line[3];
    }

    if (frames[-1].startsWith("xul!")) {
      xul_found = true;
    }
    if (xul_found && xul_frames != undefined) {
      xul_frames -= 1;
    }
  }

  return frames;
};

const processWin32KTraces = (file_path, xul_frames, stacks) => {
  // log stack trace bookends
  const STACK_TRACE_HEADER = "'===WIN32K-START==='";
  const STACK_TRACE_FOOTER = "'===WIN32K-END==='";

  let log_contents = fs
    .readFileSync(file_path)
    .toString()
    .split("\n")
    .map(line => line.trim());

  let idx = -1;
  let sections = [];

  while (true) {
    let start_idx;
    let end_idx;
    let success = true;

    start_idx = log_contents.findIndex((element) => { element === STACK_TRACE_HEADER });
    end_idx = log_contents.findIndex((element) => { element === STACK_TRACE_FOOTER });

    if (!start_idx && !end_idx) {
      success = false;
      break;
    }

    if (success) {
      sections += log_contents.slice(start_idx, end_idx);
      idx = end_idx;
    }
  }

  let c;

  for (section in sections) {
    // c[tuple(extract_frames(section, xul_frames))] += 1
  }

  c.forEach((stack, count) => {
    console.log(`${count} - ${stack[0]}`);
    for (line in stack) {
      console.log(`\n`.join("    ", line));
    }
    console.log();
    console.log();
  });

  return c;
};

// windbg commands to be executed
let windbg_init_script = `
* Set up logging to a file
.logappend ${process.cwd()}\\logs\\stand\\${Date.now() + makeId(12)}.log

* We want to debug our children. Strictly speaking we don't even care about
* debugging ourselves!
.childdbg 1

* Load up the JS provider
.load jsprovider.dll

* Set up an exception handler for initial breakpoint to set up tracing
sxe -c ".scriptrun ${process.cwd().replace(/\\/gi, "\\\\")}\\\\src\\\\win32k-tracing.js; g" ibp
* Ignore all other exceptions (TODO: should this be 'sxd *'?)
sxn -c "gn" \*
* Ignore end process
sxd epr

* And we're off!
gc
`;

// make sure that we have all of our folders
if (!fs.existsSync('logs/')) {
  fs.mkdirSync('logs/');
}
if (!fs.existsSync('logs/stand')) {
  fs.mkdirSync('logs/stand/');
}
if (!fs.existsSync('logs/client')) {
  fs.mkdirSync('logs/client');
}
if (!fs.existsSync('temp/')) {
  fs.mkdirSync('temp/');
}

// write debug script out to file to sidestep having to
fs.writeFileSync('temp/dbg-script.txt', windbg_init_script);

// const main = () => {
if (program.standalone) {
  if (process.env.LOCAL_FIREFOX_REPO && fs.existsSync(process.env.LOCAL_FIREFOX_REPO)) {
    const mach_call = `python ${path.join(process.env.LOCAL_FIREFOX_REPO, 'mach')} run` +
      ` --debugger=\"c:/Program Files (x86)/Windows Kits/10/Debuggers/x64/windbg.exe\"` +
      ` --debugger-args="-c '\$\$<${path.join(process.cwd(), 'temp/dbg-script.txt')}' "`;

    console.log('starting firefox');
    exec(mach_call, (error, stdout, stderr) => {
      if (error) {
        console.log(stderr);
        throw error;
      }
      else {
        console.log(stdout);
      }
    });
  }
  else {
    console.error(`Firefox repo location is either not in .env or can't be found.`);
  }
}
else if (program.client) {
  console.log('client');
}
else {
  program.help();
}

return true;
// }
