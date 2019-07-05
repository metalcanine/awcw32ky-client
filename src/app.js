#!/usr/bin/env node

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const program = require('commander');
const request = require('request-promise');

// commander setup
program
  .version(process.env.npm_package_version)
  .option('-s, standalone', 'start firefox under windbg')
  .option('-c, client', 'start client package for running awcw32ks jobs')
  .option('-r, reduce <log_file>', 'parse a log file into a reduced version')
  .option('-u, upload <log_file> <job>', 'upload a log to the report site')
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

const generateDebugScript = (name, folder) => {
  return `
    * Run things during JIT function tracing who cares
    .settings set EngineInitialization.VerifyFunctionTableCallbacks=false
    * Set up logging to a file
    .logappend ${process.cwd()}\\logs\\${folder}\\${Date.now() + '-' + name}.log

    * We want to debug our children. Strictly speaking we don't even care about
    * debugging ourselves!
    .childdbg 1

    * Load up the JS provider
    .load jsprovider.dll

    * Set up an exception handler for initial breakpoint to set up tracing
    sxe -c ".scriptrun ${process
      .cwd()
      .replace(/\\/gi, '\\\\')}\\\\src\\\\win32k-tracing.js; g" ibp
    * Ignore all other exceptions
    sxe -c "gn" *
    * Extra ignore wow64 break
    sxi 4000001f
    * Ignore end process
    sxi epr

    * And we're off!
    gc
  `.replace(/^\s\s*/gm, '');
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
  // windbg commands to be executed
  let windbg_init_script = generateDebugScript(makeId(12), 'stand');

  // write debug script out to file to sidestep having to
  fs.writeFileSync('temp/dbg-script.txt', windbg_init_script, 'utf8');

  if (
    !process.env.LOCAL_FIREFOX_REPO ||
    !fs.existsSync(process.env.LOCAL_FIREFOX_REPO)
  ) {
    console.error(
      `Firefox repo location is either not in .env or can't be found.`
    );
    return false;
  }

  if (
    !process.env.LOCAL_FIREFOX_OBJDIR ||
    !fs.existsSync(process.env.LOCAL_FIREFOX_OBJDIR)
  ) {
    console.error(
      `Firefox build directory is either not in .env or can't be found`
    );
  }

  fs.copyFile(
    path.join(process.cwd(), 'src/user.js'),
    path.join(process.env.LOCAL_FIREFOX_OBJDIR, 'tmp/profile-default/user.js'),
    (error) => {
      if (error) {
        throw err;
      } else {
        console.log('unable to copy user prefs files into build directory');
      }
    }
  );

  const mach_call =
    `python ` +
    path.join(process.env.LOCAL_FIREFOX_REPO, 'mach') +
    ` run` +
    ` --debugger="c:/Program Files (x86)/Windows Kits/10/Debuggers/x64/windbg.exe"` +
    ` --debugger-args="-c '\$\$<` +
    path.join(process.cwd(), 'temp/dbg-script.txt') +
    `'"`;

  console.log('starting firefox');

  execSync(mach_call, (error, stdout, stderr) => {
    if (error) {
      console.log(stderr);
    } else {
      console.log(stdout);
    }
  });
}
// -c --client option
else if (program.client) {
  let currentJob;

  setInterval(() => {
    console.log('listening for new jobs');
    let windbg_init_script;
    request({
      uri: `${process.env.SERVER_ADDRESS}api/jobs/pending`,
      json: true,
    })
      .then((response) => {
        if (response.length === 0) {
          return console.log('no new jobs!');
        }

        return request({
          method: 'PUT',
          uri: `${process.env.SERVER_ADDRESS}api/jobs/${response[0].id}`,
          body: {
            revision: response[0].revision,
            author: response[0].author,
            mozharness: response[0].mozharness,
            commands: response[0].commands,
            task: response[0].task,
            job_status: 'pending',
            build_flags: response[0].build_flags,
          },
          json: true,
        });
      })
      .then((job) => {
        if (job === undefined) {
          return;
        }

        currentJob = job;
        generateDebugScript(currentJob.task, 'client');

        let envAdditions = JSON.parse(currentJob.mozharness);

        // add all mozharness configs to env
        Object.keys(envAdditions).forEach((key) => {
          process.env[key] = envAdditions[key];
        });

        if (!fs.existsSync(`logs/client/${currentJob.task}`)) {
          fs.mkdirSync(`logs/client/${currentJob.task}`);
        }

        // download mozharness, unzip it, and run it!
        return execSync(
          `curl -0 https://taskcluster-artifacts.net/${
            currentJob.build
          }/0/public/build/mozharness.zip > logs/client/${
            currentJob.task
          }/mozharness.zip && unzip -qq -o logs/client/${
            currentJob.task
          }/mozharness.zip -d logs/client/${currentJob.task}/`,
          { maxBuffer: 4096 * 1024 },
          (error, stdout, stderr) => {
            if (error) {
              console.error(`exec error: ${error}`);
              return;
            }
            console.log(`stdout: ${stdout}`); // TODO: handle standard output from this
            console.log(`stderr: ${stderr}`);
          }
        );
      })
      .then((response) => {
        if (!response) {
          return;
        }

        return execSync(
          `cd logs/client/${
            currentJob.task
          } && "c:/Program Files (x86)/Windows Kits/10/Debuggers/x64/windbg.exe -c '\$\$<` +
            path.join(process.cwd(), 'temp/dbg-script.txt') +
            `'"` +
            ` ${currentJob.commands}`,
          { maxBuffer: 4096 * 1024 }, // give node execSync 4gbs to hold stdout
          (error, stdout, stderr) => {
            if (error) {
              console.error(`exec error: ${error}`);
              return;
            }
            return stdout;
          }
        );
      })
      .then((stdout) => {
        if (!stdout) {
          return;
        }

        // pull stacks from stdout and upload them
        return processWin32KTraces(stdout).forEach((stack) => {
          request({
            method: 'POST',
            uri: `${process.env.SERVER_ADDRESS}api/jobs/${response.id}/stacks`,
            body: {
              frequency: stack.frequency,
              nt_call: stack.frames[0],
              short_frames: JSON.stringify(stack.frames),
              long_frames: ' ',
            },
            json: true,
          })
            .then((response) => {
              console.log(`stack ${response.id} created`);
            })
            .catch((error) => {
              console.log(error);
            });
        });
      })
      .then((response) => {
        if (response === undefined) {
          return;
        }

        return request({
          method: 'PUT',
          uri: `${process.env.SERVER_ADDRESS}api/jobs/${currentJob.id}`,
          body: {
            revision: currentJob.revision,
            author: currentJob.author,
            mozharness: currentJob.mozharness,
            commands: currentJob.commands,
            task: currentJob.task,
            job_status: 'complete',
            build_flags: currentJob.build_flags,
          },
          json: true,
        }).then((currentJob) => {
          console.log(`successfully generated log for ${currentJob.id}`);
        });
      })
      .catch((error) => {
        console.error(error.message);
      });
  }, process.env.CLIENT_POLLING_INTERVAL || 9000);
}
// -r --reduce option
else if (program.reduce) {
  if (!fs.existsSync(program.reduce)) {
    console.error(`could not find ${program.reduce}`);
  } else {
    fs.writeFileSync(
      program.reduce.split('.')[0] + 'condensed.log',
      JSON.stringify(
        processWin32KTraces(fs.readFileSync(program.reduce, 'utf8'))
      ),
      'utf8'
    );
    return true;
  }
}
// -u --upload option
else if (program.upload) {
  if (!fs.existsSync(program.upload)) {
    console.error(`could not find ${program.upload}`);
  } else {
    return processWin32KTraces(fs.readFileSync(program.upload, 'utf8')).forEach(
      (stack) => {
        request({
          method: 'POST',
          uri: `${process.env.SERVER_ADDRESS}api/jobs/${
            program.args[0]
          }/stacks`,
          body: {
            frequency: stack.frequency,
            nt_call: stack.frames[0],
            short_frames: JSON.stringify(stack.frames),
            long_frames: ' ',
          },
          json: true,
        })
          .then((response) => {
            console.log(`stack ${response.id} created`);
          })
          .catch((error) => {
            console.log(error);
          });
      }
    );
  }
}
// default to help if no option given
else {
  return program.help();
}
