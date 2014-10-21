var extend = require('node.extend');
var PersistentCollection = require('./persistent-collection');
var stampCollection = require('../model/stamp-collection');
var odata = require('../util/odata-parser');
var album = require('../model/album');
var albums = require('./albums');
var q = require('q');
var _ = require('../../lib/underscore/underscore');

var collections = extend(true, {}, new PersistentCollection(), function() {
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
                var len = results.length;
                if (len === 0) {
                    defer.resolve();   
                }
                for (var i = 0; i < len; i++) {
                    var row = results[i];
                    albums.remove(row.ID).then(function (affected) {
                        if (affected > 0) {
                            deleteCount++;
                            if (deleteCount === len) {
                                defer.resolve();
                            }
                        }
                    }, function (err) {
                        defer.reject(dataTranslator.getErrorMessage(err));
                    });
                }
            }, function (err) {
                defer.reject(dataTranslator.getErrorMessage(err));
            });
            return defer.promise;
        }
    };
}());

module.exports = collections;
