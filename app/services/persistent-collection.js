var _ = require('../../lib/underscore/underscore');
var q = require('q');
var connectionManager = require('../pom/connection-mysql');
var dataTranslator = require('./mysql-translator');
var odata = require('../util/odata-parser');
var Logger = require('../util/logger');

var sqlTrace = Logger.getLogger("sql");
var logger = Logger.getLogger("server");

function PersistentCollection() {
    "use strict";

    function rollbackOnError(connection, defer, err) {
        if (err) {
            connection.rollback(function () {
                connection.release();
                defer.reject(dataTranslator.getErrorMessage(err));
            });
            return true;
        }
        return false;
    }

    return {
        generateId : function (fieldDefinition, obj) {
            var defer = q.defer();
            if (obj.id) {
                defer.resolve(obj.id);
            } else {
                PersistentCollection.getNextSequence(fieldDefinition, function (err, new_id) {
                    if (err) {
                        defer.reject(dataTranslator.getErrorMessage(err));
                    }
                    PersistentCollection.updateSequence(new_id, fieldDefinition).then(function () {
                        defer.resolve(new_id);
                    }, function (s_err) {
                        defer.reject(dataTranslator.getErrorMessage(s_err));
                    });
                });
            }
            return defer.promise;
        },

        update: function (obj, id) {
            var defer = q.defer();
            var provided = this.fieldDefinition.internalize(obj);
            var that = this;

            this.findById(id).then(function (storedObj) {
                if(storedObj === null ) {
                    defer.reject({ message: "The object was not found", code: "NOT_FOUND" });
                }
                connectionManager.getConnection().then(function (connection) {
                    var qs = dataTranslator.generateUpdateByFields(that.fieldDefinition, provided, storedObj);
                    if( qs !== null ) {
                        sqlTrace.log(Logger.DEBUG, qs);
                        connection.beginTransaction(function (err) {
                            connection.query(qs, function (err, rows) {
                                if (!rollbackOnError(connection, defer, err)) {
                                    if (rows.changedRows === 0 && rows.affectedRows === 0) {
                                        connection.rollback(function () {
                                            connection.release();
                                            defer.reject({ message: "No changes made during update.", code: "NO_CHANGES" });
                                        });
                                    } else {
                                        var merged = that.fieldDefinition.merge(provided, storedObj);
                                        that.updateAdditions(connection, merged, storedObj).then(function (output) {
                                            connection.commit(function (err) {
                                                connection.release();
                                                if (err) {
                                                    defer.reject(dataTranslator.getErrorMessage(err));
                                                }
                                                if (output.modified) {
                                                    that.findById(id).then(function (findResult) {
                                                        defer.resolve(findResult);
                                                    }, function (err) {
                                                        defer.reject(dataTranslator.getErrorMessage(err));
                                                    });
                                                } else {
                                                    defer.resolve(merged);
                                                }
                                            });
                                        }, function (err) {
                                            connection.rollback(function () {
                                                connection.release();
                                                defer.reject(err);
                                            });
                                        });
                                    }
                                }
                            });
                        });
                    }

                }, function (err) {
                    defer.reject(dataTranslator.getErrorMessage(err));
                });
            }, function (err) {
                defer.reject(dataTranslator.getErrorMessage(err));
            });
            return defer.promise;
        },

        create: function (obj) {
            var defer = q.defer();
            var that = this;
            var generateId = false;
            connectionManager.getConnection().then(function (connection) {
                connection.beginTransaction(function (err) {
                    if (!rollbackOnError(connection, defer, err)) {
                        that.generateId(that.fieldDefinition, obj).then(function (id) {
                            obj.id = id;
                            that.preCreate(obj); // opportunity for services to manipulate the object
                            var insertStatement = dataTranslator.generateInsertStatement(that.fieldDefinition, obj);
                            sqlTrace.log(Logger.DEBUG, insertStatement);
                            connection.query(insertStatement, function (err, rows) {
                                if (!rollbackOnError(connection, defer, err)) {
                                    that.postCreate(connection, obj).then(function (_obj) {
                                        connection.commit(function () {
                                            connection.release();
                                            that.findById(id).then(function (result) {
                                                defer.resolve(result);
                                            }, function (err) {
                                                defer.reject(dataTranslator.getErrorMessage(err));
                                            });
                                        });
                                    }, function (err) {
                                        rollbackOnError(connection, defer, err);
                                    });
                                }
                            });
                        }, function (err) {
                            // error from generate id
                            rollbackOnError(connection, defer, err);
                        });
                    }
                }); // end transaction
            }, function (err) {
                defer.reject(dataTranslator.getErrorMessage(err));
            });
            
            return defer.promise;
        },
        
        remove: function (id) {
            var defer = q.defer();
            var that = this;
            connectionManager.getConnection().then(function (connection) {
                connection.beginTransaction(function (err) {
                    if (!rollbackOnError(connection, defer, err)) {
                        that.preDelete(connection, id).then(function () {
                            var qs = 'DELETE FROM ' + that.fieldDefinition.getTableName() + ' WHERE ID=?';
                            sqlTrace.log(Logger.DEBUG, qs);
                            connection.query(qs, [id], function (err, rows) {
                                if (err || rows.affectedRows === 0) {
                                    if (err) {
                                        logger.log(Logger.ERROR, "Issue during deletion" + err);
                                    }
                                    connection.rollback(function () {
                                        connection.release();
                                        defer.reject({ message: "No object found", code: "NOT_FOUND" });
                                    });
                                } else {
                                    connection.commit(function () {
                                        connection.release();
                                        defer.resolve(rows.affectedRows);
                                    });
                                }
                            });
                        }, function (err) {
                            rollbackOnError(connection, defer, err);
                        });
                    }
                });
            });
            return defer.promise;
        },
        
        getFromTables: function ($filter) {
            return this.fieldDefinition.getTableName() + " AS " + this.fieldDefinition.getAlias();
        },
        
        getWhereClause: function ($filter) {
            return ($filter) ? dataTranslator.toWhereClause($filter, [this.fieldDefinition]) : '';
        },
        count: function ($filter) {
            var defer = q.defer();
            var that = this;
            var whereClause = this.getWhereClause($filter);
            var qs = 'SELECT COUNT(DISTINCT ' + that.fieldDefinition.getAlias() + '.ID) AS COUNT FROM ' + this.getFromTables() + ((whereClause.length > 0) ? (' WHERE ' + whereClause) : '');
            sqlTrace.log(Logger.DEBUG, qs);
            connectionManager.getConnection().then(function (connection) {
                connection.query(qs, function (err, result) {
                    if (err !== null) {
                        defer.reject(dataTranslator.getErrorMessage(err));
                    }
                    else if (result.length > 0) {
                        connection.release();
                        defer.resolve(result[0].COUNT);
                    } else {
                        defer.reject({ message: "No object found", code: "NOT_FOUND" });
                    }
                });
            }, function (err) {
                defer.reject(dataTranslator.getErrorMessage(err));
            });
            return defer.promise;
        },
        
        findById: function (id) {
            var filter = odata.toPredicates("id eq " + id);
            var defer = q.defer();
            var that = this;
            that.find(filter).then(function (rows) {
                if (rows && rows.length > 0) {
                    defer.resolve(rows[0]);
                } else {
                    defer.resolve(null);
                }
            }, function (err) {
                defer.reject(err);
            });
            return defer.promise;
        },
        findAll: function ($limit, $offset) {
            return this.find(null, $limit, $offset);
        },
        find: function ($filter, $limit, $offset) {
            var defer = q.defer();
            var that = this;
            var whereClause = this.getWhereClause($filter);
            if (!$limit) {
                $limit = 1000;
            }
            if (!$offset) {
                $offset = 0;
            }
            var qs = 'SELECT ' + that.fieldDefinition.getAlias() + '.* FROM ' + that.getFromTables() + ((whereClause.length > 0) ? (' WHERE ' + whereClause) : '') + ' LIMIT ' + $offset + ',' + $limit;
            sqlTrace.log(Logger.DEBUG, qs);
            connectionManager.getConnection().then(function (connection) {
                connection.query(qs, function (err, result) {
                    if (err !== null) {
                        connection.release();
                        defer.reject(dataTranslator.getErrorMessage(err));
                    }
                    else if (result.length > 0) {
                        that.postFind(connection, result).then(function (rows) {
                            connection.release();
                            defer.resolve(rows);
                        });
                    } else {
                        connection.release();
                        defer.resolve(result);
                    }
                });
            }, function (err) {
                defer.reject(dataTranslator.getErrorMessage(err));
            });
            return defer.promise;
        },
        preCreate: function (obj) {
        },
        postFind: function (connection, rows) {
            var defer = q.defer();
            defer.resolve(rows);
            return defer.promise;
        },
        /** Post create hook to do additional operations */
        postCreate: function (connection, obj) {
            var defer = q.defer();
            defer.resolve(obj);
            return defer.promise;
        },
        updateAdditions: function(connection,merged,storedObj) {
            var defer = q.defer();
            defer.resolve({
                modified: false
            });
            return defer.promise;
        },
        preDelete: function (connection, id) {
            var defer = q.defer();
            defer.resolve();
            return defer.promise;
        },
        
        /**  The name of the collection in the datastore */
        collectionName: undefined,
        fieldDefinition: undefined
    };
}

