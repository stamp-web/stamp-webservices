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
var logger = require('../util/logger');

var stamps = extend(true, {}, persistentCollection, function () {
    
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
        if (!s['CATALOGUENUMBER'] || s['CATALOGUENUMBER'].length === 0) {
            s['CATALOGUENUMBER'] = [];
        }
        if (!s['OWNERSHIP'] || s['OWNERSHIP'].length === 0) {
            s['OWNERSHIP'] = [];
        }
        s['CATALOGUENUMBER'].push(populateChildren(stamp.getFieldDefinitions(), catalogueNumber.getFieldDefinitions(), row, 'cID'));
        var oid = row.oID;
        if (oid && !_.findWhere(s['OWNERSHIP'], { ID: oid })) {
            console.log("getting owner");
            var ownerObj = populateChildren(stamp.getFieldDefinitions(), ownership.getFieldDefinitions(), row, 'oID');
            if (!_.isEmpty(ownerObj)) {
                s['OWNERSHIP'].push(ownerObj);
            }
        } else {
            console.log("skipped for " + s.ID);
        }
    }

    return {
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
                return (field.internal && field.internal === true || field.model );
            };
            var stampDef = _.reject(stamp.getFieldDefinitions(), rejectFn);
            var catDef = _.reject(catalogueNumber.getFieldDefinitions(), rejectFn);
            var ownerDef = _.reject(ownership.getFieldDefinitions(), rejectFn);
            
            var select = 'SELECT ' + generateColumnExpression(stampDef, 's') + ',';
            select += generateColumnExpression(catDef, 'c') + ',' + generateColumnExpression(ownerDef, 'o');
            select += ' FROM ' + stamp.getTableName() + ' AS s JOIN ' + catalogueNumber.getTableName() + ' AS c ON s.ID=c.STAMP_ID ';
            select += 'LEFT OUTER JOIN ' + ownership.getTableName() + ' AS o ON s.ID = o.STAMP_ID';
            
            var whereClause = ($filter) ? dataTranslator.toWhereClause($filter, stamp, ['s']) : '';
            select += ((whereClause.length > 0) ? (' WHERE ' + whereClause) : '') + ' LIMIT ' + $offset + ',' + $limit;
            logger.log(logger.DEBUG, select);
            console.log(select);
            connectionManager.getConnection(this.collectionName).then(function (connection) {
                var rows = [];
                var query = connection.query(select);
                query.on('result', function (row) {
                    processRow(rows, row);
                }).on('end', function () {
                    defer.resolve(rows);
                }).on('error', function (err) {
                    console.log(err);
                    defer.reject(dataTranslator.getErrorMessage(err));
                });
   
                    
                
            }, function (err) {
                defer.reject(dataTranslator.getErrorMessage(err));
            });
            return defer.promise;
        },
        collectionName: 'stamps',
        fieldDefinition: stamp,
    };
}());

module.exports = stamps;
