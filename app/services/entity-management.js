const connectionManager = require('../pom/connection-mysql');
const dataTranslator = require('./mysql-translator');
const stamp = require('../model/stamp');
const Logger = require('../util/logger');

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
                // Need to require this here since Stamps uses collections that are EntityManagement classed
                let count = await require('./stamps').count({});
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
                        console.log(result);
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
};

module.exports = EntityManagement;