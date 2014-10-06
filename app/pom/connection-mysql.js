﻿var mysql = require('mysql');
var q = require('q');
var fs = require('fs');
var logger = require('../util/logger');
var nconf = require('nconf');
var path = require('path');
var _ = require('../../lib/underscore/underscore');

nconf.argv().env().file(__dirname + '/../../config/database.json');

module.exports = function () {
    var dbPool;
    var connectionMap = {};
    var ConnectionCodes = {
        ACCESS_DENIED: 'ER_ACCESS_DENIED_ERROR',
        DBACCESS_DENIED_ERROR: 'ER_DBACCESS_DENIED_ERROR',
        NOT_FOUND: 'ENOTFOUND',
        ETIMEDOUT: 'ETIMEDOUT'
    };
    
    function handleConnectionError(err) {
        if (err.code) {
            var msg = "Access error is unknown:" + err.message;
            switch (err.code) { 
                case ConnectionCodes.ACCESS_DENIED:
                case ConnectionCodes.DBACCESS_DENIED_ERROR:
                case ConnectionCodes.ETIMEDOUT:
                    msg = err.message.substring(err.code.length + 1);
                    break;
                case ConnectionCodes.NOT_FOUND:
                    var host = "unknown";
                    if (dbPool && dbPool.config && dbPool.config.connectionConfig) {
                        host = dbPool.config.connectionConfig.host;
                    }
                    msg = "The database on host \"" + host + "\" was not reachable";
                    break;
            }
            logger.log(logger.ERROR, "A connection to the database could not be established.  The message was:\n\n   " + msg + "\n");
        }
    }
    
    function findReaperThreads(key, id) {
        var pending = false;
        if (id > 0) {
            for (var i = 0; i < dbPool._freeConnections.length; i++) {
                if (dbPool._freeConnections[i].threadId === id) {
                    pending = true;
                    break;
                }
            }
        }
        return pending;
    }
        
    return {
        
        startup: function () {
            
            if (!dbPool) {
                var dbName = nconf.get("database");
                if (!dbName) {
                    throw new Error("No database was specified.");
                }
                var config = nconf.get("databases")[dbName];
                if (config) {
                    dbPool = mysql.createPool({
                        connectionLimit: 20,
                        host: config.host,
                        user: config.user,
                        password: config.password,
                        database: config.schema
                    });
                    logger.log(logger.INFO, "MySQL database pool created");
                }
                else {
                    var msg = "The database " + dbName + " was not found in the configuration.";
                    logger.log(logger.ERROR, msg);
                    throw new Error(msg);
                }
            }
        },
        shutdown: function () {
            dbPool.end();
        },
        release: function (connection) {
            var id = (connection)? connection.threadId : -1;
            if (id > 0) {
                var released = false;
                for (var i = 0; i < dbPool._freeConnections.length; i++) {
                    if (dbPool._freeConnections[i].threadId === id) {
                        released = true;
                        break;
                    }
                }
                if (!released) {
                    connection.release();
                }
            } else {
                logger.log(logger.WARN, "Detected a connection without a threadId");
                connection.release();
            }
        },
        getConnection: function (key) {
            var defer = q.defer();
            var curConnection = connectionMap[key];
            var pending = findReaperThreads(key, (curConnection)? curConnection.threadId : -1);
            if (pending) {
                delete connectionMap[key];   
            }
            if (connectionMap[key] !== undefined) {
                logger.log(logger.DEBUG, "Re-using current connection for " + key + ": " + curConnection.threadId);
                defer.resolve(connectionMap[key]);
            } else {
                dbPool.getConnection(function (err, connection) {
                    if (!err) {
                        logger.log(logger.DEBUG, "Creating a new connection for " + key + ": " + connection.threadId);
                        connectionMap[key] = connection;
                        defer.resolve(connection);
                    } else {
                        handleConnectionError(err);
                        defer.reject(err);
                    }
                });
            }
            return defer.promise;
        }
    };
}();