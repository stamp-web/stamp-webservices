var _ = require('../../lib/underscore/underscore');
var q = require('q');
var connectionManager = require('../pom/connection-mysql');
var dataTranslator = require('./mysql-translator');
var odata = require('../util/odata-parser');
var Logger = require('../util/logger');

var sqlTrace = Logger.getLogger("sql");
var logger = Logger.getLogger("server");

function persistentCollection() {
    
    var last_id = 0;
    
    
    function updateSequence(_id, fieldDefinition) {
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
                });
            })
        });
        return defer.promise;
    }
    
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
    
    function getNextSequence(fieldDefinition, callback) {
        connectionManager.getConnection().then(function (connection) {
            connection.query("SELECT ID_VAL FROM SEQUENCE_GEN WHERE ID_NAME='" + fieldDefinition.getSequenceColumn() + "'", function (err, result) {
                if (err) {
                    callback(err, null);
                } else if (result.length > 0) {
                    var id_val = result[0].ID_VAL;
                    id_val = Math.max(id_val, last_id) + 1;
                    last_id = id_val;
                    callback(null, id_val);
                } else {
                    last_id = last_id++;
                    callback(null, last_id);
                }
                connection.release();
            });
        });
        
    }
    
    
    
    return {
        generateId : function (fieldDefinition, obj) {
            var defer = q.defer();
            if (obj.id) {
                defer.resolve(obj.id);
            } else {
                getNextSequence(fieldDefinition, function (err, new_id) {
                    if (err) {
                        defer.reject(dataTranslator.getErrorMessage(err));
                    }
                    updateSequence(new_id, fieldDefinition).then(function () {
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
            var _obj = this.fieldDefinition.internalize(obj);
            var that = this;
            
            connectionManager.getConnection().then(function (connection) {
                var postProcess = function (id) {
                    that.updatePreCommit(connection, id, obj).then(function (current) {
                        connection.commit(function (err) {
                            if (err) {
                                connection.release();
                                defer.reject(dataTranslator.getErrorMessage(err));
                            }
                            connection.release();
                            that.findById(id).then(function (result) {
                                defer.resolve(result);
                            }, function (err) {
                                defer.reject(dataTranslator.getErrorMessage(err));
                            });
                        });
                    }, function (err) {
                        console.log(err);
                        connection.rollback(function () {
                            connection.release();
                            defer.reject(dataTranslator.getErrorMessage(err));
                        });
                    });
                };
                var qs = dataTranslator.generateUpdateStatement(that.fieldDefinition, obj, id);
                sqlTrace.log(Logger.DEBUG, qs);
                connection.beginTransaction(function (err) {
                    if (!rollbackOnError(connection, defer, err)) {
                        if (qs !== null) {
                            connection.query(qs, function (err, rows) {
                                if (!rollbackOnError(connection, defer, err)) {
                                    if (rows.changedRows === 0 && rows.affectedRows === 0) {
                                        connection.rollback(function () {
                                            connection.release();
                                            defer.reject({ message: "Not object found.", code: "NOT_FOUND" });
                                        });
                                    } else {
                                        postProcess(id);
                                    } // end else
                                }
                            });
                        } else {
                            postProcess(id);
                        }
                    }
                });
            });
            return defer.promise;
        },
        
        create: function (obj) {
            var defer = q.defer();
            var that = this;
            var generateId = false;
            connectionManager.getConnection().then(function (connection) {
                connection.beginTransaction(function (err) {
                    if (err) {
                        rollback(err);
                    } else {
                        that.generateId(that.fieldDefinition, obj).then(function (id) {
                            obj.id = id;
                            that.preCreate(obj); // opportunity for services to manipulate the object
                            var insertStatement = dataTranslator.generateInsertStatement(that.fieldDefinition, obj);
                            sqlTrace.log(Logger.DEBUG, insertStatement);
                            connection.query(insertStatement, function (err, rows) {
                                if (!rollbackOnError(connection, defer, err)) {
                                    that.postCreate(connection, obj).then(function (_obj) {
                                        connection.commit(function (err) {
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
                                    connection.commit(function (c_err) {
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
        
        count: function ($filter) {
            var defer = q.defer();
            var that = this;
            var whereClause = ($filter) ? dataTranslator.toWhereClause($filter, [that.fieldDefinition]) : '';
            var qs = 'SELECT COUNT(DISTINCT ' + that.fieldDefinition.getAlias() + '.ID) AS COUNT FROM ' + this.getFromTables() + ((whereClause.length > 0) ? (' WHERE ' + whereClause) : '');
            sqlTrace.log(Logger.DEBUG, qs);
            connectionManager.getConnection().then(function (connection) {
                connection.query(qs, function (err, result) {
                    if (err !== null) {
                        defer.reject(dataTranslator.getErrorMessage(err));
                    }
                    else if (result.length > 0) {
                        connection.release();
                        defer.resolve(result[0]['COUNT']);
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
        findAll: function ($limi, $offset) {
            return this.find(null, $limit, $offset);
        },
        find: function ($filter, $limit, $offset) {
            var defer = q.defer();
            var that = this;
            var whereClause = ($filter) ? dataTranslator.toWhereClause($filter, [ that.fieldDefinition ], [ that.fieldDefinition.getAlias()]) : '';
            if (!$limit) {
                $limit = 1000;
            }
            if (!$offset) {
                $offset = 0;
            }
            var qs = 'SELECT * FROM ' + that.getFromTables() + ((whereClause.length > 0) ? (' WHERE ' + whereClause) : '') + ' LIMIT ' + $offset + ',' + $limit;
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
        updatePreCommit: function (connection, id, orig) {
            var defer = q.defer();
            defer.resolve(orig);
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

module.exports = new persistentCollection();
