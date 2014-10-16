var extend = require('node.extend');
var persistentCollection = require('./persistent-collection');
var country = require('../model/country');
var stamp = require('../model/stamp');
var stampService = require('./stamps');
var odata = require('../util/odata-parser');
var q = require('q');
var _ = require('../../lib/underscore/underscore');
var Logger = require('../util/logger');

var sqlTrace = Logger.getLogger("sql");

var countries = extend(true, {}, persistentCollection, function() {
    return {
        collectionName: 'countries',
        fieldDefinition: country,
        preDelete: function (connection, id) {
            var defer = q.defer();
            // TODO Not needed with constraints added
            var delete_link = "DELETE FROM ALBUMS_COUNTRIES WHERE COUNTRY_ID= ?";
            connection.query(delete_link, [id], function (err, results) {
                if (err) {
                    defer.reject(dataTranslator.getErrorMessage(err));
                }
                defer.resolve();
            });
            return defer.promise;
        },
    };
}());

module.exports = countries;
