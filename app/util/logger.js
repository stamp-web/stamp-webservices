"use strict";
const fs = require('fs');
const FileStreamRotator = require('file-stream-rotator');
const Level = require('./level');

function Logger(loggerName) {
    // eslint-disable-next-line no-unused-vars
    let name = loggerName;
    let debugLevel = Level.INFO;
    let target = "console";
    // eslint-disable-next-line no-unused-vars
    let targetPath;

    let CONSOLE_LOGGING = Level.levels.indexOf(Level.INFO); // 2

    let accessLogStream = FileStreamRotator.getStream({
        date_format: 'YYYYMMDD',
        filename: __dirname + '/../../logs/' + loggerName + '-%DATE%.log',
        frequency: 'daily',
        verbose: false
    });

    this.log = function(level, message) {
        if (this.isEnabled(level)) {
            if (typeof message !== 'string') {
                message = JSON.stringify(message);
            }
            const msg = `${level.toUpperCase()}: ${message}`;
            accessLogStream.write( msg + '\n');
            const ordinal = Level.levels.indexOf(level);
            if( !Logger.silentLogging && (ordinal <= CONSOLE_LOGGING || ordinal === 5)) {
                console.log(message);
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
        return new Promise(resolve => {
            target = type;
            targetPath = item;
            if( target === 'file') {
                let path = item;
                if( item.endsWith('.log')) {
                    path = item.substring(0, item.lastIndexOf('/'));
                }
                fs.access( path, fs.R_OK | fs.W_OK,  (err) => {
                    if( err !== null ) {
                        fs.mkdir(path, () => {
                            resolve();
                        });
                    } else {
                        resolve();
                    }
                });
            } else {
                resolve();
            }
        });
    };

    this.isEnabled = function (level) {
        return (Level.levels.indexOf(level) <= Level.levels.indexOf(debugLevel));
    };

}

Logger.loggers = {};
Logger.silentLogging = false;

Logger.getLogger = function(loggerName) {
    if (!Logger.loggers[loggerName]) {
        Logger.loggers[loggerName] = new Logger(loggerName);
    }
    return Logger.loggers[loggerName];
};

Logger.getRegisteredLoggerNames = function () {
    return Object.keys(Logger.loggers);
};

Logger.silenceConsole = () => {
    Logger.silentLogging = true;
}

module.exports = Logger;
