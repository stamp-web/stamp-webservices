var extend = require('node.extend');
var PersistentCollection = require('./persistent-collection');
var dataTranslator = require('./mysql-translator');
var country = require('../model/country');
var ownership = require('../model/ownership');
var stamp = require('../model/stamp');
var q = require('q');

var countries = extend(true, {}, new PersistentCollection(), function() {
    "use strict";

    function updateImagePaths(connection,merged,storedObj) {
        var defer = q.defer();

        var selection = "UPDATE " + ownership.getTableName() + " " + ownership.getAlias() + " INNER JOIN " +
          stamp.getTableName() + " "  + stamp.getAlias() + " on " + ownership.getAlias() + ".STAMP_ID = " + stamp.getAlias() +
            ".ID AND " + stamp.getAlias() + ".COUNTRY_ID = " + storedObj.ID + " SET IMAGE = REPLACE(IMAGE, '" +
            storedObj.NAME + "', '" + merged.NAME + "') WHERE IMAGE LIKE '" + storedObj.NAME + "%';";
        connection.query(selection, null, function (err, results) {
            if (err) {
                defer.reject(dataTranslator.getErrorMessage(err));
            } else {
                defer.resolve();
            }
        });
        return defer.promise;
    }

    return {
        collectionName: 'countries',
        fieldDefinition: country,

        preCommitUpdate: function(connection,merged,storedObj,params) {
            var defer = q.defer();
            if(params.modifyImagePath && params.modifyImagePath === 'true' ) {
                updateImagePaths(connection,merged,storedObj).then(function(result) {
                    defer.resolve({
                        modified: true
                    });
                }).catch(function(err) {
                    defer.reject(dataTranslator.getErrorMessage(err));
                });
            } else {
                defer.resolve({modified: false});
            }
            return defer.promise;
        }
    };
}());

module.exports = countries;
