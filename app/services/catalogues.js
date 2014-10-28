var extend = require('node.extend');
var PersistentCollection = require('./persistent-collection');
var dataTranslator = require('./mysql-translator');
var catalogue = require('../model/catalogue');
var catalogueNumber = require('../model/catalogue-number');
var connectionManager = require('../pom/connection-mysql');
var _ = require('../../lib/underscore/underscore');
var q = require('q');
var Logger = require('../util/logger');

var sqlTrace = Logger.getLogger('sql');

var catalogueService = extend(true, {}, new PersistentCollection(), function () {
    "use strict";
    return {
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
