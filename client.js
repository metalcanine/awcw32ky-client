#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

// globals
let STACK_TRACE_HEADER = "'===WIN32K-START==='";
let STACK_TRACE_FOOTER = "'===WIN32K-END==='";

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

const extractFrames = stack => {
  // def extract_frames(stack, xul_frames):
  //   # Skip the first two lines, which aren't frames at all.
  //   idx = 2
  //   # Set to true once we see our first `xul` frame.
  //   xul_found = False
  //   frames = []
  //   while (xul_frames is None or xul_frames > 0) and idx < len(stack):
  //       line = stack[idx].split()
  //       idx += 1
  //       if line[1:3] == ['(Inline', 'Function)']:
  //           frames.append(line[4])
  //       else:
  //           frames.append(line[3])
  //       if frames[-1].startswith("xul!"):
  //           xul_found = True
  //       if xul_found and xul_frames is not None:
  //           xul_frames -= 1
  //   return frames
};

const processWin32KTraces = () => {};

const main = () => {
  // @click.command()
  // @click.argument("path")
  // @click.option("--xul-frames", default=None, type=click.INT)
  // @click.option("--stacks", default=None, type=click.INT)
  // @click.option("--select", default=None, multiple=True)
  // @click.option("--exclude", default=None, multiple=True)
  // def main(path, xul_frames, stacks, select, exclude):
  //     with open(path) as f:
  //         lines = [line.strip() for line in f]

  //     idx = -1
  //     sections = []
  //     while True:
  //         try:
  //             start_idx = lines.index(STACK_TRACE_HEADER, idx + 1)
  //             end_idx = lines.index(STACK_TRACE_FOOTER, start_idx + 1)
  //         except ValueError:
  //             break
  //         else:
  //             sections.append(lines[start_idx:end_idx])
  //             idx = end_idx

  //     c = collections.Counter()
  //     for section in sections:
  //         if select and not any(any(f in s for f in select) for s in section):
  //             continue
  //         if exclude and any(any(e in s for e in exclude) for s in section):
  //             continue
  //         c[tuple(extract_frames(section, xul_frames))] += 1

  //     for stack, count in c.most_common(stacks):
  //         print("{} - {}".format(count, stack[0]))
  //         print("\n".join("    " + s for s in stack))
  //         print()
  //         print()
};

module.exports = {
  convertLogToJSON,
  findAndProcessLogs,
  extractFrames,
  processWin32KTraces,
  main,
};
