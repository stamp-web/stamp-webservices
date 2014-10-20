var mysql = require('mysql');
var q = require('q');
var fs = require('fs');
var Logger = require('../util/logger');
var nconf = require('nconf');
var path = require('path');
var _ = require('../../lib/underscore/underscore');

nconf.argv().env().file(__dirname + '/../../config/application.json');

var logger = Logger.getLogger("connection");

module.exports = function () {
    "use strict";

    var dbPool;
    var config;
    var dbName;
    
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
            logger.log(Logger.ERROR, "A connection to the database could not be established.  The message was:\n\n   " + msg + "\n");
        }
    }
    
    function determineDBPassword(config) {
        var defer = q.defer();
        if (config.password && config.password.length > 0) {
            defer.resolve();
        } else {
            config.password = nconf.get("db_password");
            if (config.password && config.password.length > 0) {
                defer.resolve();
            }
            else {
                var pw = require('pw');
                process.stdout.write('\nConfiguration did not contain a database password.\nEnter database password: ');
                pw(function (value) {
                    config.password = value;
                    defer.resolve();
                });
            }
        }
        return defer.promise;
    }
    
    function enableKeepAlive() {
        var Pool = require('mysql/lib/Pool');
        Pool.prototype.startKeepAlive = function () {
            var pool = this;
            this.config.keepalive = 30000;
            setInterval(function () {
                logger.log(Logger.DEBUG, "Keep alive fired for " + pool._freeConnections.length + " connections");
                pool._freeConnections.forEach(function (connection) {
                    connection.ping(function (err) {
                        if (err) {
                            connection.destroy();
                            pool._removeConnection(connection);
                        }
                    });
                });
            }, this.config.keepalive);
        };

    }
    
    function createPool() {
        var defer = q.defer();
        if (config) {
            determineDBPassword(config).then(function () {
                enableKeepAlive();
                dbPool = mysql.createPool({
                    connectionLimit: 20,
                    host: config.host,
                    user: config.user,
                    password: config.password,
                    database: config.schema
                });
                dbPool.startKeepAlive();
                logger.log(Logger.INFO, "MySQL database pool created for database named \'" + dbName + "\'");
                dbPool.getConnection(function (err, connection) {
                    if (!err) {
                        connection.release();
                        defer.resolve(dbPool);
                    } else {
                        defer.reject(err);
                    }
                });
            });
        } else {
            var msg = "The database " + dbName + " was not found in the configuration.";
            logger.log(Logger.ERROR, msg);
            defer.reject(msg);
        }
        return defer.promise;
    }
    
    function getPool() {
        var defer = q.defer();
        if (dbPool) {
            defer.resolve(dbPool);
        } else {
            createPool().then(function (pool) {
                defer.resolve(pool);
            }, function (err) {
                defer.reject(err);
            });
        }
        return defer.promise;
    }
    
    return {
        
        startup: function () {
            var startDefer = q.defer();
            if (!dbPool) {
                dbName = nconf.get("database");
                if (!dbName) {
                    startDefer.reject("No database was selected.");
                }
                config = nconf.get("databases")[dbName];
                getPool().then(function () {
                    startDefer.resolve();
                }, function (err) {
                    startDefer.reject(err);
                });
            }
            return startDefer.promise;
        },
        shutdown: function () {
            if (dbPool !== null) {
                dbPool.end();
            }
            dbPool = null;
        },
        release: function (connection) {
            connection.release();
        },
        getConnection: function () {
            var defer = q.defer();
            var that = this;
            getPool().then(function (pool) {
                pool.getConnection(function (err, connection) {
                    if (!err) {
                        var del = connection._protocol._delegateError;
                        connection._protocol._delegateError = function (err, sequence) {
                            if (err.fatal) {
                                logger.log(Logger.TRACE, 'fatal error: ' + err.message);
                            }
                            return del.call(this, err, sequence);
                        };
                        defer.resolve(connection);
                    } else {
                        handleConnectionError(err);
                        defer.reject(err);
                    }
                });
            }, function (err) {
            });
            return defer.promise;
        }
    };
}();