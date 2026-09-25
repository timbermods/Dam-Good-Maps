const childProcess = require('node:child_process');
const { syncBuiltinESMExports } = require('node:module');
const originalExec = childProcess.exec;
childProcess.exec = function (command, ...args) {
  if (command === 'net use') {
    const callback = args.find((value) => typeof value === 'function');
    if (callback) process.nextTick(() => callback(null, '', ''));
    return null;
  }
  return Reflect.apply(originalExec, this, [command, ...args]);
};
syncBuiltinESMExports();
