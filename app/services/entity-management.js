import connectionManager from '../pom/connection-mysql.js';
import dataTranslator from './mysql-translator.js';
import stamp from '../model/stamp.js';
import Logger from '../util/logger.js';

function EntityManagement() {
    let sqlTrace = Logger.getLogger('sql');
    let foundStamps = false;

    return {
        getCountStampWhereStatement: function() {
            throw new Error("Not implemented");
        },
        getCountStampFromTables: function() {
            return this.fieldDefinition.getTableName() +
                ' AS ' + this.fieldDefinition.getAlias() + ',' + stamp.getTableName() + ' AS ' + stamp.getAlias();
        },
        countStamps: async function() {
            if(!foundStamps) {
                // Need to import this here since Stamps uses collections that are EntityManagement classed
                const stamps = await import('./stamps.js');
                let count = await stamps.default.count({});
                foundStamps = count > 0;
                if (count === 0) {
                    return Promise.resolve([]);
                }
            }

            return new Promise((resolve, reject) => {
                const qs = 'SELECT ' + this.fieldDefinition.getAlias() + '.ID AS ID, COUNT(' + stamp.getAlias() + '.ID) AS COUNT FROM ' + this.getCountStampFromTables() + ' WHERE ' +
                    this.getCountStampWhereStatement() + ' GROUP BY ' + this.fieldDefinition.getAlias() + '.ID';
                sqlTrace.debug(qs);
                connectionManager.getConnection().then(connection => {
                    connection.query(qs, (err, result) => {
                        connection.release();
                        if (err !== null) {
                            reject(dataTranslator.getErrorMessage(err));
                        } else {
                            resolve(result);
                        }
                    });
                }, (err) => {
                    reject(dataTranslator.getErrorMessage(err));
                });
            });

        }
    }
}

export default EntityManagement;