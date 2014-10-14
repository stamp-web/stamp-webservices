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
    

    function updateSequence(collectionName, _id, fieldDefinition) {
        var defer = q.defer();
        var qs = "UPDATE SEQUENCE_GEN SET ID_VAL=? WHERE ID_NAME='" + fieldDefinition.getSequenceColumn() + "'";
        connectionManager.getConnection(collectionName).then(function (connection) {
            connection.beginTransaction(function (err) {
                connection.query(qs, [_id], function (err, rows) {
                    if (err) {
                        connection.rollback(function () {
                            defer.reject(dataTranslator.getErrorMessage(err));
                        });
                    } else {
                        connection.commit(function (c_err) {
                            connectionManager.release(connection);
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
                defer.reject(dataTranslator.getErrorMessage(err));
            });
            return true;
        }
        return false;
    }
    
    function getNextSequence(collectionName, fieldDefinition, callback) {
        connectionManager.getConnection(collectionName).then(function (connection) {
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
                connectionManager.release(connection);
            });
        });
        
    }
    
    return {
        
        update: function (obj, id) {
            var defer = q.defer();
            var _obj = this.fieldDefinition.internalize(obj);
            var that = this;
            
            connectionManager.getConnection(this.collectionName).then(function (connection) {
                connection.beginTransaction(function (err) {
                    if (!rollbackOnError(connection, defer, err)) {
                        var qs = dataTranslator.generateUpdateStatement(that.fieldDefinition, obj, id);
                        sqlTrace.log(Logger.DEBUG, qs);
                        connection.query(qs, function (err, rows) {
                            if (!rollbackOnError(connection, defer, err)) {
                                if (rows.changedRows === 0) {
                                    connection.rollback(function () {
                                        defer.reject({ message: "Not object found.", code: "NOT_FOUND" });
                                    });
                                } else {
                                    connection.commit(function (err) {
                                        if (err) {
                                        } else {
                                            that.findById(id).then(function (result) {
                                                result = that.fieldDefinition.merge(result, _obj);
                                                that.postUpdate(connection, result).then(function (newResult) {
                                                    connectionManager.release(connection);
                                                    defer.resolve(newResult);
                                                }, function (err) {
                                                    defer.reject(dataTranslator.getErrorMessage(err));
                                                });
                                            }, function (err) {
                                                defer.reject({ message: "Not object found.", code: "NOT_FOUND" });
                                            });
                                        }
                                    });
                                } // end else
                            }
                        });
                    }
                });
            });
            return defer.promise;
        },
        create: function (obj) {
            var defer = q.defer();
            var that = this;
            var generateId = false;
            
            connectionManager.getConnection(this.collectionName).then(function (connection) {
                connection.beginTransaction(function (err) {
                    if (err) {
                        rollback(err);
                    } else {
                        var insert = function (_obj, generateId) {
                            var insertStatement = dataTranslator.generateInsertStatement(that.fieldDefinition, _obj);
                            sqlTrace.log(Logger.DEBUG, insertStatement);
                            connection.query(insertStatement, function (err, rows) {
                                if (!rollbackOnError(connection, defer, err)) {
                                    var finish = function (connection, _obj) {
                                        var id = _obj.id;
                                        that.postCreate(connection, _obj).then(function (_obj) {
                                            connection.commit(function () {
                                                that.findById(id).then(function (result) {
                                                    connectionManager.release(connection);
                                                    defer.resolve(result);
                                                }, function (err) {
                                                    defer.reject(dataTranslator.getErrorMessage(err));
                                                });
                                            });
    
                                        }, function (err) {
                                            rollbackOnError(connection, defer, err);
                                        });
                                    };
                                    if (generateId && _obj.id) {
                                        var _id = Math.max(_obj.id, last_id);
                                        updateSequence(that.collectionName, Math.max(_obj.id, last_id), that.fieldDefinition).then(function () {
                                            finish(connection, _obj);
                                        }, function (s_err) {
                                            rollbackOnError(connection, defer, s_err)
                                        });
                                    } else {
                                        finish(connection, _obj);
                                    }
                                }
                            });
                        }; // end insert
                        if (!obj.id) {
                            // handle ID generation case
                            generateId = true;
                            getNextSequence(that.collectionName, that.fieldDefinition, function (err, new_id) {
                                if (!rollbackOnError(connection, defer, err)) {
                                    obj.id = new_id;
                                    insert(obj, true);
                                }
                            });
                        } else {
                            insert(obj, false);
                        }
                    } // end if
                });
            });
            return defer.promise;
        },
        
        remove: function (id) {
            var defer = q.defer();
            var that = this;
            connectionManager.getConnection(this.collectionName).then(function (connection) {
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
                                        defer.reject({ message: "No object found", code: "NOT_FOUND" });
                                    });
                                } else {
                                    connection.commit(function (c_err) {
                                        connectionManager.release(connection);
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

        count: function ($filter) {
            var defer = q.defer();
            var that = this;
            var whereClause = ($filter) ? dataTranslator.toWhereClause($filter, that.fieldDefinition) : '';
            var qs = 'SELECT COUNT(id) FROM ' + that.fieldDefinition.getTableName() + ((whereClause.length > 0) ? (' WHERE ' + whereClause) : '');
            
            connectionManager.getConnection(this.collectionName).then(function (connection) {
                connection.query(qs, function (err, result) {
                    if (err !== null) {
                        defer.reject(dataTranslator.getErrorMessage(err));
                    }
                    else if (result.length > 0) {
                        connectionManager.release(connection);
                        defer.resolve(result[0]['COUNT(id)']);
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
            var definitions = [ that.fieldDefinition ];
            var whereClause = ($filter) ? dataTranslator.toWhereClause($filter, definitions) : '';
            if (!$limit) {
                $limit = 1000;
            }
            if (!$offset) {
                $offset = 0;
            }
            var qs = 'SELECT * FROM ' + that.fieldDefinition.getTableName() + ((whereClause.length > 0) ? (' WHERE ' + whereClause) : '') + ' LIMIT ' + $offset + ',' + $limit;
            sqlTrace.log(Logger.DEBUG, qs);
            connectionManager.getConnection(this.collectionName).then(function (connection) {
                connection.query(qs, function (err, result) {
                    if (err !== null) {
                        defer.reject(dataTranslator.getErrorMessage(err));
                    }
                    else if (result.length > 0) {
                        that.postFind(connection, result).then(function (rows) {
                            connectionManager.release(connection);
                            defer.resolve(rows);
                        });
                    } else {
                        connectionManager.release(connection);
                        defer.resolve(result);
                    }
                });
            }, function (err) {
                defer.reject(dataTranslator.getErrorMessage(err));
            });
            return defer.promise;
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
        postUpdate: function (connection, obj) {
            var defer = q.defer();
            defer.resolve(obj);
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
