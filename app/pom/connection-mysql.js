
import mysql from 'mysql';
import PoolConnection from 'mysql/lib/PoolConnection.js';
import Logger from '../util/logger.js';
import Level from '../util/level.js';
import nconf from 'nconf';
import pw from 'pw';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

nconf.argv().env().file(path.join(__dirname, '../../config/application.json'));

const logger = Logger.getLogger("connection");
logger.setLevel(Level.INFO);

let releaseCount = 0;

/**
 * OVERRIDDEN FROM node-mysql to allow the release count to be incremented.
 *
 * @returns {*}
 */
PoolConnection.prototype.release = function release() {
    const pool = this._pool;

    if (!pool || pool._closed) {
        return;
    }
    releaseCount++;
    logger.trace("release connection: < " + releaseCount);
    return pool.releaseConnection(this);
};

function logConfigration(config) {
    const safeConfig = Object.assign({}, config);
    if (safeConfig.password) {
        delete safeConfig.password;
    }
    logger.info(`MySQL database configuration: ${JSON.stringify(safeConfig, null, 2)}`);
}

function createConnectionManager() {
    let connectionCount, dbPool, config, dbName;

    const ConnectionCodes = {
        ACCESS_DENIED: 'ER_ACCESS_DENIED_ERROR',
        DBACCESS_DENIED_ERROR: 'ER_DBACCESS_DENIED_ERROR',
        NOT_FOUND: 'ENOTFOUND',
        ETIMEDOUT: 'ETIMEDOUT'
    };

    function handleConnectionError(err) {
        if (err.code) {
            let msg = "Access error is unknown:" + err.message;
            let host;
            switch (err.code) {
                case ConnectionCodes.ACCESS_DENIED:
                case ConnectionCodes.DBACCESS_DENIED_ERROR:
                case ConnectionCodes.ETIMEDOUT:
                    msg = err.message.substring(err.code.length + 1);
                    break;
                case ConnectionCodes.NOT_FOUND:
                    host = "unknown";
                    if (dbPool && dbPool.config && dbPool.config.connectionConfig) {
                        host = dbPool.config.connectionConfig.host;
                    }
                    msg = "The database on host \"" + host + "\" was not reachable";
                    break;
            }
            logger.error("A connection to the database could not be established.  The message was:\n\n   " + msg + "\n");
        }
    }

    function determineDBPassword(config) {
        return new Promise((resolve) => {
            if (config.password && config.password.length > 0) {
                resolve();
            } else {
                config.password = nconf.get("db_password");
                if (config.password && config.password.length > 0) {
                    resolve();
                } else {
                    process.stdout.write('\nConfiguration did not contain a database password.\nEnter database password: ');
                    pw((value) => {
                        config.password = value;
                        resolve();
                    });
                }
            }
        });
    }

    async function enableKeepAlive() {
        const Pool = (await import('mysql/lib/Pool.js')).default;
        Pool.prototype.startKeepAlive = function () {
            const pool = this;
            this.config.keepalive = 30000;
            setInterval(function () {
                logger.debug("Keep alive fired for " + pool._freeConnections.length + " connections");
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

    async function createPool() {
        if (config) {
            await determineDBPassword(config);
            await enableKeepAlive();
            logConfigration(config);
            if (!dbPool) {
                dbPool = mysql.createPool({
                    connectionLimit: 20,
                    host: config.host,
                    user: config.user,
                    password: config.password,
                    database: config.schema
                });
                dbPool.startKeepAlive();

                // Wait for connection test
                await new Promise((resolve, reject) => {
                    dbPool.getConnection((err, connection) => {
                        connectionCount++;
                        if (connection) {
                            connection.release();
                        }
                        if (!err) {
                            logger.info('MySQL database pool created for database named \'' + dbName + '\'');
                            resolve();
                        } else {
                            logger.error('Failed to create connection pool', err);
                            reject(new Error(`Failed to create connection pool: ${err.message}`));
                        }
                    });
                });
            }
            return dbPool;
        } else {
            const msg = "No Configuration was provided.";
            logger.error(msg);
            return null;
        }
    }

    async function getPool() {
        if (dbPool) {
            return dbPool;
        } else {
            try {
                return await createPool();
            } catch (err) {
                throw new Error('Failed to create DBPool', err);
            }
        }
    }

    connectionCount = 0;

    return {
        startup: async () => {
            if (!dbPool) {
                dbName = nconf.get("database");
                if (!dbName) {
                    throw new Error("No database was selected.");
                }
                config = nconf.get("databases")[dbName];
                try {
                    await getPool();
                    logger.info("Connection pool created for database named '" + dbName + "'");
                } catch (err) {
                    logger.error("Error creating connection pool", err);
                }
            }
        },
        shutdown: () => {
            if (dbPool) {
                dbPool.end(err => {
                    logger.warn('Error seen closing connection pool', err);
                    dbPool = null;
                });
            }
        },
        getConnection: async () => {
            try {
                const pool = await getPool();
                return new Promise((resolve, reject) => {
                    pool.getConnection((err, connection) => {
                        if (err) {
                            handleConnectionError(err);
                            reject(err);
                        } else {
                            if (connectionCount > 1000000) {
                                releaseCount = 0;
                                connectionCount = 0;
                                logger.debug("resetting connection counts to guard against buffer overrun...");
                            }
                            connectionCount++;
                            logger.trace("new connection:     > " + connectionCount + " (" + (connectionCount - releaseCount) + " unreleased)");
                            resolve(connection);
                        }
                    });
                });
            } catch (e) {
                throw e;
            }
        }
    };
}

export default createConnectionManager();