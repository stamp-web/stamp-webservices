"use strict";
var fs = require('fs');

function Logger(loggerName) {
    var name = loggerName;
    var debugLevel = Logger.INFO;
    var target = "console";
    var targetPath;
  
    this.log = function(level, message) {
        if (this.isEnabled(level)) {
            if (typeof message !== 'string') {
                message = JSON.stringify(message);
            }
            var msg = level.toUpperCase() + ': ' + message;
            if (target === "file" && targetPath) {
                fs.appendFileSync(targetPath, msg + '\n');
            } else {
                console.log(msg);
            }
        }
    };
    
    this.setLevel = function (level) {
        debugLevel = level; 
    };
    
    this.getLevel = function () {
        return debugLevel;   
    };
    
    this.setTarget = function (type, item) {
        target = type;
        targetPath = item;
    };

    this.isEnabled = function (level) {
        return (Logger.levels.indexOf(level) <= Logger.levels.indexOf(debugLevel));
    };

}

Logger.levels = ['error', 'warn', 'info', 'debug', 'trace', 'all'];
Logger.ERROR = Logger.levels[0];
Logger.WARN = Logger.levels[1];
Logger.INFO = Logger.levels[2];
Logger.DEBUG = Logger.levels[3];
Logger.TRACE = Logger.levels[4];
Logger.ALL = Logger.levels[5];

Logger.loggers = {};

Logger.getLogger = function(loggerName) {
    if (!Logger.loggers[loggerName]) {
        Logger.loggers[loggerName] = new Logger(loggerName);
    }
    return Logger.loggers[loggerName];
};

Logger.getRegisteredLoggerNames = function () {
    return Object.keys(Logger.loggers);
};


module.exports = Logger;
