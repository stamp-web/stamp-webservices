"use strict";
var fs = require('fs');
var Level = require('./level');
var q = require('q');

function Logger(loggerName) {
    var name = loggerName;
    var debugLevel = Level.INFO;
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

    this.debug = function(message) {
        this.log(Level.DEBUG, message);
    };

    this.error = function(message) {
        this.log(Level.ERROR, message);
    }

    this.warn = function(message) {
        this.log(Level.WARN, message);
    };

    this.info = function(message) {
        this.log(Level.INFO, message);
    };

    this.trace = function(message) {
        this.log(Level.TRACE, message);
    }
    
    this.setLevel = function (level) {
        debugLevel = level; 
    };
    
    this.getLevel = function () {
        return debugLevel;   
    };
    
    this.setTarget = function (type, item) {
        var defer = q.defer();
        target = type;
        targetPath = item;
        if( target === 'file') {
            var path = item;
            if( item.endsWith('.log')) {
                path = item.substring(0, item.lastIndexOf('/'));
            }
            fs.access( path, fs.R_OK | fs.W_OK, function (err) {
                if( err !== null ) {
                    fs.mkdir(path, function(err) {
                        defer.resolve();
                    });
                } else {
                    defer.resolve();
                }
            });
        } else {
            defer.resolve();
        }
        return defer.promise;
    };

    this.isEnabled = function (level) {
        return (Level.levels.indexOf(level) <= Level.levels.indexOf(debugLevel));
    };

}

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
