var _ = require('lodash');

var connectionManager = require('../pom/connection-mysql');
var dataTranslator = require('./mysql-translator');
var odata = require('odata-filter-parser')
var Parser = odata.Parser;
var Operators = odata.Operators;
var Predicate = odata.Predicate;
var Logger = require('../util/logger');


function PersistentCollection() {
    "use strict";

    let sqlTrace = Logger.getLogger("sql");
    let logger = Logger.getLogger("server");

    return {
        generateId : (fieldDefinition, obj) => {
            return new Promise((resolve, reject) => {
                if (obj.ID) {
                    resolve(obj.ID);
                } else {
                    PersistentCollection.getNextSequence(fieldDefinition, (err, new_id) => {
                        if (err) {
                            reject(dataTranslator.getErrorMessage(err));
                        } else {
                            PersistentCollection.updateSequence(new_id, fieldDefinition).then(() => {
                                resolve(new_id);
                            }, (s_err) => {
                                reject(dataTranslator.getErrorMessage(s_err));
                            });
                        }
                    });
                }
            });
        },

        update: function (obj, id, params) {
            return new Promise((resolve, reject) => {
                let provided = this.fieldDefinition.internalize(obj);
                this.findById(id).then(storedObj => {
                    if(storedObj === null ) {
                        reject({ message: "The object was not found", code: "NOT_FOUND", processed: true });
                    }
                    else {
                        connectionManager.getConnection().then(connection => {
                            let qs = dataTranslator.generateUpdateByFields(this.fieldDefinition, provided, storedObj);
                            if( qs !== null ) {
                                sqlTrace.debug(qs);
                                connection.beginTransaction(err => {
                                    connection.query(qs, (err, rows) => {
                                        if (!PersistentCollection.rollbackOnError(connection, reject, err)) {
                                            if (rows.changedRows === 0 && rows.affectedRows === 0) {
                                                connection.rollback(function () {
                                                    connection.release();
                                                    reject({ message: "No changes made during update.", code: "NO_CHANGES", processed: true });
                                                });
                                            } else {
                                                let merged = this.fieldDefinition.merge(provided, storedObj);
                                                this.preCommitUpdate(connection, merged, storedObj, params).then(output => {
                                                    connection.commit(err => {
                                                        connection.release();
                                                        if (err) {
                                                            reject(dataTranslator.getErrorMessage(err));
                                                        }
                                                        else if (output.modified) {
                                                            this.findById(id).then(findResult => {
                                                                resolve(findResult);
                                                            }, err => {
                                                                reject(dataTranslator.getErrorMessage(err));
                                                            });
                                                        } else {
                                                            resolve(merged);
                                                        }
                                                    });
                                                }, err => {
                                                    connection.rollback(() => {
                                                        connection.release();
                                                        reject(err);
                                                    });
                                                });
                                            }
                                        }
                                    });
                                });
                            }

                        }, err => {
                            reject(dataTranslator.getErrorMessage(err));
                        });
                    }

                }, err => {
                    reject(dataTranslator.getErrorMessage(err));
                });
            });

        },

        create: function(obj) {
            return new Promise((resolve, reject) => {
                var provided = this.fieldDefinition.internalize(obj);
                var generateId = false;
                connectionManager.getConnection().then(connection => {
                    connection.beginTransaction(err => {
                        if (!PersistentCollection.rollbackOnError(connection, reject, err)) {
                            this.generateId(this.fieldDefinition, provided).then(id => {
                                provided.ID = id;
                                this.preCreate(provided).then(() => {  // opportunity for services to manipulate the object
                                    var validation = this.fieldDefinition.validate(provided);
                                    if( validation === null ) {
                                        var insertStatement = dataTranslator. generateInsertByFields(this.fieldDefinition, provided);
                                        sqlTrace.debug(insertStatement);
                                        connection.query(insertStatement, (err, rows) => {
                                            if (!PersistentCollection.rollbackOnError(connection, reject, err)) {
                                                this.postCreate(connection, provided).then(_obj => {
                                                    connection.commit(() => {
                                                        connection.release();
                                                        this.findById(id).then(result => {
                                                            resolve(result);
                                                        }, err => {
                                                            reject(dataTranslator.getErrorMessage(err));
                                                        });
                                                    });
                                                }, err => {
                                                    PersistentCollection.rollbackOnError(connection, reject, err);
                                                });
                                            }
                                        });
                                    } else {
                                        PersistentCollection.rollbackOnError(connection, reject, validation);
                                    }
                                });

                            }, err => {
                                // error from generate id
                                PersistentCollection.rollbackOnError(connection, reject, err);
                            });
                        }
                    }); // end transaction
                }, err => {
                    reject(dataTranslator.getErrorMessage(err));
                });
            });

        },
        
        remove: function (id) {
            return new Promise((resolve, reject) => {
                if( !id ) {
                    reject( { message: "No ID specified", code: "NOT_FOUND", processed: true });
                } else {
                    connectionManager.getConnection().then(connection => {
                        connection.beginTransaction(err => {
                            if (!PersistentCollection.rollbackOnError(connection, reject, err)) {
                                this.preDelete(connection, id).then(() => {
                                    var qs = 'DELETE FROM ' + this.fieldDefinition.getTableName() + ' WHERE ID=?';
                                    sqlTrace.debug(qs);
                                    connection.query(qs, [id], (err, rows) => {
                                        if (err || rows.affectedRows === 0) {
                                            if (err) {
                                                logger.error("Issue during deletion" + err);
                                            }
                                            connection.rollback(() => {
                                                connection.release();
                                                reject({ message: "No object found", code: "NOT_FOUND", processed: true });
                                            });
                                        } else {
                                            connection.commit(() => {
                                                connection.release();
                                                resolve(rows.affectedRows);
                                            });
                                        }
                                    });
                                }, function (err) {
                                    PersistentCollection.rollbackOnError(connection, reject, err);
                                });
                            }
                        });
                    });
                }
            });

        },
        
        getFromTables: function (params) {
            return this.fieldDefinition.getTableName() + " AS " + this.fieldDefinition.getAlias();
        },

        getWhereClause: function (params) {
            return (params && params.$filter) ? dataTranslator.toWhereClause(params.$filter, [this.fieldDefinition]) : '';
        },

        getOrderByClause: function(params, definitions) {
            if( !params.$orderby ) {
                return '';
            }
            if( !definitions ) {
                definitions = [];
                definitions.push(this.fieldDefinition);
            }
            var sortKeys = params.$orderby.split(' ');
            var orderby = '';
            var found = false;
            _.each( definitions, definition => {
                if( !found ) {
                    var field = _.find(definition.getFieldDefinitions(), { field: sortKeys[0] });
                    if( field ) {
                        if( field.sortFn ) {
                            orderby = (field.sortFn.apply(definition));
                        } else if( field.type !== 'id_array' || field.type !== 'obj_array') {
                            orderby = definition.getAlias() + '.' + field.column;
                        }
                        found = true;
                    }
                }

            });

            if( orderby.length > 0 ) {
                orderby = 'ORDER BY ' + orderby;
                if( sortKeys.length > 1 ) {
                    orderby += ' ' + sortKeys[1].toUpperCase();
                }
            }
            return orderby;
        },
        count: function (params) {
            var whereClause = this.getWhereClause(params);
            var qs = 'SELECT COUNT(DISTINCT ' + this.fieldDefinition.getAlias() + '.ID) AS COUNT FROM ' + this.getFromTables(params) + ((whereClause.length > 0) ? (' WHERE ' + whereClause) : '');
            sqlTrace.debug(qs);
            return new Promise((resolve, reject) => {
                connectionManager.getConnection().then(connection => {
                    connection.query(qs, (err, result) => {
                        connection.release();
                        if (err !== null) {
                            reject(dataTranslator.getErrorMessage(err));
                        } else if (result.length > 0) {
                            resolve(result[0].COUNT);
                        } else {
                            reject({ message: "No object found", code: "NOT_FOUND", processed: true });
                        }
                    });
                }, function (err) {
                    reject(dataTranslator.getErrorMessage(err));
                });
            });
        },
        
        findById: function (id) {
            var params = {
                $filter: new Predicate({
                        subject: 'id',
                        operator: Operators.EQUALS,
                        value: id
                }),
                $limit: 1000,
                $offset: 0,
                $orderby: null
            };
            return new Promise((resolve, reject) => {
                this.find(params).then(result => { // we can limit to 1,1 once the stamps find is fixed
                    if (result.rows && result.rows.length > 0) {
                        resolve(result.rows[0]);
                    } else {
                        resolve(null);
                    }
                }, function (err) {
                    reject(err);
                });
            });
        },
        find: function (params) {
            var whereClause = this.getWhereClause(params);
            const _defaults = {
                $limit: 1000,
                $offset: 0
            };
            params = params || _defaults;

            var qs = 'SELECT SQL_CALC_FOUND_ROWS ' + this.fieldDefinition.getAlias() + '.* FROM ' + this.getFromTables(params) + ((whereClause.length > 0) ? (' WHERE ' + whereClause) : '') + ' ' + this.getOrderByClause(params) + ' LIMIT ' + params.$offset + ',' + params.$limit;
            sqlTrace.debug(qs);
            return new Promise((resolve, reject) => {
                connectionManager.getConnection().then(connection => {
                    let t = (new Date()).getTime();
                    connection.query(qs, (err, dataRows) => {
                        if (err !== null) {
                            connection.release();
                            reject(dataTranslator.getErrorMessage(err));
                        }
                        else if (dataRows.length > 0) {
                            connection.query("SELECT FOUND_ROWS() AS ROWCOUNT", (err,rowCount) => {
                                if( err ) {
                                    connection.release();
                                    return reject(dataTranslator.getErrorMessage(err));
                                }
                                let result = {
                                    total: rowCount[0].ROWCOUNT,
                                    rows: dataRows
                                };
                                this.postFind(connection, result).then(() => {
                                    connection.release();
                                    if( this.collectionName === 'stamps') {
                                        console.log("query time: " + ((new Date()).getTime() - t) + "ms");
                                    }
                                    return resolve(result);
                                }, function(err) {
                                    connection.release();
                                    return reject(dataTranslator.getErrorMessage(err));
                                });
                            });

                        } else {
                            connection.release();
                            resolve({ rows: [], total: 0});
                        }
                    });
                }, function (err) {
                    reject(dataTranslator.getErrorMessage(err));
                });
            });
        },
        preCreate: obj => {
            return Promise.resolve();
        },
        postFind: function (connection, rows) {
            return Promise.resolve(rows);
        },
        /** Post create hook to do additional operations */
        postCreate: function (connection, obj) {
           return Promise.resolve(obj);
        },
        preCommitUpdate: async (connection,merged,storedObj) => {
            return Promise.resolve({modified: false});
        },
        preDelete: function (connection, id) {
            return Promise.resolve();
        },
        
        /**  The name of the collection in the datastore */
        collectionName: undefined,
        fieldDefinition: undefined
    };
}

