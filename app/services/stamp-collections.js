var extend = require('node.extend');
var PersistentCollection = require('./persistent-collection');
var EntityManagement = require('./entity-management');
var dataTranslator = require('./mysql-translator');
var odata = require('../util/odata-parser');
var stampCollection = require('../model/stamp-collection');
var album = require('../model/album');
var stamp = require('../model/stamp');
var ownership = require('../model/ownership');
var albums = require('./albums');
var q = require('q');
var _ = require('../../lib/underscore/underscore');

var collections = extend(true, {},  new EntityManagement(), new PersistentCollection(), function() {
    "use strict";
    return {
        collectionName: 'stampCollections',
        fieldDefinition: stampCollection,

        getCountStampWhereStatement: function() {
            return album.getAlias() + '.COLLECTION_ID=' + this.fieldDefinition.getAlias() + '.ID AND ' +
                ownership.getAlias() + '.ALBUM_ID = ' + album.getAlias() + '.ID AND ' + ownership.getAlias() + '.STAMP_ID=' +
                stamp.getAlias() + '.ID';
        },

        getCountStampFromTables: function() {
            return this.fieldDefinition.getTableClause() + ',' + stamp.getTableClause() + ',' +
                ownership.getTableClause() + ',' + album.getTableClause();

        },

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
            var params = {
                $filter : odata.parse("(" + _.findWhere(album.getFieldDefinitions(), { column: "COLLECTION_ID" }).field + " eq " + id + ")"),
                $limit: 1000,
                $offset: 0,
                $orderby: null
            };
            var albumCollection = albums.find(params).then(function (results) {
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
