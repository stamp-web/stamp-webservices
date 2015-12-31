var _ = require('lodash');
var Logger = require('../../app/util/logger');
var Level = require('../../app/util/level');
var child_process = require('child_process');
var path = require('path');
var nconf = require('nconf');
var fs = require('fs');
var mysql = require('mysql');

module.exports = function () {
    "use strict";
    var executed = false;
    var connection;
    var logger = Logger.getLogger("server");

    nconf.argv().env().file(__dirname + '/../../config/application.json');

    var database = (nconf.get("test_database") ? nconf.get("test_database") : "test");
    var sql_level = 'warn';
    if (nconf.get("sql_level")) {
        sql_level = nconf.get("sql_level");
    }

    var hostname = 'localhost';
    if (nconf.get("hostname")) {
        hostname = nconf.get("hostname");
    }
    var server_port = 9002;
    if (nconf.get("port")) {
        server_port = +nconf.get("port");
    }

    var ready_for_test = false;


    function loadFromFile(connection, fileContent, callback) {
        var lines = fileContent.match(/^.*((\r\n|\n|\r)|$)/gm);
        var count = lines.length;
        _.each(lines, function (line) {
            line = line.replace('\n', '').replace('\r', '');
            if (line.length < 2) {
                callback();
                return;
            }
            connection.query(line, function (err, rows) {
                if (err) {
                    console.log(err);
                    process.exit(1);
                }
                callback();
            });
        });
        return count;
    }

    function notifyStatementsComplete() {
        ready_for_test = true;
    }

    function forkProcess(callback) {
        var child = child_process.fork(__dirname + "/../../app/server/server", [], {
            cwd: "..",
            env: {
                database: database,
                basePath: "/",
                port: server_port,
                authentication: null,
                sql_level: sql_level,
                logger_target: "file",
                logger_file: __dirname + "/../../logs/output.log"
            }
        });

        child.on("message", function (m) {
            if (m && m === "SERVER_STARTED") {
                logger.info( "Received message that server is successfully started...");
                var f = function () {
                    setTimeout(function () {
                        if (ready_for_test) {
                            callback();
                        } else {
                            logger.info( "Server started but SQL statements are still executing...");
                            f();
                        }
                    }, 150);
                };
                f();
            }
        });
    }

    return {
        getHostname: function() {
            return hostname;
        },
        getPort: function() {
            return server_port;
        },
        getConnection: function() {
           if( !connection ) {
               var dbConfigs = nconf.get("databases");
               var dbConfig = dbConfigs[database];

               connection = mysql.createConnection({
                   host: dbConfig.host,
                   user: dbConfig.user,
                   password: dbConfig.password,
                   database: dbConfig.schema
               });
           }
           return connection;
        },
        initialize: function(callback) {
            if( !executed ) {
                logger.setLevel(Level.INFO);
                logger.setTarget("file", __dirname + "/../../logs/output.log").then( function() {
                    logger.info( "Reading SQL contents...");
                });

                var file = ((process.cwd().indexOf('\\test') > 0) ? '../' : '') + 'test/dbscript/initial-data.sql';
                var contents = fs.readFileSync(file, { encoding: 'utf-8' }).toString();

                var count = 0;
                var totalCount = loadFromFile(this.getConnection(), contents, function () {
                    count++;
                    if( count === totalCount ) {
                        notifyStatementsComplete();
                    }
                });
                forkProcess(callback);
                executed = true;
            } else {
                logger.info("SQL statements already bootstrapped");
                callback();
            }
        },
        cleanup: function(callback) {
            connection.end();
            connection = null;
            callback();
        }

    };
}();