var extend = require('node.extend');
var persistentCollection = require('./persistent-collection');
var country = require('../model/country');
var q = require('q');

var countries = extend(true, {}, persistentCollection, function() {
    return {
        collectionName: 'countries',
        fieldDefinition: country,
        preDelete: function (connection, id) {
            var defer = q.defer();
            var delete_link = "DELETE FROM ALBUMS_COUNTRIES WHERE COUNTRY_ID= ?";
            connection.query(delete_link, [id], function (err, results) {
                if (err) {
                    defer.reject(dataTranslator.getErrorMessage(err));
                }
                // delete all stamps now...
                defer.resolve();
            });
            return defer.promise;
        },
    };
}());

module.exports = countries;
