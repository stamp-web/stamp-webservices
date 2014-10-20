var extend = require('node.extend');
var persistentCollection = require('./persistent-collection');
var connectionManager = require('../pom/connection-mysql');
var dataTranslator = require('./mysql-translator');
var odata = require('../util/odata-parser');
var stamp = require('../model/stamp');
var ownership = require('../model/ownership');
var catalogueNumber = require('../model/catalogue-number');
var _ = require('../../lib/underscore/underscore');
var q = require('q');
var Logger = require('../util/logger');

var sqlTrace = Logger.getLogger("sql");
var logger = Logger.getLogger("server");

var stamps = extend(true, {}, persistentCollection, function () {

    "use strict";

    function generateColumnExpression(fields, tableRef) {

        var s = "";
        _.each(fields, function (field, indx) {
            var prefix = false;
            if (field.field === 'id') {
                prefix = true;
            }
            s += tableRef + "." + field.column;
            if (prefix) {
                s += ' AS ' + tableRef + field.column;
            }
            if (indx < fields.length - 1) {
                s += ',';
            }
        });
        return s;
    }
    
    function populateChildren(fields, childfields, object, childKey) {
        var child = {};
        _.each(childfields, function (field) {
            if (field.column === 'ID' && typeof object[childKey] !== 'undefined') {
                child[field.column] = object[childKey];
                delete object[childKey];
            } else if (typeof object[field.column] !== 'undefined') {
                child[field.column] = object[field.column];
                delete object[field.column];
            }
        });
        
        return child;
    }
    
    function processRow(rows, row) {
        var s = _.findWhere(rows, { ID: row.sID });
        if (!s) {
            s = row;
            s.ID = row.sID;
            delete row.sID;
            rows.push(row);
        }
        if (!s.CATALOGUENUMBER || s.CATALOGUENUMBER.length === 0) {
        s.CATALOGUENUMBER = [];
        }
        if (!s.OWNERSHIP || s.OWNERSHIP.length === 0) {
            s.OWNERSHIP = [];
        }
        s.CATALOGUENUMBER.push(populateChildren(stamp.getFieldDefinitions(), catalogueNumber.getFieldDefinitions(), row, 'cID'));
        var oid = row.oID;
        if (oid && !_.findWhere(s.OWNERSHIP, { ID: oid })) {
            var ownerObj = populateChildren(stamp.getFieldDefinitions(), ownership.getFieldDefinitions(), row, 'oID');
            if (!_.isEmpty(ownerObj)) {
                s.OWNERSHIP.push(ownerObj);
            }
        } else {
            logger.log(Logger.TRACE, "skipped for " + s.ID);
        }
    }
    
    return {
        preCreate: function(obj) {
            obj.catalogueCount = (obj.catalogueNumbers) ? obj.catalogueNumbers.length : 0;
        },
        updatePreCommit: function (connection, id, obj) {
            var defer = q.defer();
            var that = this;
            var total = ((obj.catalogueNumbers) ? obj.catalogueNumbers.length : 0) + ((obj.stampOwnerships) ? obj.stampOwnerships.length : 0);
            var updated = 0;
            if (obj.catalogueNumbers && _.isArray(obj.catalogueNumbers)) {
                _.each(obj.catalogueNumbers, function (catNum) {
                    if (catNum.id) {
                        var sql = dataTranslator.generateUpdateStatement(catalogueNumber, catNum, catNum.id);
                        sqlTrace.log(Logger.DEBUG, sql);
                        connection.query(sql, function (err, result) {
                            if (err) {
                                defer.reject(dataTranslator.getErrorMessage(err));
                            }
                            updated++;
                            if (updated === total) {
                                defer.resolve(obj);
                            }
                        });
                    }
                });
            }
            if (obj.stampOwnerships && _.isArray(obj.stampOwnerships)) {
                _.each(obj.stampOwnerships, function (owner) {
                    if (owner.id) {
                        var sql = dataTranslator.generateUpdateStatement(ownership, owner, owner.id);
                        sqlTrace.log(Logger.DEBUG, sql);
                        connection.query(sql, function (err, result) {
                            if (err) {
                                defer.reject(dataTranslator.getErrorMessage(err));
                            }
                            updated++;
                            if (updated === total) {
                                defer.resolve(obj);
                            }
                        });
                    } else {
                        that.findById(id).then(function (result) {
                            if (!result.stampOwnerships || result.stampOwnerships.length === 0) {
                                owner.stampRef = id;
                                that.generateId(ownership, owner).then(function (_id) {
                                    owner.id = _id;
                                    var sql = dataTranslator.generateInsertStatement(ownership, owner);
                                    sqlTrace.log(Logger.DEBUG, sql);
                                    connection.query(sql, function (err, result) {
                                        if (err) {
                                            defer.reject(dataTranslator.getErrorMessage(err));
                                        }
                                        updated++;
                                        if (updated === total) {
                                            defer.resolve(obj);
                                        }
                                    });
                                });
                            } else {
                                defer.reject({ message: "Only a single ownership record is currently supported", code: "INVALID" });
                            }
                        });
                    }
                });
            }
            return defer.promise;
        },
        postCreate: function (connection, obj) {
            var defer = q.defer();
            var total = ((obj.catalogueNumbers) ? obj.catalogueNumbers.length : 0) + ((obj.stampOwnerships) ? obj.stampOwnerships.length : 0);
            var created = 0;
            var that = this;
            if (obj.catalogueNumbers && _.isArray(obj.catalogueNumbers)) {
                _.each(obj.catalogueNumbers, function (catNum) {
                    catNum.stampRef = obj.id;
                    that.generateId(catalogueNumber, catNum).then(function (id) {
                        catNum.id = id;
                        var sql = dataTranslator.generateInsertStatement(catalogueNumber, catNum);
                        sqlTrace.log(Logger.DEBUG, sql);
                        connection.query(sql, function (err, result) {
                            if (err) {
                                defer.reject(dataTranslator.getErrorMessage(err));
                            }
                            created++;
                            if (created === total) {
                                defer.resolve(obj);
                            }
                        });
                    }, function (err) {
                        defer.reject(dataTranslator.getErrorMessage(err));
                    });
                    
                });
            }
            if (obj.stampOwnerships && _.isArray(obj.stampOwnerships)) {
                _.each(obj.stampOwnerships, function (owner) {
                    owner.stampRef = obj.id;
                    that.generateId(ownership, owner).then(function (id) {
                        owner.id = id;
                        var sql = dataTranslator.generateInsertStatement(ownership, owner);
                        sqlTrace.log(Logger.DEBUG, sql);
                        connection.query(sql, function (err, result) {
                            if (err) {
                                defer.reject(dataTranslator.getErrorMessage(err));
                            }
                            created++;
                            if (created === total) {
                                defer.resolve(obj);
                            }
                        });
                    });
                }, function (err) {
                    defer.reject(dataTranslator.getErrorMessage(err));
                });
            }
            return defer.promise;
        },
      
        getFromTables: function ($filter) {
            var tables = stamp.getTableName() + ' AS ' + stamp.getAlias() + ' JOIN ' + catalogueNumber.getTableName() + ' AS ' + catalogueNumber.getAlias();
            tables += ' ON ' + stamp.getAlias() + '.ID=' + catalogueNumber.getAlias() + '.STAMP_ID ';
            tables += 'LEFT OUTER JOIN ' + ownership.getTableName() + ' AS ' + ownership.getAlias() + ' ON ' + stamp.getAlias() + '.ID = ' + ownership.getAlias() + '.STAMP_ID';
            return tables;
        },
        
        getWhereClause: function ($filter) {
            return ($filter) ? dataTranslator.toWhereClause($filter, [stamp,catalogueNumber,ownership]) : '';
        },

        find: function ($filter, $limit, $offset) {
            var defer = q.defer();
            var that = this;
            
            if (!$limit) {
                $limit = 1000;
            }
            if (!$offset) {
                $offset = 0;
            }
            var rejectFn = function (field) {
                return (field.internal && field.internal === true || field.model);
            };
            var stampDef = _.reject(stamp.getFieldDefinitions(), rejectFn);
            var catDef = _.reject(catalogueNumber.getFieldDefinitions(), rejectFn);
            var ownerDef = _.reject(ownership.getFieldDefinitions(), rejectFn);
            
            var select = 'SELECT ' + generateColumnExpression(stampDef, stamp.getAlias()) + ',';
            select += generateColumnExpression(catDef, catalogueNumber.getAlias()) + ',' + generateColumnExpression(ownerDef, ownership.getAlias());
            select += ' FROM ' + this.getFromTables();
            
            var whereClause = this.getWhereClause($filter);
            select += ((whereClause.length > 0) ? (' WHERE ' + whereClause) : '') + ' LIMIT ' + $offset + ',' + $limit;
            sqlTrace.log(Logger.DEBUG, select);
            connectionManager.getConnection().then(function (connection) {
                var rows = [];
                var query = connection.query(select);
                query.on('result', function (row) {
                    processRow(rows, row);
                }).on('end', function () {
                    defer.resolve(rows);
                }).on('error', function (err) {
                    logger.log(Logger.ERROR, err);
                    defer.reject(dataTranslator.getErrorMessage(err));
                });
            }, function (err) {
                defer.reject(dataTranslator.getErrorMessage(err));
            });
            return defer.promise;
        },
        collectionName: 'stamps',
        fieldDefinition: stamp
    };
}());

module.exports = stamps;
