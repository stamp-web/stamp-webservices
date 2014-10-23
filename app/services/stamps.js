var extend = require('node.extend');
var PersistentCollection = require('./persistent-collection');
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

var stamps = extend(true, {}, new PersistentCollection(), function () {

    "use strict";

    function generateColumnExpression(fields, tableRef) {
        var s = "";
        _.each(fields, function (field, indx) {
            s += tableRef + "." + field.column;
            if (indx < fields.length - 1) {
                s += ',';
            }
        });
        return s;
    }

    function populateKey(stamp, k) {
        if (!_.has(stamp, k)) {
            stamp[k] = [];
        }
    }

    function processRow(rows, row, fieldDef, key) {
        var s = _.findWhere(rows, { ID: row.STAMP_ID });
        if (!s) {
            sqlTrace.log(Logger.TRACE, "No stamp found for " + row.STAMP_ID);
            return;
        }
        s[key].push(row);
    }

    function getFromTableForChildren (fieldDefinition) {
        var tables = stamp.getTableName() + ' AS ' + stamp.getAlias() + ' JOIN ' + fieldDefinition.getTableName() + ' AS ' + fieldDefinition.getAlias();
        tables += ' ON ' + stamp.getAlias() + '.ID=' + fieldDefinition.getAlias() + '.STAMP_ID';
        return tables;
    }

    function generateChildSelection(supportedFields, fieldDefinition, inValues) {
        var select = 'SELECT ' + generateColumnExpression(supportedFields, fieldDefinition.getAlias());
        select += ' FROM ' + getFromTableForChildren(fieldDefinition) + ' WHERE ' + fieldDefinition.getAlias() + '.STAMP_ID IN ' + inValues;
        return select;
    }

    return {
        preCreate: function (obj) {
            obj.catalogueCount = (obj.catalogueNumbers) ? obj.catalogueNumbers.length : 0;
        },
        preCommitUpdate: function (connection, merged, storedObj) {
            var defer = q.defer();
            var that = this;
            var updateList = [], createList = [];
            var parseChildren = function (childName, fieldDef) {
                if (merged[childName] && _.isArray(merged[childName])) {
                    _.each(merged[childName], function (obj) {
                        if (obj.ID) {
                            var current = _.findWhere(storedObj[childName], { ID: obj.ID});
                            var sql = dataTranslator.generateUpdateByFields(fieldDef, obj, current, true);
                            if (sql !== null) {
                                updateList.push(sql);
                            }
                        } else {
                            obj.STAMP_ID = merged.ID;
                            createList.push({ fieldDefinition: fieldDef, object: obj});
                        }
                    });
                }
            };
            parseChildren("CATALOGUENUMBER", catalogueNumber);
            parseChildren("OWNERSHIP", ownership);

            var total = updateList.length + createList.length;
            var count = 0;
            var resolveWhenFinished = function () {
                if (count === total) {
                    defer.resolve({
                        modified: total > 0
                    });
                }
            };
            resolveWhenFinished();
            _.each(updateList, function (sql) {
                sqlTrace.log(Logger.DEBUG, sql);
                connection.query(sql, function (err, data) {
                    if (err !== null) {
                        defer.reject(dataTranslator.getErrorMessage(err));
                    } else {
                        count++;
                        resolveWhenFinished();
                    }

                });
            });
            _.each(createList, function (obj) {
                var creating = obj;
                PersistentCollection.getNextSequence(creating.fieldDefinition, function (err, id) {
                    if (err !== null) {
                        defer.reject(dataTranslator.getErrorMessage(err));
                    } else {
                        creating.object.ID = id;
                        var c_sql = dataTranslator.generateInsertByFields(creating.fieldDefinition, creating.object);
                        sqlTrace.log(Logger.DEBUG, c_sql);
                        connection.query(c_sql, function (err, data) {
                            if (err !== null) {
                                defer.reject(dataTranslator.getErrorMessage(err));
                            } else {
                                count++;
                                resolveWhenFinished();
                            }
                        });
                        PersistentCollection.updateSequence(id, creating.fieldDefinition);
                    }
                });
            });
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
                            } else {
                                created++;
                                if (created === total) {
                                    defer.resolve(obj);
                                }
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
                            } else {
                                created++;
                                if (created === total) {
                                    defer.resolve(obj);
                                }
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
            return ($filter) ? dataTranslator.toWhereClause($filter, [stamp, catalogueNumber, ownership]) : '';
        },

        find: function ($filter, $limit, $offset, $orderby) {
            var defer = q.defer();
            var that = this;

            if (!$limit) {
                $limit = 1000;
            }
            if (!$offset) {
                $offset = 0;
            }
            var rejectFn = function (field) {
                return (field.internal && field.internal === true && field.required !== true || field.model);
            };
            var stampDef = _.reject(stamp.getFieldDefinitions(), rejectFn);
            var catDef = _.reject(catalogueNumber.getFieldDefinitions(), rejectFn);
            var ownerDef = _.reject(ownership.getFieldDefinitions(), rejectFn);

            var select = 'SELECT SQL_CALC_FOUND_ROWS ' + generateColumnExpression(stampDef, stamp.getAlias()) + ' FROM ' + this.getFromTables();
            var whereClause = this.getWhereClause($filter);
            select += ((whereClause.length > 0) ? (' WHERE ' + whereClause) : '') + ' LIMIT ' + $offset + ',' + $limit;
            sqlTrace.log(Logger.DEBUG, select);
            var t = (new Date()).getTime();
            connectionManager.getConnection().then(function (connection) {
                var query = connection.query(select, function (err, stamps) {
                    if (err) {
                        connection.release();
                        defer.reject(dataTranslator.getErrorMessage(err));
                    } else {
                        connection.query("SELECT FOUND_ROWS() AS ROWCOUNT", function (err, countData) {
                            if (err) {
                                connection.release();
                                defer.reject(dataTranslator.getErrorMessage(err));
                            } else {
                                var result = {
                                    rows: stamps,
                                    total: countData[0].ROWCOUNT
                                };
                                if (result.total === 0) {
                                    connection.release();
                                    defer.resolve(result);
                                } else {
                                    var ids = _.pluck(result.rows, 'ID');
                                    _.each(result.rows, function(row) {
                                        populateKey(row,'CATALOGUENUMBER');
                                        populateKey(row,'OWNERSHIP');
                                    });
                                    var inValues = dataTranslator.generateInValueStatement(ids);
                                    var queries = [
                                        {
                                            sql: generateChildSelection(catDef, catalogueNumber, inValues),
                                            fieldDefinition: catalogueNumber,
                                            collectionKey: 'CATALOGUENUMBER'
                                        },
                                        {
                                            sql: generateChildSelection(ownerDef, ownership, inValues),
                                            fieldDefinition: ownership,
                                            collectionKey: 'OWNERSHIP'
                                        }
                                    ];
                                    var completed = 0;
                                    var toExecute = queries.length;
                                    _.each(queries, function (query) {
                                        sqlTrace.log(Logger.DEBUG, query.sql);
                                        var _query = connection.query(query.sql);
                                        _query.on('result', function (row) {
                                            processRow(result.rows, row, query.fieldDefinition, query.collectionKey);
                                        }).on('end', function () {
                                            completed++;
                                            if (completed === toExecute) {
                                                connection.release();
                                                sqlTrace.log(Logger.INFO, "Time to query and process rows: " + (new Date().getTime() - t) + "ms");
                                                defer.resolve(result);
                                            }
                                        }).on('error', function (err) {
                                            connection.release();
                                            defer.reject(dataTranslator.getErrorMessage(err));
                                        });
                                    });
                                }
                            }
                        });
                    }
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
