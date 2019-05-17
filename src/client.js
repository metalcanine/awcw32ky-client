#!/usr/bin/env node

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const program = require('commander');

// commander setup
program
  .version(process.env.npm_package_version)
  .option('-s, standalone', 'start firefox under windbg')
  .option('-c, client', 'start client package for running awcw32ky jobs')
  .option('-r, reduce <log_file>', 'parse a log file into a reduced version')
  .parse(process.argv);

// generate a slightly random alphanumeric id
const makeId = (length) => {
  return 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    .split('')
    .sort(() => {
      return 0.5 - Math.random();
    })
    .slice(0, length)
    .join('');
};

const hashString = (str) => {
  let hash = 0;

  for (let i = 0; i < str.length; i++) {
    hash = parseInt((hash << 5) - hash + str.charCodeAt(i));
  }

  return hash;
};

const processWin32KTraces = (traces) => {
  let processed_stacks = {};

  // split traces string on newlines and remove trailing whitespace
  traces = traces.split('\n').map((line) => line.trim());

  for (let i = 0; i < traces.length; ++i) {
    // loop until we find the start of the stack
    if (traces[i] === `'===WIN32K-START==='`) {
      let stack = { frequency: 1, frames: [] };
      // ignore first two lines of stack info
      i += 2;

      // loop until we hit the end of the stack
      while (i < traces.length) {
        if (traces[i] === `'===WIN32K-END==='`) {
          break;
        }
        // ignore empty lines and Firefox output lines
        else if (traces[i] !== '' && traces[i][0] !== '*') {
          // remove first 39 chars which are just adresses and source file paths
          stack.frames.push(
            traces[i]
              .substring(39)
              .split(' ')[0]
              .split('+0x')[0]
          );
        }
        ++i;
      }

      let hash = parseInt(hashString(stack.frames.toString()), 16);

      if (processed_stacks[hash]) {
        processed_stacks[hash].frequency += 1;
      } else {
        processed_stacks[hash] = stack;
      }
    }
  }

  return Object.keys(processed_stacks)
    .map((objectKey) => {
      return processed_stacks[objectKey];
    })
    .sort((a, b) => {
      return b.frequency - a.frequency;
    });
};

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

if (program.standalone) {
  const log_name = Date.now() + makeId(12);

  // windbg commands to be executed
  let windbg_init_script = `
    * Set up logging to a file
    .logappend ${process.cwd()}\\logs\\stand\\${log_name}.log

    * We want to debug our children. Strictly speaking we don't even care about
    * debugging ourselves!
    .childdbg 1

    * Load up the JS provider
    .load jsprovider.dll

    * Set up an exception handler for initial breakpoint to set up tracing
    sxe -c ".scriptrun ${process
      .cwd()
      .replace(/\\/gi, '\\\\')}\\\\src\\\\win32k-tracing.js; g" ibp
    * Ignore all other exceptions (TODO: should this be 'sxd *'?)
    sxn -c "gn" \*
    * Ignore end process
    sxd epr

    * And we're off!
    gc
  `.replace(/^\s\s*/gm, '');

  // write debug script out to file to sidestep having to
  fs.writeFileSync('temp/dbg-script.txt', windbg_init_script, 'utf8');

  if (
    process.env.LOCAL_FIREFOX_REPO &&
    fs.existsSync(process.env.LOCAL_FIREFOX_REPO)
  ) {
    const mach_call =
      `python ` +
      path.join(process.env.LOCAL_FIREFOX_REPO, 'mach') +
      ` run` +
      ` --debugger="c:/Program Files (x86)/Windows Kits/10/Debuggers/x64/windbg.exe"` +
      ` --debugger-args="-c '\$\$<` +
      path.join(process.cwd(), 'temp/dbg-script.txt') +
      `'"`;

    console.log('starting firefox');

    exec(mach_call, (error, stdout, stderr) => {
      if (error) {
        console.log(stderr);
      } else {
        console.log(stdout);
      }
    });
  } else {
    console.error(
      `Firefox repo location is either not in .env or can't be found.`
    );
    return false;
  }
}
// -c --client option
else if (program.client) {
  console.log('client');
  return true;
}
// -r --reduce option
else if (program.reduce) {
  if (!fs.existsSync(program.reduce)) {
    console.error(`could not find ${program.reduce}`);
  } else {
    fs.writeFileSync(
      program.reduce.split('.')[0] + 'condensed.log',
      JSON.stringify(processWin32KTraces(fs.readFileSync(program.reduce, 'utf8'))),
      'utf8'
    );
    return true;
  }
}
// default to help if no option given
else {
  return program.help();
}
