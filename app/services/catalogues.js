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
            //var qs = 'SELECT %a%.STAMP_ID, COUNT(%a%.ID) as COUNT FROM ' + catalogueNumber.getTableName() + ' AS %a% WHERE %a%.STAMP_ID IN (SELECT STAMP_ID FROM ' + catalogueNumber.getTableName() + ' WHERE CATALOGUE_REF=?) GROUP BY %a%.STAMP_ID';
            var qs = 'SELECT COUNT(%a%.ID) AS COUNT FROM ' + catalogueNumber.getTableName() + ' AS %a% where %a%.CATALOGUE_REF=? AND %a%.ACTIVE=1';
            qs = qs.replace(new RegExp('%a%','g'),catalogueNumber.getAlias());
            sqlTrace.log(Logger.DEBUG, qs);
                connection.query(qs, [id], function (err, results) {
                    if (err !== null) {
                        defer.reject(dataTranslator.getErrorMessage(err));
                    } else {
                        if( results[0].COUNT > 0 ) {
                            defer.reject({ message: "Stamps would be orphaned if the catalogue was deleted.", code: "CONFLICT", processed: true });
                        } else {
                            defer.resolve();
                        }
                        /*var valid = true;
                        _.each(results, function(result) {
                            if( result.COUNT === 1 ) {
                                valid = false;
                                defer.reject({ message: "Stamps would be orphaned if the catalogue was deleted.", code: "CONFLICT", processed: true });
                            }
                        });
                        if( valid ) {
                            defer.resolve();
                        }*/
                    }
                });

            return defer.promise;
        },
        collectionName: 'catalogues',
        fieldDefinition: catalogue
    };
}());

module.exports = catalogueService;
