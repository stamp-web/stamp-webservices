const _ = require('lodash');
const Logger = require('../../app/util/logger');
const Level = require('../../app/util/level');
const child_process = require('child_process');
const nconf = require('nconf');
const fs = require('fs');
const mysql = require('mysql');

module.exports = function () {
    let executed = false;
    let connection;
    let childFork;
    const logger = Logger.getLogger('server');

    Logger.silenceConsole();

    nconf.argv().env().file(__dirname + '/../../config/application.json');

    const database = (nconf.get('test_database') ? nconf.get('test_database') : 'test');
    let sql_level = 'warn';
    if (nconf.get('sql_level')) {
        sql_level = nconf.get('sql_level');
    }

    let hostname = 'localhost';
    if (nconf.get('hostname')) {
        hostname = nconf.get('hostname');
    }
    let server_port = 9002;
    if (nconf.get('port')) {
        server_port = +nconf.get('port');
    }

    let ready_for_test = false;


    function loadFromFile(connection, fileContent, callback) {
        const lines = fileContent.match(/^.*((\r\n|\n|\r)|$)/gm);
        const count = lines.length;
        _.each(lines, function (line) {
            line = line.replace('\n', '').replace('\r', '');
            if (line.length < 2) {
                callback();
                return;
            }
            connection.query(line, (err) => {
                if (err) {
                    console.log(err);
                }
                callback(err);
            });
        });
        return count;
    }

    function notifyStatementsComplete() {
        ready_for_test = true;
    }

    function forkProcess(callback) {
        const child = child_process.fork(__dirname + '/../../app/server/server', [], {
            cwd: '..',
            env: {
                disableCache: true,
                database: database,
                basePath: '/',
                port: server_port,
                httpOnly: true,
                authentication: null,
                silenceConsole: true,
                sql_level: sql_level,
                logger_target: 'file',
                logger_file: __dirname + '/../../logs/output.log'
            }
        });

        child.on('message', m => {
            if (m && m === 'SERVER_STARTED') {
                logger.info( 'Received message that server is successfully started...');
                const f = () => {
                    _.delay(() => {
                        if (ready_for_test) {
                            callback();
                        } else {
                            logger.info('Server started but SQL statements are still executing...');
                            f();
                        }
                    }, 125);
                };
                f();
            }
        });
        child.on('error', err => {
            logger.error(err);
        });
        child.on('disconnect', () => {
           logger.info('process was disconnected');
        });
        return child;
    }

    return {
        totalCount: 0,
        getHostname: function() {
            return hostname;
        },
        getPort: function() {
            return server_port;
        },
        getConnection: function() {
           if( !connection ) {
               const dbConfigs = nconf.get('databases');
               const dbConfig = dbConfigs[database];

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
                logger.setTarget('file', __dirname + '/../../logs/output.log').then( function() {
                    logger.info( 'Reading SQL contents...');
                });
                if (!ready_for_test) {
                    const file = ((process.cwd().indexOf('\\test') > 0) ? '../' : '') + 'test/dbscript/initial-data.sql';
                    const contents = fs.readFileSync(file, {encoding: 'utf-8'}).toString();
                    let count = 0;
                    this.totalCount = loadFromFile(this.getConnection(), contents, (err) => {
                        if (err) {
                            callback(err);
                            return;
                        }
                        if (++count === this.totalCount) {
                            notifyStatementsComplete();
                            childFork = forkProcess(callback);
                            executed = true;
                        }
                    });
                } else {
                    this.getConnection();
                    childFork = forkProcess(callback);
                    executed = true;
                }
            } else {
                logger.info('SQL statements already bootstrapped');
                callback();
            }


        },
        cleanup: callback => {
            connection.end();
            connection = undefined;
            if (childFork) {
                _.delay(() => {
                    executed = false;
                    childFork.kill();
                    callback();
                }, 500);
            } else {
                callback();
            }

        }

    };
}();