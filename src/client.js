#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

// globals
const STACK_TRACE_HEADER = "'===WIN32K-START==='";
const STACK_TRACE_FOOTER = "'===WIN32K-END==='";
const windbg_init_script = `
* Set up logging to a file
.logappend C:\Users\june\Source\awcw32ky-client\win32k-log.txt;

* We want to debug our children. Strictly speaking we don't even care about
* debugging ourselves!
.childdbg 1;

* Load up the JS provider
.load jsprovider.dll;

* Set up an exception handler for initial breakpoint to set up tracing
sxe -c ".scriptrun C:\\\\Users\\\\june\\\\Source\\\\awcw32ky-client\\\\win32k-tracing.js; g" ibp;
* Ignore all other exceptions (TODO: should this be 'sxd *'?)
sxe -c "g" *;
* Ignore end process
sxd epr;

* And we're off!
gc;
`;

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

const processWin32KTraces = () => {};

// @click.command()
// @click.argument("path")
// @click.option("--xul-frames", default=None, type=click.INT)
// @click.option("--stacks", default=None, type=click.INT)
// @click.option("--select", default=None, multiple=True)
// @click.option("--exclude", default=None, multiple=True)
const main = (file_path, xul_frames, stacks, select, exclude) => {
  let log_contents = fs
    .readFileSync(file_path)
    .toString()
    .split("\n")
    .map(line => line.trim());

  let idx = -1;
  let sections = [];

  while (true) {
    try {
      let start_idx;
      let end_idx;
    } catch (error) {
      break;
    }

    let success = true;
    try {
      //             start_idx = lines.index(STACK_TRACE_HEADER, idx + 1)
      start_idx = log_contents.find((element) => {element === STACK_TRACE_HEADER});
      //             end_idx = lines.index(STACK_TRACE_FOOTER, start_idx + 1)
    } catch (error) {
      success = false;
      break;
    }
    if (success) {
      sections += lines[]
      //             sections.append(lines[start_idx:end_idx])
      //             idx = end_idx
    }
  }

  // c = collections.Counter()
  let c = 0;

  for (section in sections) {
    //         if select and not any(any(f in s for f in select) for s in section):
    //             continue
    //         if exclude and any(any(e in s for e in exclude) for s in section):
    //             continue
    //         c[tuple(extract_frames(section, xul_frames))] += 1
  }

  stacks.forEach((stack, count) => {
    console.log(`${count} - ${stack[0]}`);
    for (line in stack) {
      console.log(`\n`.join("    ", line));
    }
    console.log();
    console.log();
  });
};

module.exports = {
  convertLogToJSON,
  findAndProcessLogs,
  extractFrames,
  processWin32KTraces,
  main
};
