var _ = require('../../lib/underscore/underscore');
var q = require('q');
var connectionMgr = require('../pom/connection-mgr');
var begin = require('any-db-transaction')
var dataTranslator = require('./mysql-translator');
var transaction = require('node-mysql-transaction');
var odata = require('../util/odata-parser');
var logger = require('../util/logger');

function persistentCollection() {
    
    var last_id = 0;
    return {
        
        update: function (obj, id) {
            var defer = q.defer();
            var _obj = this.fieldDefinition.internalize(obj);
            var that = this;
            var _connection = connectionMgr.getConnection();
            var trx = begin(_connection);
            
            var qs = dataTranslator.generateUpdateStatement(that.fieldDefinition, obj, id);
            logger.log(logger.TRACE, qs);
            _connection.query(qs, function (err, rows) {
                if (err) {
                    trx.rollback();
                    defer.reject(dataTranslator.getErrorMessage(err));
                } else {
                    if (rows.changedRows === 0) {
                        trx.rollback();
                        defer.reject({ message: "Not object found.", code: "NOT_FOUND" });
                    } else {
                        console.log(trx.commit());
                        that.findById(id).then(function (result) {
                                result = that.fieldDefinition.merge(result, _obj);
                            that.postUpdate(_connection, result).then(function (newResult) {
                                    defer.resolve(newResult);
                                }, function (err) {
                                    defer.reject(dataTranslator.getErrorMessage(err));
                            });
                        }, function (err) {
                                defer.reject({ message: "Not object found.", code: "NOT_FOUND" });
                        });
                    }
                }
            });
            
            return defer.promise;
        },
        create: function (obj) {
            var defer = q.defer();
            var that = this;
            
            var _connection = connectionMgr.getConnection();
            var trx = begin(_connection);
            trx.on('error', function (err) {
                console.log("\n\n*** Transaction Error occured...");
                console.log(err);
                
                var stack = new Error().stack
                console.log(stack)
            });
            //console.log(obj);
            var generateId = false;
            var finish = function (_connection, trx, _obj) {
                var id = _obj.id;
                that.postCreate(_connection, _obj).then(function (_obj) {
                    trx.commit();
                    that.findById(id).then(function (result) {
                        console.log("after create=");
                        console.log( result);
                        defer.resolve(result);
                    }, function (err) {
                        defer.reject(dataTranslator.getErrorMessage(err));
                    });
                }, function (err) {
                    trx.rollback();
                    defer.reject(dataTranslator.getErrorMessage(err));
                });
            };
            var insert = function (_obj, generateId) {
                var insertStatement = dataTranslator.generateInsertStatement(that.fieldDefinition, _obj);
                logger.log(logger.TRACE, insertStatement);
                console.log(insertStatement);
                _connection.query(insertStatement, function (err, rows) {
                    console.log("in insert");
                    if (err) {
                        trx.rollback();
                        console.log(err);
                        defer.reject(dataTranslator.getErrorMessage(err));
                    } else {
                        console.log("before commital...");
                        console.log(_obj);
                        if (generateId && _obj.id) {
                            console.log(_obj.id);
                            var _id = Math.max(_obj.id, last_id);
                            console.log("The id for collectionName " + this.collectionName + " is " + _id);
                            var qs = "UPDATE SEQUENCE_GEN SET ID_VAL=" + _id + " WHERE ID_NAME='" + that.fieldDefinition.getSequenceColumn() + "'";
                            _connection.query(qs, function (err, rows) {
                                if (err) {
                                    trx.rollback();
                                    defer.reject(dataTranslator.getErrorMessage(err));
                                } else {
                                    console.log("calling finish");
                                    finish(_connection, trx, _obj);
                                }
                            });
                        } else {
                            finish(_connection, trx, _obj);
                        }
                    }
                });
    
            }; // end insert
            console.log(obj);
			if (!obj.id) {
				// handle ID generation case
                generateId = true;
                console.log("generating ID");
              //  var _connection = connectionMgr.getConnection();
                _connection.query("SELECT ID_VAL FROM SEQUENCE_GEN WHERE ID_NAME='" + that.fieldDefinition.getSequenceColumn() + "'", function (err, result) {
                    if (err) {
//                        connectionMgr.release(_connection);
						defer.reject(dataTranslator.getErrorMessage(err));
					} else {
                        var id_val = result.rows[0].ID_VAL;
                        id_val = Math.max(id_val, last_id) + 1;
                        last_id = id_val;
                        obj.id = id_val;
                        console.log("object id = " + obj.id);
						insert(obj, true);
					}
				});
			} else {
				insert(obj, false);
			}

            return defer.promise;
        },
        remove: function (id) {
            var defer = q.defer();
            var that = this;
            var _connection = connectionMgr.getConnection();
            var trx = begin(_connection);
            that.preDelete(_connection, id).then(function () {
                var qs = 'DELETE FROM ' + that.fieldDefinition.getTableName() + ' WHERE ID=' + id;
                _connection.query(qs, function (err, rows) {
                    if (err || rows.affectedRows === 0) {
                        if (err) {
                            logger.log(logger.ERROR, "Issue during deletion" + err);
                        }
                        trx.rollback();
                        defer.reject({ message: "No object found", code: "NOT_FOUND" });
                    } else {
                        trx.commit();
                        defer.resolve(rows.affectedRows);
                    }
                });
            }, function (err) {
                trx.rollback();
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
        findAll: function ($limit) {
            return this.find(null, $limit);
        },
        find: function ($filter, $limit) {
            var defer = q.defer();
            var that = this;
            
            var whereClause = ($filter) ? dataTranslator.toWhereClause($filter, that.fieldDefinition) : '';
            var qs = 'SELECT * FROM ' + that.fieldDefinition.getTableName() + ((whereClause.length > 0) ? (' WHERE ' + whereClause) : '');
            
            var _connection = connectionMgr.getConnection();
            _connection.query(qs, function (err, result) {
                if (err !== null) {
                    defer.reject(dataTranslator.getErrorMessage(err));
                }
                else if (result.rows.length > 0) {
                    that.postFind(_connection, result.rows).then(function (rows) {
                        defer.resolve(rows);
                    });
                } else {
                    defer.resolve(result.rows);
                }
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
