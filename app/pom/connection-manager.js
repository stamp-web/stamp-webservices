var mysql = require('mysql');
var q = require('q');
var fs = require('fs');
var logger = require('../util/logger');
var nconf = require('nconf');
var path = require('path');


nconf.argv().env().file(__dirname + '/../../config/database.json');

module.exports = function () {
    var dbConnection;
    var curConnection;
    var ConnectionCodes = {
        ACCESS_DENIED: 'ER_ACCESS_DENIED_ERROR',
        DBACCESS_DENIED_ERROR: 'ER_DBACCESS_DENIED_ERROR',
        NOT_FOUND: 'ENOTFOUND',
        ETIMEDOUT: 'ETIMEDOUT'
    };
    
    return {
        handleConnectionError: function (err) {
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
                        if (dbConnection && dbConnection.config && dbConnection.config.connectionConfig) {
                            host = dbConnection.config.connectionConfig.host;
                        }
                        msg = "The database on host \"" + host + "\" was not reachable";
                        break;
                }
                logger.log(logger.ERROR, "A connection to the database could not be established.  The message was:\n\n   " + msg + "\n");
            }
        },
        startup: function () {
            
            if (!dbConnection) {
                var dbName = nconf.get("database");
                if (!dbName) {
                    throw new Error("No database was specified.");
                }
                var config = nconf.get("databases")[dbName];
                if (config) {
                    dbConnection = mysql.createPool({
                        connectionLimit: 20,
                        host: config.host,
                        user: config.user,
                        password: config.password,
                        database: config.schema
                    });
                    logger.log(logger.INFO, "pool created");
                }
                else {
                    var msg = "The database " + dbName + " was not found in the configuration.";
                    logger.log(logger.ERROR, msg);
                    throw new Error(msg);
                }
            }
        },
        release: function (connection) {
            var id = (connection)? connection.threadId : -1;
            if (id > 0) {
                var released = false;
                for (var i = 0; i < dbConnection._freeConnections.length; i++) {
                    if (dbConnection._freeConnections[i].threadId === id) {
                        released = true;
                        break;
                    }
                }
                if (!released) {
                    connection.release();
                }
            }
        },
        getConnection: function () {
            var defer = q.defer();
            var id = (curConnection)? curConnection.threadId : -1;
            if (id > 0) {
                for (var i = 0; i < dbConnection._freeConnections.length; i++) {
                    if (dbConnection._freeConnections[i].threadId === id) {
                        //console.log("clearing current connection...");
                        curConnection = undefined;
                        break;
                    }
                }
            }
            if (typeof curConnection !== "undefined") {
                //console.log(">>>> Re-using current connection: " + curConnection.threadId);
                defer.resolve(curConnection);
            } else {
                dbConnection.getConnection(function (err, connection) {
                    if (!err) {
                        //      console.log("got new connection: " + connection.threadId);
                        curConnection = connection;
                        defer.resolve(connection);
                    } else {
                        that.handleConnectionError(err);
                        defer.reject(err);
                    }
                });
            }
            return defer.promise;
        },
        getTransactionContext: function (connection) {
            var trx = transaction({
                connection : connection, 
                dynamicConnection: 32, 
                idleConnectionCutoffTime: 1000, 
                timeout: 600
            });
            return trx.chain();
        },
        shutdown: function () {

        }
    };
};