var extend = require('node.extend');
var PersistentCollection = require('./persistent-collection');
var EntityManagement = require('./entity-management');
var dataTranslator = require('./mysql-translator');
var catalogue = require('../model/catalogue');
var stamp = require('../model/stamp');
var catalogueNumber = require('../model/catalogue-number');
var connectionManager = require('../pom/connection-mysql');
var _ = require('lodash');
var q = require('q');
var Logger = require('../util/logger');

var sqlTrace = Logger.getLogger('sql');

var catalogueService = extend(true, {}, new EntityManagement(), new PersistentCollection(), function () {
    "use strict";
    return {
        getCountStampWhereStatement: function() {
            return catalogueNumber.getAlias() + '.ACTIVE=1 AND ' + stamp.getAlias() + '.ID=' + catalogueNumber.getAlias() + '.STAMP_ID AND ' + catalogueNumber.getAlias() + '.CATALOGUE_REF=' + catalogue.getAlias() + '.ID';
        },

        getCountStampFromTables: function() {
            return this.fieldDefinition.getTableClause() + ',' + stamp.getTableClause() + ',' + catalogueNumber.getTableClause();
        },
        preDelete: function (connection, id) {
            var defer = q.defer();
            var qs = 'SELECT COUNT(%a%.ID) AS COUNT FROM ' + catalogueNumber.getTableName() + ' AS %a% where %a%.CATALOGUE_REF=? AND %a%.ACTIVE=1';
            qs = qs.replace(new RegExp('%a%','g'),catalogueNumber.getAlias());
            sqlTrace.debug(qs);
                connection.query(qs, [id], function (err, results) {
                    if (err !== null) {
                        defer.reject(dataTranslator.getErrorMessage(err));
                    } else {
                        if( results[0].COUNT > 0 ) {
                            defer.reject({ message: "Stamps would be orphaned if the catalogue was deleted.", code: "CONFLICT", processed: true });
                        } else {
                            defer.resolve();
                        }
                    }
                });

            return defer.promise;
        },
        collectionName: 'catalogues',
        fieldDefinition: catalogue
    };
}());

module.exports = catalogueService;
