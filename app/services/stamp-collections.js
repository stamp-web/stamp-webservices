var extend = require('node.extend');
var PersistentCollection = require('./persistent-collection');
var stampCollection = require('../model/stamp-collection');
var dataTranslator = require('./mysql-translator');
var odata = require('../util/odata-parser');
var album = require('../model/album');
var albums = require('./albums');
var q = require('q');
var _ = require('../../lib/underscore/underscore');

var collections = extend(true, {}, new PersistentCollection(), function() {
    "use strict";
    return {
        collectionName: 'stampCollections',
        fieldDefinition: stampCollection,
        /**
         * Will pre-delete the album(s) for the stamp collection.
         * 
         * @param connection    The sql connection
         * @param id            The id of the collection to delete
         * 
         * @return promise of success
         */
        preDelete: function (connection, id) {
            var defer = q.defer();
            var $filter = odata.toPredicates("(" + _.findWhere(album.getFieldDefinitions(), { column: "COLLECTION_ID" }).field + " eq " + id + ")");
            var albumCollection = albums.find($filter).then(function (results) {
                var deleteCount = 0;
                var len = results.rows.length;
                if (len === 0) {
                    defer.resolve();   
                } else {
                    var processRemoved = function(affected) {
                        if (affected > 0) {
                            deleteCount++;
                            if (deleteCount === len) {
                                defer.resolve();
                            }
                        }
                    };
                    var processError = function(err) {
                        defer.reject(dataTranslator.getErrorMessage(err));
                    };
                    for (var i = 0; i < len; i++) {
                        var row = results.rows[i];
                        albums.remove(row.ID).then(processRemoved, processError);
                    }
                }
            }, function (err) {
                defer.reject(dataTranslator.getErrorMessage(err));
            });
            return defer.promise;
        }
    };
}());

module.exports = collections;
