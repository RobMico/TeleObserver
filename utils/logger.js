var winston = require('winston');
const { dirname } = require('path');
const appRoot = dirname(require.main.filename);
const util = require("util");

//Console print filters
const filters = {
  level: [],
  modules: []
}


//formatting message to logging in console
const myConsoleFormat = winston.format.printf(function (info) {
  if(info[Symbol.for('splat')])
  {
    return `${info.level};${info.message};\n vars: ${info[Symbol.for('splat')]}`;
  }
  else{
    return `${info.level};${info.message};`;
  }
});

//unfortunately it is not working in one functinon with 'myConsoleFormat'
const logFilter = winston.format(function (info) {
  if (filters.level.length != 0) {
    if (!filters.level.includes(info.level)) {
      return false;
    }
  }
  if (filters.modules.length != 0 && info[0]) {
    if (!filters.modules.includes(info[0])) {
      return false;
    }
  }
  return info;
});

//setup for logger
var options = {
  file: {
    level: 'info',
    name: 'file.info',
    filename: `${appRoot}/logs/app.log`,
    json: true,
    maxsize: 5242880, // 5MB
    maxFiles: 100,
    timestamp: true
  },
  errorFile: {
    level: 'error',
    name: 'file.error',
    filename: `${appRoot}/logs/error.log`,
    json: true,
    maxsize: 5242880, // 5MB
    maxFiles: 100,
    timestamp: true
  },
  console: {
    level: 'debug',
    format:
      (process.env.NODE_ENV == 'dev' ?
        winston.format.combine(logFilter(), winston.format.colorize(), myConsoleFormat)
        :
        winston.format.combine(winston.format.colorize(), myConsoleFormat))
  },
};

let logger = winston.createLogger({
  transports: [
    new (winston.transports.Console)(options.console),
    new (winston.transports.File)(options.errorFile),
    new (winston.transports.File)(options.file)
  ],
  exitOnError: false
});


module.exports = logger;