PersistentCollection.last_id = {};

PersistentCollection.getNextSequence = function(fieldDefinition, callback) {
    "use strict";
    connectionManager.getConnection().then(function (connection) {
        connection.query("SELECT ID_VAL FROM SEQUENCE_GEN WHERE ID_NAME='" + fieldDefinition.getSequenceColumn() + "'", function (err, result) {
            if (err) {
                callback(err, null);
            } else if (result.length > 0) {
                var id_val = result[0].ID_VAL;
                var last_id = PersistentCollection.last_id[fieldDefinition.getTableName()];
                id_val = Math.max(id_val, (!last_id) ? 0 : last_id) + 1;
                PersistentCollection.last_id[fieldDefinition.getTableName()] = id_val;
                callback(null, id_val);
            } else {
                var l_id = PersistentCollection.last_id[fieldDefinition.getTableName()];
                if( !l_id ) {
                    l_id = 0;
                }
                PersistentCollection.last_id[fieldDefinition.getTableName()] = l_id++;
                callback(null, l_id);
            }
            connection.release();
        });
    });
};

PersistentCollection.updateSequence = function(_id, fieldDefinition) {
    "use strict";
    var defer = q.defer();
    var qs = "UPDATE SEQUENCE_GEN SET ID_VAL=? WHERE ID_NAME='" + fieldDefinition.getSequenceColumn() + "'";
    sqlTrace.log(Logger.DEBUG, qs + " Bind params: [" + _id + "]");
    connectionManager.getConnection().then(function (connection) {
        connection.beginTransaction(function (err) {
            connection.query(qs, [_id], function (err, rows) {
                if (err) {
                    connection.rollback(function () {
                        connection.release();
                        defer.reject(dataTranslator.getErrorMessage(err));
                    });
                } else {
                    connection.commit(function (c_err) {
                        connection.release();
                        defer.resolve();
                    });
                }
            }); // end query
        }); // end transaction begin
    });
    return defer.promise;
};


module.exports = PersistentCollection;