PersistentCollection.last_id = {};

PersistentCollection.rollbackOnError = (connection, reject, err) => {
    "use strict";
    if (err) {
        connection.rollback(() => {
            connection.release();
            if(reject) {
                reject(dataTranslator.getErrorMessage(err));
            }
        });
        return true;
    }
    return false;
};

PersistentCollection.getNextSequence = (fieldDefinition, callback) => {
    "use strict";
    connectionManager.getConnection().then(connection => {
        connection.query("SELECT ID_VAL FROM SEQUENCE_GEN WHERE ID_NAME='" + fieldDefinition.getSequenceColumn() + "'", (err, result) => {
            connection.release();
            if (err) {
                callback(err, null);
            } else if (result.length > 0) {
                let id_val = result[0].ID_VAL;
                let last_id = PersistentCollection.last_id[fieldDefinition.getTableName()];
                id_val = Math.max(id_val, (!last_id) ? 0 : last_id) + 1;
                PersistentCollection.last_id[fieldDefinition.getTableName()] = id_val;
                callback(null, id_val);
            } else {
                let l_id = PersistentCollection.last_id[fieldDefinition.getTableName()];
                if( !l_id ) {
                    l_id = 0;
                }
                PersistentCollection.last_id[fieldDefinition.getTableName()] = l_id++;
                callback(null, l_id);
            }
        });
    });
};

PersistentCollection.updateSequence = (_id, fieldDefinition) => {
    "use strict";
    let sqlTrace = Logger.getLogger("sql");
    return new Promise((resolve, reject) => {
        let qs = "UPDATE SEQUENCE_GEN SET ID_VAL=? WHERE ID_NAME='" + fieldDefinition.getSequenceColumn() + "'";
        sqlTrace.debug(qs + " Bind params: [" + _id + "]");
        connectionManager.getConnection().then(connection => {
            connection.beginTransaction(err => {
                connection.query(qs, [_id], (err, rows) => {
                    if (err) {
                        connection.rollback(() => {
                            connection.release();
                            reject(dataTranslator.getErrorMessage(err));
                        });
                    } else {
                        connection.commit(c_err => {
                            connection.release();
                            resolve();
                        });
                    }
                }); // end query
            }); // end transaction begin
        });
    });

};


module.exports = PersistentCollection;
